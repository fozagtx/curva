# Pulse — feel the World Cup

A live second screen that turns TxLINE's consensus odds into something fans can *feel*:
a heartbeat for every match, and a game that dares you to beat the market.

Built for the TxODDS **Consumer and Fan Experiences** World Cup track on Superteam Earn.

## What it does

- **The wave** — live win probability for both teams (and the draw), streamed from
  TxLINE's StablePrice consensus odds. Goals, red cards and VAR reviews visibly
  lurch the wave the second they happen.
- **Drama meter** — a 0–100 read on how wild the match is right now, computed from
  market volatility plus event spikes with decay. Know which match to open.
- **Pulse Calls** — a free-to-play prediction game scored *against the market*, not
  against trivia: the market posts the leader's live win probability, you call
  HIGHER or LOWER for 8 match-minutes later. Streaks multiply points.
- **Provably real** — one tap asks the TxOracle Solana program (read-only
  `validateStat` view) to check the scoreline's Merkle proof against the root
  stored on-chain. The app never asks you to trust it.
- **Replay the drama** — any finished match can be re-streamed through the exact
  same pipeline at 30–120x from TxLINE historical data. Real data, real drama,
  minutes not hours.

## How TxLINE powers it

| Feature | TxLINE endpoint |
|---|---|
| Match lobby | `GET /api/fixtures/snapshot?competitionId=72` |
| Live odds → win probability | `GET /api/odds/stream` (SSE), `GET /api/odds/updates/{fixtureId}`, `GET /api/odds/snapshot/{fixtureId}` |
| Live match events | `GET /api/scores/stream` (SSE) |
| Catch-up when you join mid-match | `GET /api/scores/historical/{fixtureId}` |
| Replay engine | `GET /api/scores/historical/{fixtureId}` + `GET /api/odds/updates/{epochDay}/{hourOfDay}/{interval}` |
| On-chain verification | `GET /api/scores/stat-validation` + TxOracle `validateStat` view on devnet |
| Access | `POST /auth/guest/start` → on-chain `subscribe` (free World Cup tier) → `POST /api/token/activate` |

Win probabilities come from the feed's own de-margined `Pct` values on the 1X2
market (fallback: normalized 1/decimal-odds). The server consumes TxLINE SSE and
relays normalized events to the browser; replay uses the same reducer, so the
demo behaves byte-identically to live.

## Run it

```bash
pnpm install

# one-time: create devnet wallet, subscribe on-chain (free tier), activate API token
# (the wallet needs a little devnet SOL for the subscribe transaction fee)
pnpm tsx scripts/txline-setup.ts

pnpm dev
```

`scripts/txline-setup.ts` writes `.env.local` with `TXLINE_API_TOKEN` (and a JWT
the server refreshes automatically). Credentials stay server-side; the browser
only ever talks to this app.

## Stack

Next.js 16 · HeroUI v2 · Tailwind v4 · TxLINE (devnet) · Solana web3.js + Anchor ·
Phantom wallet connect
