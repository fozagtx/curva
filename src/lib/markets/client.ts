"use client";

// Browser client for the curva program (devnet).
// Builds unsigned transactions; Phantom signs and sends them.

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { AnchorProvider, BN, BorshCoder, Program, type Idl } from "@coral-xyz/anchor";
import idl from "./curva-idl.json";

export const CURVA_PROGRAM_ID = new PublicKey((idl as { address: string }).address);
export const TXORACLE_PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
export const DEVNET_RPC = "https://api.devnet.solana.com";

export const SIDES = ["p1", "draw", "p2"] as const;
export type MarketSide = 0 | 1 | 2;

export interface MarketAccount {
  fixtureId: number;
  kickoffTsMs: number;
  pools: [number, number, number]; // lamports
  settled: boolean;
  outcome: MarketSide;
  goals: [number, number];
  settledTsMs: number;
  rootsAccount: string;
  address: string;
  vault: string;
}

export interface PositionAccount {
  side: MarketSide;
  amount: number;
  claimed: boolean;
  address: string;
}

export function connection(): Connection {
  return new Connection(DEVNET_RPC, "confirmed");
}

export function marketPda(fixtureId: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("market"), new BN(fixtureId).toArrayLike(Buffer, "le", 8)],
    CURVA_PROGRAM_ID,
  )[0];
}

export function vaultPda(market: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), market.toBuffer()],
    CURVA_PROGRAM_ID,
  )[0];
}

export function positionPda(market: PublicKey, owner: PublicKey, side: MarketSide): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), market.toBuffer(), owner.toBuffer(), Buffer.from([side])],
    CURVA_PROGRAM_ID,
  )[0];
}

export function dailyScoresRootsPda(targetTsMs: number): PublicKey {
  const epochDay = Math.floor(targetTsMs / 86_400_000);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), new BN(epochDay).toArrayLike(Buffer, "le", 2)],
    TXORACLE_PROGRAM_ID,
  )[0];
}

const coder = new BorshCoder(idl as Idl);

export async function fetchMarket(fixtureId: number): Promise<MarketAccount | null> {
  const market = marketPda(fixtureId);
  const info = await connection().getAccountInfo(market);
  if (!info) return null;
  const decoded = coder.accounts.decode("Market", info.data);
  return {
    fixtureId: Number(decoded.fixtureId),
    kickoffTsMs: Number(decoded.kickoffTsMs),
    pools: decoded.pools.map((p: BN) => Number(p)) as [number, number, number],
    settled: "settled" in decoded.state,
    outcome: (decoded.outcome ?? 0) as MarketSide,
    goals: decoded.goals as [number, number],
    settledTsMs: Number(decoded.settledTsMs),
    rootsAccount: decoded.rootsAccount.toBase58(),
    address: market.toBase58(),
    vault: vaultPda(market).toBase58(),
  };
}

export async function fetchPositions(
  fixtureId: number,
  owner: PublicKey,
): Promise<PositionAccount[]> {
  const market = marketPda(fixtureId);
  const conn = connection();
  const addresses = ([0, 1, 2] as MarketSide[]).map((s) => positionPda(market, owner, s));
  const infos = await conn.getMultipleAccountsInfo(addresses);
  const out: PositionAccount[] = [];
  infos.forEach((info, i) => {
    if (!info) return;
    const decoded = coder.accounts.decode("Position", info.data);
    out.push({
      side: i as MarketSide,
      amount: Number(decoded.amount),
      claimed: decoded.claimed,
      address: addresses[i].toBase58(),
    });
  });
  return out;
}

interface PhantomLike {
  publicKey: { toBase58(): string } | null;
  signAndSendTransaction(tx: Transaction): Promise<{ signature: string }>;
}

function program(owner: PublicKey): Program {
  // Provider only supplies the fee payer identity; Phantom does the signing.
  const provider = new AnchorProvider(
    connection(),
    {
      publicKey: owner,
      signTransaction: async <T,>(tx: T) => tx,
      signAllTransactions: async <T,>(txs: T[]) => txs,
    } as never,
    { commitment: "confirmed" },
  );
  return new Program(idl as Idl, provider);
}

async function finalize(tx: Transaction, owner: PublicKey, wallet: PhantomLike): Promise<string> {
  const conn = connection();
  tx.feePayer = owner;
  tx.recentBlockhash = (await conn.getLatestBlockhash("confirmed")).blockhash;
  const { signature } = await wallet.signAndSendTransaction(tx);
  await conn.confirmTransaction(signature, "confirmed");
  return signature;
}

export async function createMarketTx(
  wallet: PhantomLike,
  fixtureId: number,
  kickoffTsMs: number,
): Promise<string> {
  const owner = new PublicKey(wallet.publicKey!.toBase58());
  const market = marketPda(fixtureId);
  const ix = await program(owner)
    .methods.createMarket(new BN(fixtureId), new BN(kickoffTsMs))
    .accounts({
      market,
      vault: vaultPda(market),
      payer: owner,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  return finalize(new Transaction().add(ix), owner, wallet);
}

export async function stakeTx(
  wallet: PhantomLike,
  fixtureId: number,
  side: MarketSide,
  amountSol: number,
): Promise<string> {
  const owner = new PublicKey(wallet.publicKey!.toBase58());
  const market = marketPda(fixtureId);
  const ix = await program(owner)
    .methods.stake(side, new BN(Math.round(amountSol * LAMPORTS_PER_SOL)))
    .accounts({
      market,
      vault: vaultPda(market),
      position: positionPda(market, owner, side),
      owner,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  return finalize(new Transaction().add(ix), owner, wallet);
}

export interface SettleProof {
  outcome: MarketSide;
  targetTsMs: number;
  fixtureSummary: {
    fixtureId: number;
    updateStats: { updateCount: number; minTimestamp: number; maxTimestamp: number };
    eventsSubTreeRoot: number[];
  };
  fixtureProof: { hash: number[]; isRightSibling: boolean }[];
  mainTreeProof: { hash: number[]; isRightSibling: boolean }[];
  statP1: StatTermWire;
  statP2: StatTermWire;
}

interface StatTermWire {
  statToProve: { key: number; value: number; period: number };
  eventStatRoot: number[];
  statProof: { hash: number[]; isRightSibling: boolean }[];
}

function statTermArg(s: StatTermWire) {
  return {
    statToProve: {
      key: s.statToProve.key,
      value: s.statToProve.value,
      period: s.statToProve.period,
    },
    eventStatRoot: s.eventStatRoot,
    statProof: s.statProof.map((n) => ({ hash: n.hash, isRightSibling: n.isRightSibling })),
  };
}

export async function settleTx(wallet: PhantomLike, fixtureId: number, proof: SettleProof): Promise<string> {
  const owner = new PublicKey(wallet.publicKey!.toBase58());
  const market = marketPda(fixtureId);
  const ix = await program(owner)
    .methods.settle(
      proof.outcome,
      new BN(proof.targetTsMs),
      {
        fixtureId: new BN(proof.fixtureSummary.fixtureId),
        updateStats: {
          updateCount: proof.fixtureSummary.updateStats.updateCount,
          minTimestamp: new BN(proof.fixtureSummary.updateStats.minTimestamp),
          maxTimestamp: new BN(proof.fixtureSummary.updateStats.maxTimestamp),
        },
        eventsSubTreeRoot: proof.fixtureSummary.eventsSubTreeRoot,
      },
      proof.fixtureProof.map((n) => ({ hash: n.hash, isRightSibling: n.isRightSibling })),
      proof.mainTreeProof.map((n) => ({ hash: n.hash, isRightSibling: n.isRightSibling })),
      statTermArg(proof.statP1),
      statTermArg(proof.statP2),
    )
    .accounts({
      market,
      dailyScoresMerkleRoots: dailyScoresRootsPda(proof.targetTsMs),
      txoracleProgram: TXORACLE_PROGRAM_ID,
      payer: owner,
    })
    .instruction();
  const tx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }))
    .add(ix);
  return finalize(tx, owner, wallet);
}

export async function claimTx(wallet: PhantomLike, fixtureId: number, side: MarketSide): Promise<string> {
  const owner = new PublicKey(wallet.publicKey!.toBase58());
  const market = marketPda(fixtureId);
  const ix = await program(owner)
    .methods.claim()
    .accounts({
      market,
      vault: vaultPda(market),
      position: positionPda(market, owner, side),
      owner,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  return finalize(new Transaction().add(ix), owner, wallet);
}

export function lamportsToSol(l: number): string {
  return (l / LAMPORTS_PER_SOL).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function explorerUrl(kind: "address" | "tx", id: string): string {
  return `https://explorer.solana.com/${kind}/${id}?cluster=devnet`;
}
