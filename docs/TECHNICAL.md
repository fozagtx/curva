# Kryva - Technical Documentation

**Track:** TxODDS · Prediction Markets and Settlement (Superteam Earn, World Cup 2026)
**Live app:** https://getkryva.vercel.app
**Program (devnet):** `3L9Yb4AicTqnVCAV12R1enNW5dPZHHT26QtWNiQNP4xp`

## Core idea

Parimutuel prediction pools for every World Cup match where **settlement is a
cryptographic proof, not a promise**.

**No house. Fully verifiable. Pro-rata payouts + auto-refunds.** Stakes escrow
in a program vault PDA. When TxLINE finalises a match, anyone can trigger
`settle`: our program CPIs into TxODDS's deployed TxOracle program
(`validate_stat`), which verifies a Merkle proof of the final goal counts
against the daily scores root TxODDS anchors on-chain. Only if the chain
verifies the proof do funds unlock - no oracle operator, no admin key, no
trust in us. Wrong settlement is blocked by three on-chain integrity gates
(finalisation-only / post-match window / fixed stat IDs).

Hackathon deploy is **Solana devnet** (allowed). Mainnet path is unchanged
program logic: redeploy the Anchor program, point the client at a mainnet
RPC + TxLINE mainnet subscription, keep the same CPI into TxOracle
`validate_stat`.

## Receipts (all on devnet, all real World Cup data)

| Step | Link |
|---|---|
| England vs Argentina (real semifinal, 1-2) settled via CPI with TxLINE finalisation proof | [settle tx](https://explorer.solana.com/tx/4VwkVQmmB1McxjUivcpp6icEGPicAoo8oZWBYkYEmfNfqGKmM9aKq9uw2FRSieLPV2T6dwDwWTDG8zMQrNWU8trN?cluster=devnet) |
| Settled market account (outcome 2, goals 1-2 stored on-chain) | [market](https://explorer.solana.com/address/955uZjkKK4EqnmUFfVtHgWDqr85Wa1GouvMD9cQmgqV1?cluster=devnet) |
| France vs England market with live stakes | [market](https://explorer.solana.com/address/8VpmranXm2Fw24jNP9mwSPMA2LGqKtXYnwdzDNpVEjTF?cluster=devnet) |
| On-chain TxLINE subscription (free World Cup tier) | [subscribe tx](https://explorer.solana.com/tx/6Wv9ZAu4BJ5YS9rs9zm8QFkQqMKCGgQ9QKgfybDcbMi7RWeh3bz8Hch9Em9vw6v5xZu6AFkZYrwMoBVBCLuGWWf?cluster=devnet) |
| Program IDL published on-chain | account `8mq4RUAbBR3k6aouY6j17bdW8yPcFL8Didh85JhFkJo5` |

## The settlement program (`program/programs/curva/src/lib.rs`)

Four instructions, written to be audited:

- `create_market(fixture_id, kickoff_ts_ms)` - permissionless, one market per
 fixture (PDA-seeded), deterministic parameters.
- `stake(side, amount)` - escrows lamports in the vault PDA; closes at kickoff.
- `settle(outcome, ts, summary, proofs…, stat_p1, stat_p2)` - the core. One CPI
 into TxOracle `validate_stat` with predicate `(P1 goals - P2 goals) vs 0`
 (`Subtract` + `GreaterThan/EqualTo/LessThan` per claimed outcome). Three
 on-chain integrity gates make wrong settlement impossible:
 1. **Finalisation-only** - proven stats must carry `period == 100`, which
 TxLINE stamps only on `game_finalised` records. A half-time snapshot can
 never settle a match that later flipped.
 2. **Post-match window** - the proof's own `max_timestamp` (hashed into the
 Merkle commitment, unforgeable) must be ≥ 105 minutes after kickoff.
 3. **Fixed stat identities** - keys must be exactly 1 and 2 (P1/P2 total
 goals) so the subtraction has one deterministic meaning.
- `claim()` - winners split the whole pot pro-rata (u128 math, overflow
 checked); empty winning pool → full refunds; unsettleable markets (abandoned)
 unlock refunds automatically 72h after kickoff.

## Architecture

```
TxLINE SSE/REST ──► Next.js server (odds→probability engine, drama, events)
 │ /api/live /api/replay SSE relay to browsers
 │ /api/settle-proof proof shaped as ix args
 │ /api/market /api/verify chain reads, view checks
 ▼
 Browser (probability wave, pools, Phantom)
 │ stake / settle / claim (signed by the user)
 ▼
 curva program (devnet) ── CPI ──► TxOracle validate_stat
 │ │
 vault PDA daily_scores_roots PDA
```

- **Win probability** comes from TxLINE's `TXLineStablePriceDemargined`
 consensus feed (`Pct` values on the `1X2_PARTICIPANT_RESULT` market),
 normalized and streamed to the browser. Pool-implied multipliers are shown
 next to the professional market's numbers.
- **Replay**: any of the 104 finished matches re-streams through the identical
 engine at 30-120x from TxLINE historical data - the product stays fully
 reviewable after the tournament ends.
- **Live catch-up**: joining mid-match replays the full history first, so the
 wave always shows the whole story.

## TxLINE endpoints used (upstream)

| Purpose | Endpoint |
|---|---|
| Auth | `POST /auth/guest/start`, on-chain `subscribe` (free tier), `POST /api/token/activate` |
| Fixtures | `GET /api/fixtures/snapshot?competitionId=72[&startEpochDay]` |
| Odds | `GET /api/odds/stream` (SSE), `GET /api/odds/updates/{fixtureId}`, `GET /api/odds/updates/{epochDay}/{hourOfDay}/{interval}`, `GET /api/odds/snapshot/{fixtureId}` |
| Scores | `GET /api/scores/stream` (SSE), `GET /api/scores/historical/{fixtureId}`, `GET /api/scores/updates/{fixtureId}` |
| Settlement proofs | `GET /api/scores/stat-validation?fixtureId&seq&statKeys=1,2` |
| On-chain | TxOracle `validate_stat` - via CPI (settlement) and read-only `.view()` (verify card) |

## Kryva app routes (what the MVP exposes)

| Route | Role in the settlement loop |
|---|---|
| `GET /api/matches` | World Cup fixtures + market badges (lobby) |
| `GET /api/live/[fixtureId]` | SSE: catch-up + live TxLINE odds/scores → win-prob wave |
| `GET /api/replay/[fixtureId]?speed=` | SSE: same engine at 30-120× for finished matches |
| `GET /api/settle-proof/[fixtureId]` | Shapes TxLINE finalisation proof as `settle` ix args |
| `GET /api/market/[fixtureId]` | On-chain market + positions |
| `GET /api/verify/[fixtureId]` | Server read-only `validate_stat` check (UI also re-verifies in-browser) |
| `GET /api/portfolio` · `GET /api/stats` · `GET/POST /api/activity` | Hub / FOMO / verified activity |

Honest builder notes on SSE, schema friction, and proofs: [FEEDBACK.md](FEEDBACK.md).

## Tests & robustness

Automated unit/integration suite is not the primary gate for this hackathon
build. Robustness is exercised end-to-end against **real World Cup fixtures**:

| Check | How |
|---|---|
| Full settle path | `pnpm tsx scripts/settlement-e2e.ts [fixtureId]` - fetch proof → CPI `validate_stat` → market settled on-chain |
| Market open + stake | `pnpm tsx scripts/open-market.ts` |
| Live/replay pipeline | `/api/live` + `/api/replay` against TxLINE historical + SSE |
| Proof integrity | On-chain gates (period 100 / post-match window / fixed stat keys) + browser re-verify card |
| Receipt | England vs Argentina settle tx on explorer (see Receipts above) |

Program math uses checked `u128` pro-rata splits; empty winning side and
abandoned markets (72h) unlock refunds without an admin.

## Mainnet path

1. `anchor build && anchor deploy` against mainnet (new program id).
2. Swap RPC + update client IDL / program id constants.
3. TxLINE: mainnet `subscribe` + token activate (same auth flow as
 `scripts/txline-setup.ts`).
4. No settlement redesign - CPI target and the three gates stay identical.

## Business highlights

- **Fee-ready parimutuel design**: a protocol fee on winning pots is a one-line
 change; white-label the market layer for operators/media as B2B.
- **Trustless settlement is the moat**: operators today pay for result feeds
 AND carry oracle risk; Kryva's settlement cost is one transaction and the
 trust cost is zero.
- **The viewer doubles as content**: the probability wave + drama recap cards
 are shareable moments that market the pools.
