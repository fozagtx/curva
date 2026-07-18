// One-time database bootstrap: create tables and backfill the verified
// activity feed from the program's real devnet transaction history.
// Run: pnpm tsx scripts/db-setup.ts

import * as fs from "fs";

// tsx does not auto-load .env.local
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

async function main() {
  const { ensureSchema, listActivity } = await import("../src/lib/db");
  const { backfillProgramActivity } = await import("../src/lib/markets/ingest");

  await ensureSchema();
  console.log("[db] schema ready");
  const n = await backfillProgramActivity(200);
  console.log(`[db] backfilled ${n} verified transactions`);
  const rows = await listActivity(undefined, 50);
  for (const r of rows) {
    console.log(`  ${r.kind.padEnd(14)} fixture ${r.fixture_id} by ${r.wallet.slice(0, 8)}… ${r.tx_sig.slice(0, 16)}…`);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
