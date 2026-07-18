// Open a market for an upcoming fixture and optionally stake on it.
// Run: pnpm tsx scripts/open-market.ts <fixtureId> [side amountSol]...
//   e.g. pnpm tsx scripts/open-market.ts 18257865 0 0.1 2 0.05

import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as fs from "fs";
import idl from "../src/lib/markets/curva-idl.json";
import { API_BASE_URL, JWT_URL, SOLANA_RPC, WORLD_CUP_COMPETITION_ID } from "../src/lib/txline/config";

function explorer(kind: string, id: string) {
  return `https://explorer.solana.com/${kind}/${id}?cluster=devnet`;
}

async function main() {
  const fixtureId = Number(process.argv[2]);
  if (!fixtureId) throw new Error("usage: open-market.ts <fixtureId> [side amountSol]...");
  const stakes: { side: number; amount: number }[] = [];
  for (let i = 3; i + 1 < process.argv.length + 1 && process.argv[i]; i += 2) {
    stakes.push({ side: Number(process.argv[i]), amount: Number(process.argv[i + 1]) });
  }

  const conn = new Connection(SOLANA_RPC, "confirmed");
  const kp = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(".keys/devnet-wallet.json", "utf8"))),
  );
  const provider = new anchor.AnchorProvider(conn, new anchor.Wallet(kp), { commitment: "confirmed" });
  anchor.setProvider(provider);
  const program = new anchor.Program(idl as anchor.Idl, provider);

  const jwtRes = await fetch(JWT_URL, { method: "POST" });
  const { token } = (await jwtRes.json()) as { token: string };
  const apiToken = fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .find((l) => l.startsWith("TXLINE_API_TOKEN="))!
    .slice("TXLINE_API_TOKEN=".length)
    .trim();
  const fres = await fetch(
    `${API_BASE_URL}/fixtures/snapshot?competitionId=${WORLD_CUP_COMPETITION_ID}`,
    { headers: { Authorization: `Bearer ${token}`, "X-Api-Token": apiToken } },
  );
  const fixtures = (await fres.json()) as any[];
  const fixture = fixtures.find((f) => f.FixtureId === fixtureId);
  if (!fixture) throw new Error(`fixture ${fixtureId} not found in snapshot`);
  console.log(`fixture ${fixtureId}: ${fixture.Participant1} vs ${fixture.Participant2}, kickoff ${new Date(fixture.StartTime).toISOString()}`);

  const [market] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), new anchor.BN(fixtureId).toArrayLike(Buffer, "le", 8)],
    program.programId,
  );
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), market.toBuffer()],
    program.programId,
  );

  if (!(await conn.getAccountInfo(market))) {
    const sig = await (program.methods as any)
      .createMarket(new anchor.BN(fixtureId), new anchor.BN(fixture.StartTime))
      .accounts({ market, vault, payer: kp.publicKey })
      .rpc();
    console.log(`create_market ${explorer("tx", sig)}`);
  } else {
    console.log(`market exists ${explorer("address", market.toBase58())}`);
  }

  for (const s of stakes) {
    const [position] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), market.toBuffer(), kp.publicKey.toBuffer(), Buffer.from([s.side])],
      program.programId,
    );
    const sig = await (program.methods as any)
      .stake(s.side, new anchor.BN(Math.round(s.amount * LAMPORTS_PER_SOL)))
      .accounts({ market, vault, position, owner: kp.publicKey })
      .rpc();
    console.log(`stake side=${s.side} ${s.amount} SOL ${explorer("tx", sig)}`);
  }

  const acc: any = await (program.account as any).market.fetch(market);
  console.log(`pools [P1, draw, P2] =`, acc.pools.map((p: anchor.BN) => Number(p) / LAMPORTS_PER_SOL));
  console.log(`market ${explorer("address", market.toBase58())}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
