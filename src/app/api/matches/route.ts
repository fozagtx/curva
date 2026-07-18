import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { BorshCoder, type Idl, type BN } from "@coral-xyz/anchor";
import { fetchFixtures } from "@/lib/txline/client";
import { WORLD_CUP_COMPETITION_ID, SOLANA_RPC } from "@/lib/txline/config";
import { fixtureMeta } from "@/lib/engine/state";
import idl from "@/lib/markets/curva-idl.json";

const coder = new BorshCoder(idl as Idl);
const PROGRAM_ID = new PublicKey((idl as { address: string }).address);

// One getProgramAccounts sweep: fixtureId -> { pool lamports, settled }
async function marketStates(): Promise<Map<number, { pool: number; settled: boolean }>> {
  const out = new Map<number, { pool: number; settled: boolean }>();
  try {
    const conn = new Connection(SOLANA_RPC, "confirmed");
    const accounts = await conn.getProgramAccounts(PROGRAM_ID);
    for (const { account } of accounts) {
      try {
        const d = coder.accounts.decode("Market", account.data);
        const pools = (d.pools as BN[]).map(Number);
        out.set(Number(d.fixture_id ?? d.fixtureId), {
          pool: pools[0] + pools[1] + pools[2],
          settled: Object.keys(d.state ?? {})[0]?.toLowerCase() === "settled",
        });
      } catch { /* not a Market account (e.g. Position) */ }
    }
  } catch { /* RPC hiccup: lobby still works without badges */ }
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
