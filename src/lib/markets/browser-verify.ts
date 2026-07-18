"use client";

// In-browser proof verification: YOUR browser asks Solana devnet directly
// whether the TxLINE Merkle proof of the final score validates against the
// on-chain root. The proof payload comes from /api/settle-proof (TxLINE
// credentials live server-side), but the verdict is computed by the TxOracle
// program over your own RPC connection - our backend never touches it.

import { Connection, PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import { AnchorProvider, BN, Program, type Idl } from "@coral-xyz/anchor";
import txoracleIdl from "./txoracle-idl.json";
import { DEVNET_RPC, dailyScoresRootsPda, type SettleProof } from "./client";

export interface BrowserVerifyResult {
 isValid: boolean;
 goals: [number, number];
 rootsAccount: string;
 rpc: string;
}

// Simulation fee payer: must be a funded account for the RPC to simulate, but
// nothing is ever signed or sent - any public funded address works.
const SIM_PAYER = new PublicKey("3MTbC3TnVgCeMMmzqwm1GqAopVQ7DLBqVfV4bY8XdXsU");

export async function verifyInBrowser(proof: SettleProof): Promise<BrowserVerifyResult> {
 const connection = new Connection(DEVNET_RPC, "confirmed");
 const wallet = {
 publicKey: SIM_PAYER,
 signTransaction: async <T,>(tx: T) => tx,
 signAllTransactions: async <T,>(txs: T[]) => txs,
 };
 const provider = new AnchorProvider(connection, wallet as never, { commitment: "confirmed" });
 const program = new Program(txoracleIdl as Idl, provider);

 const roots = dailyScoresRootsPda(proof.targetTsMs);
 const node = (n: { hash: number[]; isRightSibling: boolean }) => ({
 hash: n.hash,
 isRightSibling: n.isRightSibling,
 });
 const term = (s: SettleProof["statP1"]) => ({
 statToProve: { key: s.statToProve.key, value: s.statToProve.value, period: s.statToProve.period },
 eventStatRoot: s.eventStatRoot,
 statProof: s.statProof.map(node),
 });

 // Prove the exact goal counts: (P1 - P2) == observed difference.
 const diff = proof.statP1.statToProve.value - proof.statP2.statToProve.value;
 const isValid: boolean = await (program.methods as never as {
 validateStat: (...args: unknown[]) => {
 accounts: (a: Record<string, PublicKey>) => {
 preInstructions: (ix: unknown[]) => { view: () => Promise<boolean> };
 };
 };
 })
 .validateStat(
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
 proof.fixtureProof.map(node),
 proof.mainTreeProof.map(node),
 { threshold: diff, comparison: { equalTo: {} } },
 term(proof.statP1),
 term(proof.statP2),
 { subtract: {} },
 )
 .accounts({ dailyScoresMerkleRoots: roots })
 .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })])
 .view();

 return {
 isValid,
 goals: [proof.statP1.statToProve.value, proof.statP2.statToProve.value],
 rootsAccount: roots.toBase58(),
 rpc: DEVNET_RPC,
 };
}
