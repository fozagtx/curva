# Curva — World Cup pools settled by proof

Parimutuel prediction pools for every World Cup match. Stake SOL on the result,
watch the market breathe in real time, and let **Solana settle the pot** — payouts
unlock only when TxLINE's Merkle proof of the final score verifies on-chain.

Built for the TxODDS **Prediction Markets and Settlement** World Cup track on
Superteam Earn.

## Why this is different

Most prediction markets trust an oracle operator or an admin multisig to report
results. Curva trusts **a cryptographic proof verified by the chain**:
`settle` CPIs into TxODDS's deployed TxOracle program (`validate_stat`), which
checks the proof of "P1 goals − P2 goals vs 0" against the daily Merkle root
TxODDS anchors on Solana. Nobody — including us — can settle a market wrong.

Three on-chain integrity gates in `settle` (see `program/programs/curva/src/lib.rs`):

1. **Finalisation-only stats** — the proven stats must carry the `period = 100`
   stamp that TxLINE puts only on `game_finalised` records, so a half-time
   snapshot can never settle a match that later flipped.
2. **Post-match proof window** — the proof's own `max_timestamp` (hashed into the
   commitment, unforgeable) must be at least 105 minutes past kickoff.
3. **Fixed stat identities** — keys must be exactly P1/P2 total goals so the
   `Subtract` predicate has one deterministic meaning.

## The product

- **Pools** — Home / Draw / Away parimutuel pools per fixture; stakes escrow in a
  program vault PDA; winners split the whole pot pro-rata; abandoned matches
  unlock refunds automatically after 72h.
- **The wave** — live win probability from TxLINE's StablePrice consensus odds,
  lurching visibly with goals, reds and VAR; pool-implied odds are shown next to
  the professional market's own numbers.
- **Verifiable resolution UI** — every settled market shows its receipt: the
  proven scoreline, the Merkle-root account, and the settle transaction, all
  linked to the explorer.
- **Replay** — any finished match re-streams through the same pipeline at
  30–120x from TxLINE historical data, so the experience is reviewable after
  the tournament ends.

## How TxLINE powers it

| Feature | TxLINE endpoint |
|---|---|
| Match lobby | `GET /api/fixtures/snapshot?competitionId=72` |
| Live odds → win probability | `GET /api/odds/stream` (SSE), `/api/odds/updates/{fixtureId}`, `/api/odds/snapshot/{fixtureId}` |
| Live match events | `GET /api/scores/stream` (SSE) |
| Mid-match catch-up + replay | `GET /api/scores/historical/{fixtureId}` + `/api/odds/updates/{epochDay}/{hourOfDay}/{interval}` |
| Settlement proofs | `GET /api/scores/stat-validation?fixtureId&seq&statKeys=1,2` |
| On-chain verification | TxOracle `validate_stat` via CPI (settlement) and read-only view (verify card) |
| Access | `POST /auth/guest/start` → on-chain `subscribe` (free World Cup tier) → `POST /api/token/activate` |

## Architecture

```
TxLINE SSE/REST ──► Next.js server (engine: odds→probability, drama, events)
                    │  /api/live /api/replay /api/matches      (SSE relay)
                    │  /api/settle-proof  (proof shaped as ix args)
                    ▼
             Browser (wave, pools, Phantom)
                    │ stake / settle / claim
                    ▼
        curva (Anchor, devnet) ── CPI ──► TxOracle validate_stat
                    │                                   │
                vault PDA                    daily_scores_roots PDA
```

## Run it

```bash
pnpm install

# one-time: devnet wallet -> on-chain TxLINE subscribe (free tier) -> API token
pnpm tsx scripts/txline-setup.ts

# program (requires solana + anchor toolchains and devnet SOL)
cd program && anchor build && anchor deploy && cd ..

# end-to-end settlement rehearsal on a real finished fixture
pnpm tsx scripts/settlement-e2e.ts

pnpm dev
```

## Stack

Next.js 16 · HeroUI v2 · Tailwind v4 · Anchor 0.32 (Rust) · TxLINE devnet ·
Solana web3.js · Phantom

> Curva: the terrace where football's most devoted fans stand — and the curve
> of live win probability this product is built around.
