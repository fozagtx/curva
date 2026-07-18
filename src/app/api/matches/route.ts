import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { BorshCoder, type Idl, type BN } from "@coral-xyz/anchor";
import { fetchFixtures } from "@/lib/txline/client";
import { WORLD_CUP_COMPETITION_ID, SOLANA_RPC } from "@/lib/txline/config";
import { fixtureMeta } from "@/lib/engine/state";
import idl from "@/lib/markets/curva-idl.json";
import { readMarketCache, upsertMarketCache } from "@/lib/db";

const coder = new BorshCoder(idl as Idl);
const PROGRAM_ID = new PublicKey((idl as { address: string }).address);

// One getProgramAccounts sweep: fixtureId -> { pool lamports, settled }.
// Fresh reads refresh the Neon cache; on RPC failure the cache serves instead,
// so lobby badges survive devnet hiccups.
type MarketState = {
  pool: number;
  settled: boolean;
  pools: [number, number, number];
};

async function marketStates(): Promise<Map<number, MarketState>> {
  const out = new Map<number, MarketState>();
  try {
    const conn = new Connection(SOLANA_RPC, "confirmed");
    const accounts = await conn.getProgramAccounts(PROGRAM_ID);
    const cacheRows = [];
    for (const { pubkey, account } of accounts) {
      try {
        const d = coder.accounts.decode("Market", account.data);
        const pools = (d.pools as BN[]).map(Number) as [number, number, number];
        const fixtureId = Number(d.fixture_id ?? d.fixtureId);
        const settled = Object.keys(d.state ?? {})[0]?.toLowerCase() === "settled";
        out.set(fixtureId, {
          pool: pools[0] + pools[1] + pools[2],
          settled,
          pools,
        });
        cacheRows.push({
          fixture_id: fixtureId,
          pool_p1: pools[0], pool_draw: pools[1], pool_p2: pools[2],
          settled,
          outcome: settled ? Number(d.outcome ?? 0) : null,
          goals_p1: settled ? Number(d.goals?.[0] ?? 0) : null,
          goals_p2: settled ? Number(d.goals?.[1] ?? 0) : null,
          address: pubkey.toBase58(),
        });
      } catch { /* not a Market account (e.g. Position) */ }
    }
    upsertMarketCache(cacheRows).catch(() => { /* cache is best-effort */ });
  } catch {
    // RPC down: serve the last known chain state from Neon
    try {
      for (const r of await readMarketCache()) {
        out.set(r.fixture_id, {
          pool: r.pool_p1 + r.pool_draw + r.pool_p2,
          settled: r.settled,
          pools: [r.pool_p1, r.pool_draw, r.pool_p2],
        });
      }
    } catch { /* no cache either: badges disappear, lobby still works */ }
  }
  return out;
}

export const dynamic = "force-dynamic";

// World Cup 2026 group stage began June 11; list the whole tournament.
const TOURNAMENT_START_EPOCH_DAY = 20614;

export async function GET() {
  try {
    const [current, tournament, markets] = await Promise.all([
      fetchFixtures(WORLD_CUP_COMPETITION_ID).then((v) => ({ status: "fulfilled" as const, value: v }), (reason) => ({ status: "rejected" as const, reason })),
      fetchFixtures(WORLD_CUP_COMPETITION_ID, TOURNAMENT_START_EPOCH_DAY).then((v) => ({ status: "fulfilled" as const, value: v }), (reason) => ({ status: "rejected" as const, reason })),
      marketStates(),
    ]);
    const byId = new Map<number, ReturnType<typeof fixtureMeta>>();
    for (const r of [tournament, current]) {
      if (r.status === "fulfilled") {
        for (const f of r.value) byId.set(f.FixtureId, fixtureMeta(f));
      }
    }
    if (byId.size === 0 && current.status === "rejected") throw current.reason;
    const matches = [...byId.values()]
      .sort((a, b) => a.startTime - b.startTime)
      .map((m) => ({ ...m, market: markets.get(m.fixtureId) ?? null }));
    return NextResponse.json({ matches });
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 502 },
    );
  }
}
