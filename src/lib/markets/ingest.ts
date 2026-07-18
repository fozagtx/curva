/* eslint-disable @typescript-eslint/no-explicit-any -- decoding dynamic chain data */
// Verified transaction ingestion: given a signature, confirm it on-chain,
// decode the curva instruction it carries, resolve the market's fixture, and
// return an activity row. Anything unverifiable is rejected.

import { Connection, PublicKey } from "@solana/web3.js";
import { BorshCoder, BN, type Idl } from "@coral-xyz/anchor";
import idl from "./curva-idl.json";
import { SOLANA_RPC } from "../txline/config";
import type { ActivityRow } from "../db";

const PROGRAM_ID = (idl as { address: string }).address;
const coder = new BorshCoder(idl as Idl);

const fixtureByMarket = new Map<string, number>();

async function fixtureIdForMarket(conn: Connection, market: string): Promise<number | null> {
  const cached = fixtureByMarket.get(market);
  if (cached != null) return cached;
  const info = await conn.getAccountInfo(new PublicKey(market));
  if (!info) return null;
  try {
    const d = coder.accounts.decode("Market", info.data);
    const fixtureId = Number(d.fixture_id ?? d.fixtureId);
    fixtureByMarket.set(market, fixtureId);
    return fixtureId;
  } catch {
    return null;
  }
}

export async function ingestTransaction(txSig: string): Promise<Omit<ActivityRow, "created_at"> | null> {
  const conn = new Connection(SOLANA_RPC, "confirmed");
  const tx = await conn.getTransaction(txSig, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx || tx.meta?.err) return null;

  const message = tx.transaction.message;
  const keys = message.getAccountKeys(
    tx.meta?.loadedAddresses ? { accountKeysFromLookups: tx.meta.loadedAddresses } : undefined,
  );
  const feePayer = keys.get(0)!.toBase58();

  for (const ix of message.compiledInstructions) {
    const program = keys.get(ix.programIdIndex)!.toBase58();
    if (program !== PROGRAM_ID) continue;

    const decoded = coder.instruction.decode(Buffer.from(ix.data));
    if (!decoded) continue;
    const data = decoded.data as any;

    switch (decoded.name) {
      case "create_market":
        return {
          tx_sig: txSig,
          fixture_id: Number(new BN(data.fixture_id ?? data.fixtureId).toString()),
          kind: "create_market",
          wallet: feePayer,
          side: null,
          amount_lamports: null,
          slot: tx.slot,
        };
      case "stake": {
        const market = keys.get(ix.accountKeyIndexes[0])!.toBase58();
        const fixtureId = await fixtureIdForMarket(conn, market);
        if (fixtureId == null) return null;
        return {
          tx_sig: txSig,
          fixture_id: fixtureId,
          kind: "stake",
          wallet: feePayer,
          side: Number(data.side),
          amount_lamports: Number(new BN(data.amount).toString()),
          slot: tx.slot,
        };
      }
      case "settle": {
        const market = keys.get(ix.accountKeyIndexes[0])!.toBase58();
        const fixtureId = await fixtureIdForMarket(conn, market);
        if (fixtureId == null) return null;
        return {
          tx_sig: txSig,
          fixture_id: fixtureId,
          kind: "settle",
          wallet: feePayer,
          side: Number(data.claimed_outcome ?? data.claimedOutcome),
          amount_lamports: null,
          slot: tx.slot,
        };
      }
      case "claim": {
        const market = keys.get(ix.accountKeyIndexes[0])!.toBase58();
        const fixtureId = await fixtureIdForMarket(conn, market);
        if (fixtureId == null) return null;
        return {
          tx_sig: txSig,
          fixture_id: fixtureId,
          kind: "claim",
          wallet: feePayer,
          side: null,
          amount_lamports: null,
          slot: tx.slot,
        };
      }
    }
  }
  return null;
}

// Backfill every historical program interaction (bounded; devnet history is small).
export async function backfillProgramActivity(limit = 200): Promise<number> {
  const conn = new Connection(SOLANA_RPC, "confirmed");
  const sigs = await conn.getSignaturesForAddress(new PublicKey(PROGRAM_ID), { limit });
  let ingested = 0;
  const { insertActivity } = await import("../db");
  for (const s of sigs.reverse()) {
    if (s.err) continue;
    try {
      const row = await ingestTransaction(s.signature);
      if (row && (await insertActivity(row))) ingested += 1;
    } catch {
      // skip malformed/foreign transactions
    }
  }
  return ingested;
}
