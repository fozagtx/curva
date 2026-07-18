// TxLINE devnet integration constants
// Docs: https://txline-docs.txodds.com/llms.txt

export const TXLINE_NETWORK = process.env.TXLINE_NETWORK ?? "devnet";

export const API_BASE_URL =
  TXLINE_NETWORK === "mainnet"
    ? "https://txline.txodds.com/api"
    : "https://txline-dev.txodds.com/api";

export const JWT_URL =
  TXLINE_NETWORK === "mainnet"
    ? "https://txline.txodds.com/auth/guest/start"
    : "https://txline-dev.txodds.com/auth/guest/start";

export const SOLANA_RPC =
  process.env.SOLANA_RPC ?? "https://api.devnet.solana.com";

export const TXORACLE_PROGRAM_ID = "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";
export const TXL_TOKEN_MINT = "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG";

// Free World Cup tier: service level 1 (devnet, samplingIntervalSec = 0)
export const FREE_SERVICE_LEVEL_ID = 1;
export const SUBSCRIPTION_WEEKS = 4; // must be a multiple of 4

// FIFA World Cup competition id in TxLINE
export const WORLD_CUP_COMPETITION_ID = 72;
