/* eslint-disable @typescript-eslint/no-explicit-any -- anchor's IDL-driven API */
// On-chain verification: fetch a Merkle proof for the fixture's goal stats from
// TxLINE and run the TxOracle program's validateStat as a read-only view against
// the daily_scores_roots PDA on Solana devnet. No wallet or gas required —
// the deployed program itself checks the proof against the on-chain root.

import { NextResponse, type NextRequest } from "next/server";
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import { API_BASE_URL, SOLANA_RPC } from "@/lib/txline/config";
import { authHeaders } from "@/lib/txline/auth";
import { fetchScoresHistorical } from "@/lib/txline/client";
import idl from "@/lib/txline/txoracle-idl.json";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ProofNodeWire {
  hash: string | number[];
  isRightSibling: boolean;
}

function toBytes32(value: string | number[]): number[] {
  const bytes = Array.isArray(value)
    ? Uint8Array.from(value)
    : value.startsWith("0x")
      ? Buffer.from(value.slice(2), "hex")
      : Buffer.from(value, "base64");
  if (bytes.length !== 32) throw new Error(`Expected 32 bytes, got ${bytes.length}`);
  return Array.from(bytes);
}

function toProofNodes(nodes: ProofNodeWire[]) {
  return nodes.map((n) => ({ hash: toBytes32(n.hash), isRightSibling: n.isRightSibling }));
}

async function fetchProof(fixtureId: number, seq: number, statKey: number) {
  const params = new URLSearchParams({
    fixtureId: String(fixtureId),
    seq: String(seq),
    statKey: String(statKey),
  });
  const res = await fetch(`${API_BASE_URL}/scores/stat-validation?${params}`, {
    headers: await authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`stat-validation ${res.status}`);
  return res.json();
}

async function validateOnChain(validation: any): Promise<{ isValid: boolean; pda: string; epochDay: number; value: number }> {
  const connection = new Connection(SOLANA_RPC, "confirmed");
  // Simulation-only wallet: .view() never sends a transaction or pays fees.
  const kp = Keypair.generate();
  const wallet = {
    publicKey: kp.publicKey,
    signTransaction: async <T,>(tx: T): Promise<T> => tx,
    signAllTransactions: async <T,>(txs: T[]): Promise<T[]> => txs,
  };
  const provider = new anchor.AnchorProvider(connection, wallet as anchor.Wallet, {
    commitment: "confirmed",
  });
  const program = new anchor.Program(idl as anchor.Idl, provider);

  const fixtureSummary = {
    fixtureId: new anchor.BN(validation.summary.fixtureId),
    updateStats: {
      updateCount: validation.summary.updateStats.updateCount,
      minTimestamp: new anchor.BN(validation.summary.updateStats.minTimestamp),
      maxTimestamp: new anchor.BN(validation.summary.updateStats.maxTimestamp),
    },
    eventsSubTreeRoot: toBytes32(validation.summary.eventStatsSubTreeRoot),
  };
  const stat = {
    statToProve: validation.statToProve,
    eventStatRoot: toBytes32(validation.eventStatRoot),
    statProof: toProofNodes(validation.statProof),
  };
  const value = Number(validation.statToProve?.value ?? NaN);
  const predicate = Number.isFinite(value)
    ? { threshold: value, comparison: { equalTo: {} } }
    : { threshold: -1, comparison: { greaterThan: {} } };

  const targetTs = validation.summary.updateStats.minTimestamp;
  const epochDay = Math.floor(targetTs / 86_400_000);
  const [dailyScoresPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), new anchor.BN(epochDay).toArrayLike(Buffer, "le", 2)],
    program.programId,
  );

  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });
  const isValid: boolean = await (program.methods as any)
    .validateStat(
      new anchor.BN(targetTs),
      fixtureSummary,
      toProofNodes(validation.subTreeProof),
      toProofNodes(validation.mainTreeProof),
      predicate,
      stat,
      null,
      null,
    )
    .accounts({ dailyScoresMerkleRoots: dailyScoresPda })
    .preInstructions([computeBudgetIx])
    .view();

  return { isValid, pda: dailyScoresPda.toBase58(), epochDay, value };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId: raw } = await params;
  const fixtureId = Number(raw);
  if (!Number.isFinite(fixtureId)) {
    return NextResponse.json({ error: "bad fixtureId" }, { status: 400 });
  }

  try {
    const records = await fetchScoresHistorical(fixtureId);
    if (!records.length) {
      return NextResponse.json({ error: "No score records for fixture yet" }, { status: 404 });
    }
    // Prefer the newest records; roots land on-chain in batches, so walk
    // backwards until a proof is available.
    const seqs = [...new Set(records.map((r) => r.seq).filter((s) => s >= 1))].sort((a, b) => b - a);
    const candidates = seqs.filter((_, i) => i % Math.max(1, Math.floor(seqs.length / 6)) === 0).slice(0, 6);

    let lastErr: unknown = null;
    for (const seq of candidates) {
      try {
        const [p1, p2] = await Promise.all([
          fetchProof(fixtureId, seq, 1), // participant 1 total goals
          fetchProof(fixtureId, seq, 2), // participant 2 total goals
        ]);
        const [r1, r2] = await Promise.all([validateOnChain(p1), validateOnChain(p2)]);
        return NextResponse.json({
          verified: r1.isValid && r2.isValid,
          seq,
          goals: [r1.value, r2.value],
          epochDay: r1.epochDay,
          rootAccount: r1.pda,
          programId: (idl as { address: string }).address,
          network: "devnet",
        });
      } catch (err) {
        lastErr = err;
      }
    }
    return NextResponse.json(
      { error: `No on-chain root available yet: ${String(lastErr instanceof Error ? lastErr.message : lastErr)}` },
      { status: 409 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 502 },
    );
  }
}
