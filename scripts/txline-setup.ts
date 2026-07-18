// One-shot TxLINE devnet onboarding:
//   wallet -> airdrop -> on-chain subscribe (free World Cup tier) -> API token -> data probe
// Run: pnpm tsx scripts/txline-setup.ts
// Idempotent: reuses saved wallet/auth when they still work.

import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import nacl from "tweetnacl";
import * as fs from "fs";
import * as path from "path";
import idl from "../src/lib/txline/txoracle-idl.json";
import {
  API_BASE_URL,
  JWT_URL,
  SOLANA_RPC,
  TXL_TOKEN_MINT,
  FREE_SERVICE_LEVEL_ID,
  SUBSCRIPTION_WEEKS,
  WORLD_CUP_COMPETITION_ID,
} from "../src/lib/txline/config";

const KEY_DIR = ".keys";
const KEY_PATH = path.join(KEY_DIR, "devnet-wallet.json");
const AUTH_PATH = ".txline-auth.json";

type AuthFile = { jwt: string; apiToken: string; txSig: string; wallet: string };

function loadOrCreateKeypair(): Keypair {
  if (fs.existsSync(KEY_PATH)) {
    const secret = Uint8Array.from(JSON.parse(fs.readFileSync(KEY_PATH, "utf8")));
    return Keypair.fromSecretKey(secret);
  }
  const kp = Keypair.generate();
  fs.mkdirSync(KEY_DIR, { recursive: true });
  fs.writeFileSync(KEY_PATH, JSON.stringify(Array.from(kp.secretKey)));
  console.log(`[wallet] Generated new devnet wallet at ${KEY_PATH}`);
  return kp;
}

async function getGuestJwt(): Promise<string> {
  const res = await fetch(JWT_URL, { method: "POST" });
  if (!res.ok) throw new Error(`guest/start failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { token: string };
  return body.token;
}

async function apiGet(pathname: string, jwt: string, apiToken: string) {
  const res = await fetch(`${API_BASE_URL}${pathname}`, {
    headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken },
  });
  return res;
}

async function ensureFunded(connection: Connection, kp: Keypair) {
  const balance = await connection.getBalance(kp.publicKey);
  console.log(`[wallet] ${kp.publicKey.toBase58()} balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  if (balance >= 0.05 * LAMPORTS_PER_SOL) return;
  console.log("[wallet] Requesting devnet airdrop (1 SOL)...");
  const sig = await connection.requestAirdrop(kp.publicKey, 1 * LAMPORTS_PER_SOL);
  const bh = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
  console.log("[wallet] Airdrop confirmed.");
}

async function subscribeOnChain(connection: Connection, kp: Keypair): Promise<string> {
  const wallet = new anchor.Wallet(kp);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program = new anchor.Program(idl as anchor.Idl, provider);
  const tokenMint = new PublicKey(TXL_TOKEN_MINT);

  const ata = getAssociatedTokenAddressSync(tokenMint, kp.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const ataInfo = await connection.getAccountInfo(ata);
  if (!ataInfo) {
    console.log("[chain] Creating Token-2022 ATA for TxL mint...");
    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        kp.publicKey, ata, kp.publicKey, tokenMint,
        TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
    await sendAndConfirmTransaction(connection, tx, [kp], { commitment: "confirmed" });
    console.log("[chain] ATA created.");
  }

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")], program.programId,
  );
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")], program.programId,
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    tokenMint, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID,
  );

  console.log(`[chain] subscribe(level=${FREE_SERVICE_LEVEL_ID}, weeks=${SUBSCRIPTION_WEEKS})...`);
  const tx = await (program.methods as any)
    .subscribe(FREE_SERVICE_LEVEL_ID, SUBSCRIPTION_WEEKS)
    .accounts({
      user: kp.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint,
      userTokenAccount: ata,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  const bh = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = bh.blockhash;
  tx.feePayer = kp.publicKey;
  tx.sign(kp);
  const txSig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(
    { signature: txSig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight },
    "confirmed",
  );
  console.log(`[chain] Subscribe confirmed: ${txSig}`);
  return txSig;
}

async function activate(jwt: string, txSig: string, kp: Keypair): Promise<string> {
  const leagues: number[] = [];
  const message = new TextEncoder().encode(`${txSig}:${leagues.join(",")}:${jwt}`);
  const walletSignature = Buffer.from(nacl.sign.detached(message, kp.secretKey)).toString("base64");
  const res = await fetch(`${API_BASE_URL}/token/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ txSig, walletSignature, leagues }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`activate failed: ${res.status} ${text}`);
  try {
    return (JSON.parse(text) as { token: string }).token ?? text;
  } catch {
    return text;
  }
}

async function probe(jwt: string, apiToken: string) {
  const res = await apiGet(
    `/fixtures/snapshot?competitionId=${WORLD_CUP_COMPETITION_ID}`,
    jwt, apiToken,
  );
  if (!res.ok) throw new Error(`fixtures probe failed: ${res.status} ${await res.text()}`);
  const fixtures = (await res.json()) as any[];
  console.log(`[probe] World Cup fixtures returned: ${fixtures.length}`);
  for (const f of fixtures.slice(0, 8)) {
    console.log("[probe] fixture sample:", JSON.stringify(f));
  }
  return fixtures;
}

async function main() {
  const connection = new Connection(SOLANA_RPC, "confirmed");
  const kp = loadOrCreateKeypair();

  // Reuse saved auth when it still works
  if (fs.existsSync(AUTH_PATH)) {
    const saved = JSON.parse(fs.readFileSync(AUTH_PATH, "utf8")) as AuthFile;
    const jwt = await getGuestJwt(); // fresh session; API token is the real credential
    const res = await apiGet(`/fixtures/snapshot?competitionId=${WORLD_CUP_COMPETITION_ID}`, jwt, saved.apiToken);
    if (res.ok) {
      console.log("[auth] Saved API token still valid. Refreshing JWT only.");
      const updated = { ...saved, jwt };
      fs.writeFileSync(AUTH_PATH, JSON.stringify(updated, null, 2));
      writeEnv(updated);
      const fixtures = (await res.json()) as any[];
      console.log(`[probe] World Cup fixtures returned: ${fixtures.length}`);
      for (const f of fixtures.slice(0, 8)) console.log("[probe] fixture sample:", JSON.stringify(f));
      return;
    }
    console.log(`[auth] Saved token rejected (${res.status}). Re-running full flow.`);
  }

  await ensureFunded(connection, kp);
  const jwt = await getGuestJwt();
  console.log("[auth] Guest JWT acquired.");
  const txSig = await subscribeOnChain(connection, kp);
  const apiToken = await activate(jwt, txSig, kp);
  console.log(`[auth] API token acquired: ${apiToken.slice(0, 12)}...`);

  const auth: AuthFile = { jwt, apiToken, txSig, wallet: kp.publicKey.toBase58() };
  fs.writeFileSync(AUTH_PATH, JSON.stringify(auth, null, 2));
  writeEnv(auth);
  console.log(`[auth] Saved to ${AUTH_PATH} and .env.local`);

  await probe(jwt, apiToken);
}

function writeEnv(auth: AuthFile) {
  const lines = [
    `TXLINE_JWT=${auth.jwt}`,
    `TXLINE_API_TOKEN=${auth.apiToken}`,
    `TXLINE_WALLET=${auth.wallet}`,
    `TXLINE_SUBSCRIBE_TXSIG=${auth.txSig}`,
  ];
  fs.writeFileSync(".env.local", lines.join("\n") + "\n");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
