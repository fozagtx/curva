// Server-side read of a fixture's market + optional owner positions.
// Keeps browser free of direct RPC dependencies (CORS/rate limits).

import { NextResponse, type NextRequest } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { BorshCoder, BN, type Idl } from "@coral-xyz/anchor";
import idl from "@/lib/markets/curva-idl.json";
import { SOLANA_RPC } from "@/lib/txline/config";

export const dynamic = "force-dynamic";

const PROGRAM_ID = new PublicKey((idl as { address: string }).address);
const coder = new BorshCoder(idl as Idl);

function marketPda(fixtureId: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("market"), new BN(fixtureId).toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID,
  )[0];
}

function vaultPda(market: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), market.toBuffer()],
    PROGRAM_ID,
  )[0];
}

function positionPda(market: PublicKey, owner: PublicKey, side: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), market.toBuffer(), owner.toBuffer(), Buffer.from([side])],
    PROGRAM_ID,
  )[0];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId: raw } = await params;
  const fixtureId = Number(raw);
  if (!Number.isFinite(fixtureId)) {
    return NextResponse.json({ error: "bad fixtureId" }, { status: 400 });
  }
  const ownerRaw = req.nextUrl.searchParams.get("owner");

  try {
    const conn = new Connection(SOLANA_RPC, "confirmed");
    const market = marketPda(fixtureId);
    const info = await conn.getAccountInfo(market);
    if (!info) return NextResponse.json({ market: null, positions: [] });

    const decoded = coder.accounts.decode("Market", info.data);
    const stateKey = Object.keys(decoded.state ?? {})[0]?.toLowerCase();
    const body = {
      market: {
        // anchor's decoder keeps the IDL's snake_case field names
        fixtureId: Number(decoded.fixture_id ?? decoded.fixtureId),
        kickoffTsMs: Number(decoded.kickoff_ts_ms ?? decoded.kickoffTsMs),
        pools: (decoded.pools as BN[]).map((p) => Number(p)),
        settled: stateKey === "settled",
        outcome: Number(decoded.outcome ?? 0),
        goals: decoded.goals as [number, number],
        settledTsMs: Number(decoded.settled_ts_ms ?? decoded.settledTsMs ?? 0),
        rootsAccount: String(
          (decoded.roots_account ?? decoded.rootsAccount)?.toBase58?.() ??
          decoded.roots_account ?? "",
        ),
        address: market.toBase58(),
        vault: vaultPda(market).toBase58(),
      },
      positions: [] as { side: number; amount: number; claimed: boolean; address: string }[],
    };

    if (ownerRaw) {
      const owner = new PublicKey(ownerRaw);
      const addresses = [0, 1, 2].map((s) => positionPda(market, owner, s));
      const infos = await conn.getMultipleAccountsInfo(addresses);
      infos.forEach((posInfo, i) => {
        if (!posInfo) return;
        const pos = coder.accounts.decode("Position", posInfo.data);
        body.positions.push({
          side: i,
          amount: Number(pos.amount),
          claimed: Boolean(pos.claimed),
          address: addresses[i].toBase58(),
        });
      });
    }
    return NextResponse.json(body);
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 502 },
    );
  }
}
