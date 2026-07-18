/* eslint-disable @typescript-eslint/no-explicit-any -- TxLINE proof payload is IDL-shaped at runtime */
// Fetches the finalisation Merkle proof for a fixture's final goal counts from
// TxLINE and returns it shaped as the pulse_markets `settle` instruction args.
// Settlement itself is permissionless — any wallet submits this proof and the
// TxOracle program on devnet is the judge.

import { NextResponse, type NextRequest } from "next/server";
import { API_BASE_URL } from "@/lib/txline/config";
import { authHeaders } from "@/lib/txline/auth";
import { fetchScoresHistorical } from "@/lib/txline/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function b64ToBytes(value: string | number[]): number[] {
  const bytes = Array.isArray(value)
    ? Uint8Array.from(value)
    : value.startsWith("0x")
      ? Buffer.from(value.slice(2), "hex")
      : Buffer.from(value, "base64");
  if (bytes.length !== 32) throw new Error(`Expected 32 bytes, got ${bytes.length}`);
  return Array.from(bytes);
}

function proofNodes(nodes: Array<{ hash: string | number[]; isRightSibling: boolean }>) {
  return nodes.map((n) => ({ hash: b64ToBytes(n.hash), isRightSibling: n.isRightSibling }));
}

async function fetchValidation(fixtureId: number, seq: number, statKeys: string) {
  const params = new URLSearchParams({
    fixtureId: String(fixtureId),
    seq: String(seq),
    statKeys,
  });
  const res = await fetch(`${API_BASE_URL}/scores/stat-validation?${params}`, {
    headers: await authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`stat-validation ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

// Real V2 shape: statsToProve[] + statProofs[][] + one shared eventStatRoot.
function toStatTerm(v: any, index: number) {
  const s = v.statsToProve[index];
  return {
    statToProve: {
      key: Number(s.key),
      value: Number(s.value),
      period: Number(s.period ?? 0),
    },
    eventStatRoot: b64ToBytes(v.eventStatRoot),
    statProof: proofNodes(v.statProofs[index]),
  };
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
      return NextResponse.json({ error: "No score records yet" }, { status: 404 });
    }
    // Prefer the finalisation record; fall back to the newest records in case
    // the finalised seq is not yet in an anchored batch.
    const finalised = records.filter((r) => r.action === "game_finalised").map((r) => r.seq);
    const newestFirst = [...new Set(records.map((r) => r.seq))].sort((a, b) => b - a);
    const candidates = [...new Set([...finalised, ...newestFirst])].slice(0, 6);

    let lastErr: unknown = null;
    for (const seq of candidates) {
      try {
        const v = await fetchValidation(fixtureId, seq, "1,2");
        if (!Array.isArray(v.statsToProve) || v.statsToProve.length < 2) {
          throw new Error("validation response missing statsToProve");
        }
        const idx1 = v.statsToProve.findIndex((s: any) => Number(s.key) === 1);
        const idx2 = v.statsToProve.findIndex((s: any) => Number(s.key) === 2);
        if (idx1 < 0 || idx2 < 0) throw new Error("statsToProve missing keys 1/2");
        const statP1 = toStatTerm(v, idx1);
        const statP2 = toStatTerm(v, idx2);

        const goals: [number, number] = [statP1.statToProve.value, statP2.statToProve.value];
        const outcome = goals[0] > goals[1] ? 0 : goals[0] === goals[1] ? 1 : 2;

        return NextResponse.json({
          seq,
          outcome,
          goals,
          periods: [statP1.statToProve.period, statP2.statToProve.period],
          targetTsMs: Number(v.summary.updateStats.minTimestamp),
          fixtureSummary: {
            fixtureId: Number(v.summary.fixtureId),
            updateStats: {
              updateCount: Number(v.summary.updateStats.updateCount),
              minTimestamp: Number(v.summary.updateStats.minTimestamp),
              maxTimestamp: Number(v.summary.updateStats.maxTimestamp),
            },
            eventsSubTreeRoot: b64ToBytes(v.summary.eventStatsSubTreeRoot),
          },
          fixtureProof: proofNodes(v.subTreeProof),
          mainTreeProof: proofNodes(v.mainTreeProof),
          statP1,
          statP2,
          raw: undefined,
        });
      } catch (err) {
        lastErr = err;
      }
    }
    return NextResponse.json(
      { error: `No settleable proof yet: ${String(lastErr instanceof Error ? lastErr.message : lastErr)}` },
      { status: 409 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 502 },
    );
  }
}
