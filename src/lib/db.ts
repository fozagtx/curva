// Neon Postgres layer: market cache (RPC-outage resilience for the lobby) and
// the verified activity feed. Rows land in `activity` only after the server has
// confirmed the transaction on-chain and decoded a curva instruction from it —
// the database never holds anything the chain didn't say first.

import { neon } from "@neondatabase/serverless";

export function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

export interface MarketCacheRow {
  fixture_id: number;
  pool_p1: number;
  pool_draw: number;
  pool_p2: number;
  settled: boolean;
  outcome: number | null;
  goals_p1: number | null;
  goals_p2: number | null;
  address: string;
}

export interface ActivityRow {
  tx_sig: string;
  fixture_id: number;
  kind: string; // create_market | stake | settle | claim
  wallet: string;
  side: number | null;
  amount_lamports: number | null;
  slot: number | null;
  created_at: string;
}

export async function ensureSchema(): Promise<void> {
  const q = sql();
  await q`CREATE TABLE IF NOT EXISTS market_cache (
    fixture_id BIGINT PRIMARY KEY,
    pool_p1 BIGINT NOT NULL DEFAULT 0,
    pool_draw BIGINT NOT NULL DEFAULT 0,
    pool_p2 BIGINT NOT NULL DEFAULT 0,
    settled BOOLEAN NOT NULL DEFAULT FALSE,
    outcome SMALLINT,
    goals_p1 INT,
    goals_p2 INT,
    address TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE TABLE IF NOT EXISTS activity (
    tx_sig TEXT PRIMARY KEY,
    fixture_id BIGINT NOT NULL,
    kind TEXT NOT NULL,
    wallet TEXT NOT NULL,
    side SMALLINT,
    amount_lamports BIGINT,
    slot BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await q`CREATE INDEX IF NOT EXISTS activity_fixture_idx ON activity(fixture_id, created_at DESC)`;
}

export async function upsertMarketCache(rows: MarketCacheRow[]): Promise<void> {
  if (!rows.length) return;
  const q = sql();
  for (const r of rows) {
    await q`INSERT INTO market_cache
      (fixture_id, pool_p1, pool_draw, pool_p2, settled, outcome, goals_p1, goals_p2, address, updated_at)
      VALUES (${r.fixture_id}, ${r.pool_p1}, ${r.pool_draw}, ${r.pool_p2}, ${r.settled},
              ${r.outcome}, ${r.goals_p1}, ${r.goals_p2}, ${r.address}, now())
      ON CONFLICT (fixture_id) DO UPDATE SET
        pool_p1 = EXCLUDED.pool_p1, pool_draw = EXCLUDED.pool_draw, pool_p2 = EXCLUDED.pool_p2,
        settled = EXCLUDED.settled, outcome = EXCLUDED.outcome,
        goals_p1 = EXCLUDED.goals_p1, goals_p2 = EXCLUDED.goals_p2,
        address = EXCLUDED.address, updated_at = now()`;
  }
}

export async function readMarketCache(): Promise<MarketCacheRow[]> {
  const q = sql();
  const rows = await q`SELECT fixture_id, pool_p1, pool_draw, pool_p2, settled, outcome,
    goals_p1, goals_p2, address FROM market_cache`;
  return rows.map((r) => ({
    ...r,
    fixture_id: Number(r.fixture_id),
    pool_p1: Number(r.pool_p1),
    pool_draw: Number(r.pool_draw),
    pool_p2: Number(r.pool_p2),
  })) as MarketCacheRow[];
}

export async function insertActivity(row: Omit<ActivityRow, "created_at">): Promise<boolean> {
  const q = sql();
  const res = await q`INSERT INTO activity
    (tx_sig, fixture_id, kind, wallet, side, amount_lamports, slot)
    VALUES (${row.tx_sig}, ${row.fixture_id}, ${row.kind}, ${row.wallet},
            ${row.side}, ${row.amount_lamports}, ${row.slot})
    ON CONFLICT (tx_sig) DO NOTHING
    RETURNING tx_sig`;
  return res.length > 0;
}

export async function listActivity(fixtureId?: number, limit = 20): Promise<ActivityRow[]> {
  const q = sql();
  const rows = fixtureId
    ? await q`SELECT * FROM activity WHERE fixture_id = ${fixtureId} ORDER BY created_at DESC LIMIT ${limit}`
    : await q`SELECT * FROM activity ORDER BY created_at DESC LIMIT ${limit}`;
  return rows.map((r) => ({
    ...r,
    fixture_id: Number(r.fixture_id),
    amount_lamports: r.amount_lamports == null ? null : Number(r.amount_lamports),
    slot: r.slot == null ? null : Number(r.slot),
  })) as ActivityRow[];
}
