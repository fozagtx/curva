// All curva positions for a wallet - memcmp-filtered getProgramAccounts.

import { NextResponse, type NextRequest } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { BorshCoder, type Idl, type BN } from "@coral-xyz/anchor";
import idl from "@/lib/markets/curva-idl.json";
import { SOLANA_RPC } from "@/lib/txline/config";
import { readMarketCache } from "@/lib/db";
import { fetchFixtures } from "@/lib/txline/client";
import { WORLD_CUP_COMPETITION_ID } from "@/lib/txline/config";
import { fixtureMeta } from "@/lib/engine/state";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PROGRAM_ID = new PublicKey((idl as { address: string }).address);
const coder = new BorshCoder(idl as Idl);
// Anchor discriminator (8) then Position.owner pubkey.
const OWNER_OFFSET = 8;

export async function GET(req: NextRequest) {
 const ownerRaw = req.nextUrl.searchParams.get("owner")?.trim();
 if (!ownerRaw) {
 return NextResponse.json({ error: "owner required" }, { status: 400 });
 }

 let owner: PublicKey;
 try {
 owner = new PublicKey(ownerRaw);
 } catch {
 return NextResponse.json({ error: "bad owner" }, { status: 400 });
 }

 try {
 const conn = new Connection(SOLANA_RPC, "confirmed");
 const [accounts, cache, fixtures] = await Promise.all([
 conn.getProgramAccounts(PROGRAM_ID, {
 filters: [{ memcmp: { offset: OWNER_OFFSET, bytes: owner.toBase58() } }],
 }),
 readMarketCache().catch(() => [] as Awaited<ReturnType<typeof readMarketCache>>),
 fetchFixtures(WORLD_CUP_COMPETITION_ID).catch(() => []),
 ]);

 const cacheByAddr = new Map(cache.map((r) => [r.address, r]));
 const metaById = new Map(fixtures.map((f) => [f.FixtureId, fixtureMeta(f)]));

 const positions: {
 fixtureId: number;
 side: number;
 amount: number;
 claimed: boolean;
 settled: boolean;
 outcome: number | null;
 pools: [number, number, number];
 marketAddress: string;
 positionAddress: string;
 home: string;
 away: string;
 homeParti: number;
 startTime: number;
 }[] = [];

 for (const { pubkey, account } of accounts) {
 let pos;
 try {
 pos = coder.accounts.decode("Position", account.data);
 } catch {
 continue;
 }
 const marketPk = new PublicKey(pos.market);
 const marketAddr = marketPk.toBase58();
 const cached = cacheByAddr.get(marketAddr);

 let fixtureId = cached?.fixture_id ?? 0;
 let pools: [number, number, number] = cached
 ? [cached.pool_p1, cached.pool_draw, cached.pool_p2]
 : [0, 0, 0];
 let settled = cached?.settled ?? false;
 let outcome = cached?.outcome ?? null;

 if (!cached) {
 try {
 const info = await conn.getAccountInfo(marketPk);
 if (info) {
 const m = coder.accounts.decode("Market", info.data);
 fixtureId = Number(m.fixture_id ?? m.fixtureId);
 pools = (m.pools as BN[]).map(Number) as [number, number, number];
 settled = Object.keys(m.state ?? {})[0]?.toLowerCase() === "settled";
 outcome = settled ? Number(m.outcome ?? 0) : null;
 }
 } catch { /* skip enrich */ }
 }

 const meta = metaById.get(fixtureId);
 positions.push({
 fixtureId,
 side: Number(pos.side),
 amount: Number(pos.amount),
 claimed: Boolean(pos.claimed),
 settled,
 outcome,
 pools,
 marketAddress: marketAddr,
 positionAddress: pubkey.toBase58(),
 home: meta?.home.name ?? `Fixture ${fixtureId}`,
 away: meta?.away.name ?? "",
 homeParti: meta?.home.parti ?? 1,
 startTime: meta?.startTime ?? 0,
 });
 }

 positions.sort((a, b) => b.startTime - a.startTime || b.amount - a.amount);

 return NextResponse.json({ owner: owner.toBase58(), positions });
 } catch (err) {
 return NextResponse.json(
 { error: String(err instanceof Error ? err.message : err) },
 { status: 502 },
 );
 }
}
