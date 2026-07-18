// Verified activity feed.
// POST {txSig}: the server confirms the transaction on-chain, decodes the curva
// instruction, and only then records it. GET: recent receipts (optionally per
// fixture). Nothing user-supplied is trusted beyond the signature itself.

import { NextResponse, type NextRequest } from "next/server";
import { ensureSchema, insertActivity, listActivity } from "@/lib/db";
import { ingestTransaction } from "@/lib/markets/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

let schemaReady: Promise<void> | null = null;
function ready() {
  if (!schemaReady) schemaReady = ensureSchema();
  return schemaReady;
}

export async function GET(req: NextRequest) {
  try {
    await ready();
    const fixtureIdRaw = req.nextUrl.searchParams.get("fixtureId");
    const fixtureId = fixtureIdRaw ? Number(fixtureIdRaw) : undefined;
    const rows = await listActivity(Number.isFinite(fixtureId as number) ? fixtureId : undefined);
    return NextResponse.json({ activity: rows });
  } catch (err) {
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ready();
    const body = (await req.json()) as { txSig?: string };
    const txSig = body.txSig?.trim();
    if (!txSig || txSig.length < 40 || txSig.length > 120) {
      return NextResponse.json({ error: "bad txSig" }, { status: 400 });
    }
    const row = await ingestTransaction(txSig);
    if (!row) {
      return NextResponse.json({ error: "transaction not found or not a Kryva market instruction" }, { status: 422 });
    }
    await insertActivity(row);
    return NextResponse.json({ recorded: row });
  } catch (err) {
    return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 502 });
  }
}
