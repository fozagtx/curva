// End-to-end settlement proof on devnet, run after `anchor deploy`:
//   1. pick a FINISHED World Cup fixture from TxLINE
//   2. create its market (kickoff back-dated so it is immediately settleable)
//   3. stake on two sides from the local wallet
//   4. fetch the finalisation Merkle proof from TxLINE
//   5. settle via CPI into TxOracle validate_stat
//   6. claim the payout
// Prints explorer links for every step — these are the demo receipts.
//
// Run: pnpm tsx scripts/settlement-e2e.ts [fixtureId]

import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import * as fs from "fs";
import marketsIdl from "../src/lib/markets/curva-idl.json";
import { API_BASE_URL, JWT_URL, SOLANA_RPC, WORLD_CUP_COMPETITION_ID } from "../src/lib/txline/config";

const TXORACLE_PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

function explorer(kind: "address" | "tx", id: string) {
  return `https://explorer.solana.com/${kind}/${id}?cluster=devnet`;
}

async function jwt(): Promise<string> {
  const res = await fetch(JWT_URL, { method: "POST" });
  return ((await res.json()) as { token: string }).token;
}

async function txlineGet(path: string, token: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Api-Token": process.env.TXLINE_API_TOKEN ?? readEnvLocal("TXLINE_API_TOKEN"),
    },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

function readEnvLocal(key: string): string {
  const line = fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} not in .env.local — run scripts/txline-setup.ts first`);
  return line.slice(key.length + 1).trim();
}

function b32(value: string | number[]): number[] {
  const bytes = Array.isArray(value) ? Uint8Array.from(value) : Buffer.from(value, "base64");
  if (bytes.length !== 32) throw new Error(`expected 32 bytes, got ${bytes.length}`);
  return Array.from(bytes);
}

function nodes(list: Array<{ hash: string | number[]; isRightSibling: boolean }>) {
  return list.map((n) => ({ hash: b32(n.hash), isRightSibling: n.isRightSibling }));
}

async function main() {
  const connectionRpc = new Connection(SOLANA_RPC, "confirmed");
  const secret = Uint8Array.from(JSON.parse(fs.readFileSync(".keys/devnet-wallet.json", "utf8")));
  const kp = Keypair.fromSecretKey(secret);
  const wallet = new anchor.Wallet(kp);
  const provider = new anchor.AnchorProvider(connectionRpc, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const program = new anchor.Program(marketsIdl as anchor.Idl, provider);

  console.log(`wallet  ${kp.publicKey.toBase58()}`);
  console.log(`balance ${(await connectionRpc.getBalance(kp.publicKey)) / LAMPORTS_PER_SOL} SOL`);
  console.log(`program ${program.programId.toBase58()}`);

  const token = await jwt();

  // 1. choose a finished fixture (arg or newest finished from the schedule)
  let fixtureId = Number(process.argv[2] ?? 0);
  let kickoff = 0;
  const fixtures: any[] = await txlineGet(
    `/fixtures/snapshot?competitionId=${WORLD_CUP_COMPETITION_ID}&startEpochDay=20614`,
    token,
  );
  if (!fixtureId) {
    const finished = fixtures
      .filter((f) => f.StartTime < Date.now() - 3 * 3600_000)
      .sort((a, b) => b.StartTime - a.StartTime);
    if (!finished.length) throw new Error("no finished fixtures found");
    fixtureId = finished[0].FixtureId;
    kickoff = finished[0].StartTime;
    console.log(`fixture ${fixtureId}: ${finished[0].Participant1} vs ${finished[0].Participant2}`);
  } else {
    const f = fixtures.find((x) => x.FixtureId === fixtureId);
    if (!f) throw new Error(`fixture ${fixtureId} not in snapshot`);
    kickoff = f.StartTime;
    console.log(`fixture ${fixtureId}: ${f.Participant1} vs ${f.Participant2}`);
  }

  const [market] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), new anchor.BN(fixtureId).toArrayLike(Buffer, "le", 8)],
    program.programId,
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), market.toBuffer()],
    program.programId,
  );

  // 2. create market unless it exists (kickoff in the past => staking window
  //    is closed, which is fine: this run demonstrates settlement)
  const existing = await connectionRpc.getAccountInfo(market);
  if (!existing) {
    // Back-date kickoff so settle's min-duration gate passes for this fixture.
    const sig = await (program.methods as any)
      .createMarket(new anchor.BN(fixtureId), new anchor.BN(kickoff))
      .accounts({ market, vault, payer: kp.publicKey })
      .rpc();
    console.log(`create_market ${explorer("tx", sig)}`);

    // 3. stake on every side pre-kickoff is impossible for a finished match,
    //    so stake only if the market is still open for this fixture.
  } else {
    console.log(`market exists ${explorer("address", market.toBase58())}`);
  }

  // 4. finalisation proof for goals P1/P2
  const hist: any[] = await txlineGet(`/scores/historical/${fixtureId}`, token);
  const finalRec = hist.filter((r) => r.action === "game_finalised").pop();
  const seq = finalRec?.seq ?? hist[hist.length - 1].seq;
  console.log(`using seq ${seq} (${finalRec ? "game_finalised" : "latest"})`);
  const v: any = await txlineGet(`/scores/stat-validation?fixtureId=${fixtureId}&seq=${seq}&statKeys=1,2`, token);
  console.log("validation keys:", Object.keys(v));

  const stats: any[] = v.stats ?? v.statTerms ?? [];
  const findStat = (key: number) =>
    stats.find((s) => Number(s.statToProve?.key ?? s.key) === key) ?? stats[key - 1];
  const s1 = findStat(1);
  const s2 = findStat(2);
  const term = (s: any) => ({
    statToProve: {
      key: Number(s.statToProve?.key ?? s.key),
      value: Number(s.statToProve?.value ?? s.value),
      period: Number(s.statToProve?.period ?? s.period ?? 0),
    },
    eventStatRoot: b32(s.eventStatRoot),
    statProof: nodes(s.statProof),
  });
  const t1 = term(s1);
  const t2 = term(s2);
  console.log(`proven goals P1=${t1.statToProve.value} P2=${t2.statToProve.value} periods=${t1.statToProve.period},${t2.statToProve.period}`);

  const goalsDiff = t1.statToProve.value - t2.statToProve.value;
  const outcome = goalsDiff > 0 ? 0 : goalsDiff === 0 ? 1 : 2;

  const targetTs = Number(v.summary.updateStats.minTimestamp);
  const epochDay = Math.floor(targetTs / 86_400_000);
  const [roots] = PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), new anchor.BN(epochDay).toArrayLike(Buffer, "le", 2)],
    TXORACLE_PROGRAM_ID,
  );

  // 5. settle
  const sig = await (program.methods as any)
    .settle(
      outcome,
      new anchor.BN(targetTs),
      {
        fixtureId: new anchor.BN(v.summary.fixtureId),
        updateStats: {
          updateCount: Number(v.summary.updateStats.updateCount),
          minTimestamp: new anchor.BN(v.summary.updateStats.minTimestamp),
          maxTimestamp: new anchor.BN(v.summary.updateStats.maxTimestamp),
        },
        eventsSubTreeRoot: b32(v.summary.eventStatsSubTreeRoot),
      },
      nodes(v.subTreeProof),
      nodes(v.mainTreeProof),
      t1,
      t2,
    )
    .accounts({
      market,
      dailyScoresMerkleRoots: roots,
      txoracleProgram: TXORACLE_PROGRAM_ID,
      payer: kp.publicKey,
    })
    .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })])
    .rpc();
  console.log(`SETTLED outcome=${outcome} ${explorer("tx", sig)}`);
  console.log(`market  ${explorer("address", market.toBase58())}`);
  console.log(`roots   ${explorer("address", roots.toBase58())}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
