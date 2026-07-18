# Kryva

Trustless parimutuel World Cup prediction pools on Solana, settled by cryptographic proof via TxODDS / TxLINE.

Fans stake SOL on Home / Draw / Away for any of the 104 World Cup matches. Stakes escrow in a program-owned vault. Live win probability streams from TxLINE StablePrice consensus. When a match finalises, **the pot settles itself**: anyone submits a TxLINE Merkle proof of the final score, the program CPIs into TxOracle `validate_stat`, and funds move only if the chain verifies it. No house, no oracle operator, no admin key. Every claim links to an explorer receipt, and the UI can re-verify the proof from your own browser.

Built for the TxODDS **Prediction Markets and Settlement** track (World Cup hackathon, Superteam Earn).

**Live app:** https://getkryva.vercel.app  
**Program (devnet):** `3L9Yb4AicTqnVCAV12R1enNW5dPZHHT26QtWNiQNP4xp`  
**Repo note:** product brand is Kryva; folder / Vercel project / on-chain crate name remain `curva` for the hackathon deploy.

## How It Works

1. **Open a market.** Anyone opens the pool for a fixture. One click, permissionless, one market per fixture (PDA-seeded, deterministic parameters).
2. **Stake.** Pick Home / Draw / Away and stake SOL through Phantom. Lamports escrow in a vault PDA nobody controls. Staking closes at kickoff. Every position is a public pre-commitment on the ledger before the result exists.
3. **Watch.** The match screen streams live win probability from TxLINE StablePrice consensus, plus a drama meter and event ticker. Pool-implied multipliers sit next to the professional market numbers.
4. **Settle.** After the final whistle, anyone presses Settle on Solana. The app fetches the finalisation Merkle proof from TxLINE. The program CPIs into TxOracle `validate_stat`. The chain checks the proof against the daily scores root TxODDS anchors on-chain. Valid proof locks the outcome. Invalid or non-final proof always fails.
5. **Claim.** Winners split the whole pot pro-rata. Empty winning side refunds everyone. Unsettleable / abandoned markets unlock automatic refunds after 72 hours.

## Settlement Integrity (3 gates)

```
outcome predicate: (P1 goals - P2 goals) {>, =, <} 0
judged by TxOracle on-chain via CPI validate_stat
```

Three on-chain gates make wrong settlement impossible rather than unlikely:

| Gate | What it enforces |
|------|------------------|
| **Finalisation-only** | Proven stats must carry `period = 100`, stamped by TxLINE only on `game_finalised` records. A half-time snapshot can never settle a match that later flipped. |
| **Post-match window** | The proof's own `max_timestamp` (hashed into the Merkle commitment, unforgeable) must be >= 105 minutes after kickoff. |
| **Fixed stat identities** | Stat keys must be exactly P1/P2 total goals, so the subtraction has one deterministic meaning. |

Full methodology: [docs/TECHNICAL.md](docs/TECHNICAL.md)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Program | Anchor 0.32 (Rust), Solana devnet, CPI into TxOracle `validate_stat` |
| Frontend | Next.js 16, React 19, HeroUI v2, Tailwind v4 |
| Server | Next.js route handlers (SSE relay, proof shaping, chain reads) |
| Data | TxLINE (fixtures, StablePrice odds SSE, scores SSE, historical, stat-validation proofs) |
| Wallet | Phantom (`signAndSendTransaction`) |
| Package | pnpm |

## Screenshots

### Lobby

![Lobby with live, upcoming and finished World Cup matches](docs/screenshots/lobby.png)

Tournament-style match feed. Live, upcoming, and finished fixtures with pool badges.

### Market

![1X2 odds selector with live consensus percentages and stake controls](docs/screenshots/market.png)

1X2 stake controls with live consensus percentages beside the vault pools.

### The wave

![Win probability curve for England vs Argentina with goal markers and recap](docs/screenshots/wave.png)

Live win-probability curve from a real semifinal, with goal markers and drama recap.

### Trustless resolution receipt

![Settled market with proven score, Merkle root link and in-browser verification](docs/screenshots/receipt.png)

Settled market with proven score, Merkle-root account, explorer tx, and in-browser verify.

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- Solana CLI + Anchor 0.32 (program rebuild / redeploy only)
- A little Solana devnet SOL

### Setup

```bash
# Install dependencies
pnpm install

# One-time: wallet -> on-chain TxLINE subscribe (free World Cup tier) -> API token
pnpm tsx scripts/txline-setup.ts
# Writes .env.local. Token stays server-side. Browser never talks to TxLINE.

# Program (already deployed; rebuild only if you change it)
cd program && anchor build && anchor deploy && cd ..

# End-to-end settlement rehearsal against a real finished fixture
pnpm tsx scripts/settlement-e2e.ts

# App
pnpm dev
```

App: http://localhost:3000

### Open a market / rehearse settle

```bash
pnpm tsx scripts/open-market.ts
pnpm tsx scripts/settlement-e2e.ts [fixtureId]
```

## Key Features

- **Trustless parimutuel pools.** Vault PDA escrow, pro-rata payouts, automatic refunds for abandoned matches. No admin can move funds or decide outcomes.
- **Proof-based settlement.** Permissionless `settle` CPIs into TxODDS's oracle program. Proven on devnet against the real England vs Argentina semifinal ([settle tx](https://explorer.solana.com/tx/4VwkVQmmB1McxjUivcpp6icEGPicAoo8oZWBYkYEmfNfqGKmM9aKq9uw2FRSieLPV2T6dwDwWTDG8zMQrNWU8trN?cluster=devnet)).
- **Three integrity gates.** Finalisation-only, post-match window, fixed P1/P2 goal stats. Wrong settlement fails on-chain.
- **The wave.** Live win-probability curve from TxLINE StablePrice consensus. Goals, reds, and VAR move it in real time. Drama meter + event ticker beside it.
- **Verifiable resolution UI.** Proven score, Merkle-root account, settle transaction, explorer links.
- **Don't-trust-us verify.** One click re-runs `validate_stat` from your browser against Solana. Our servers never touch the verdict.
- **Replay engine.** Any finished match re-streams through the identical pipeline at 30-120x from TxLINE historical data.
- **Live catch-up.** Joining mid-match replays full history first so the wave always shows the whole story.
- **Kryva Calls.** Risk-free beat-the-market call game beside the real SOL pools.
- **Hub + FOMO.** Portfolio / claims hub, hottest pools, kickoff countdowns, verified on-chain activity (not fake counts).
- **Mainnet path.** Same program + CPI. Redeploy Anchor binary, point RPC + TxLINE at mainnet. No settlement redesign.

## API

| Route | Purpose |
|-------|---------|
| `GET /api/matches` | All World Cup fixtures (live / upcoming / finished) + market badges |
| `GET /api/live/[fixtureId]` | SSE: catch-up + live relay of normalized match events |
| `GET /api/replay/[fixtureId]?speed=60` | SSE: historical re-stream through the same engine |
| `GET /api/market/[fixtureId]?owner=` | Market account + caller positions (server-side chain read) |
| `GET /api/settle-proof/[fixtureId]` | Finalisation Merkle proof shaped as `settle` instruction args |
| `GET /api/verify/[fixtureId]` | Server-side read-only `validate_stat` check |
| `GET /api/portfolio` | Wallet positions across markets |
| `GET /api/stats` | Protocol TVL / open markets / settlements |
| `GET` / `POST /api/activity` | Verified on-chain activity feed |

Program instructions: `create_market`, `stake`, `settle`, `claim`. See [program/programs/curva/src/lib.rs](program/programs/curva/src/lib.rs).

TxLINE upstream endpoints (auth, fixtures, odds SSE, scores SSE, `stat-validation`) are listed in [docs/TECHNICAL.md](docs/TECHNICAL.md#txline-endpoints-used-upstream).

## Project Structure

```
curva/
├── program/                    # Anchor workspace
│   ├── programs/curva/         # Settlement program (4 instructions, 3 integrity gates)
│   └── idls/txoracle.json      # TxOracle IDL for declare_program! CPI bindings
├── src/
│   ├── app/                    # Next.js pages + API routes (live, replay, market, proofs, hub)
│   ├── components/             # Lobby, market card, wave, ticker, verify, Kryva Calls
│   └── lib/
│       ├── engine/             # Odds->probability, drama meter, event mapper, reducer
│       ├── markets/            # Program client, browser-side proof verification
│       ├── txline/             # Auth, REST+SSE client, feed normalization
│       └── fomo.ts             # Countdown / urgency / social proof helpers
├── scripts/
│   ├── txline-setup.ts         # Wallet -> on-chain subscribe -> API token
│   ├── open-market.ts          # Open a market (+ optional stakes) for a fixture
│   └── settlement-e2e.ts       # Full settlement rehearsal on a real fixture
└── docs/                       # Technical doc, TxLINE feedback, demo plan, screenshots
```

## Tests & Robustness

No separate Jest suite for the hackathon cut. Correctness is proven against **live World Cup data** on devnet:

| Check | How |
|-------|-----|
| Full settle path | `pnpm tsx scripts/settlement-e2e.ts [fixtureId]` |
| Market open + stake | `pnpm tsx scripts/open-market.ts` |
| Live / replay pipeline | `/api/live` + `/api/replay` against TxLINE |
| Proof integrity | On-chain gates + browser Verify card |
| Receipt | England vs Argentina settle tx on explorer |

Details + mainnet path: [docs/TECHNICAL.md](docs/TECHNICAL.md#tests--robustness).

## Documentation

| Document | Description |
|----------|-------------|
| [Technical Overview](docs/TECHNICAL.md) | Architecture, settlement design, receipts, TxLINE + app endpoints, mainnet path |
| [TxLINE Feedback](docs/FEEDBACK.md) | What we loved, where we hit friction |
| [Demo Plan](docs/DEMO.md) | Demo video shot list and submission checklist |
| [UX Profile](docs/UX_PROFILE.md) | Product rules, FOMO layer, visual system |

## World Cup Track Submission (copy-paste)

Social / X fields omitted. Fill those yourself.

| Form field | Value |
|---|---|
| **Link to Your Submission** | https://getkryva.vercel.app |
| **Project Title** | Kryva |
| **Briefly explain your Project** | *(paste block below)* |
| **Link to your live & working MVP** | https://getkryva.vercel.app |
| **Link to Your Live Demo Video** | `TODO` - add public Loom/YouTube after recording ([shot list](docs/DEMO.md)) |
| **Project's Public Repository** | https://github.com/fozagtx/curva |
| **Link to Technical Documentation** | https://github.com/fozagtx/curva/blob/main/docs/TECHNICAL.md |
| **TxLINE API experience** | *(paste short version below; full: [docs/FEEDBACK.md](docs/FEEDBACK.md))* |
| **Anything Else?** | *(paste extras below)* |

### Briefly explain your Project

```
Kryva is a trustless parimutuel World Cup 1X2 prediction market on Solana. No house, fully verifiable, pro-rata payouts + auto-refunds.

Fans stake SOL on Home / Draw / Away into a program-owned vault. Live win probability streams from TxLINE StablePrice SSE. After finalisation, anyone settles via CPI into TxODDS TxOracle validate_stat with a TxLINE Merkle proof. Three on-chain integrity gates make wrong settlement impossible: finalisation-only (period=100), post-match proof window, fixed P1/P2 goal stat IDs. The UI re-verifies the proof in the browser. Finished matches replay through the same engine.

Built for the TxODDS Prediction Markets and Settlement track (experimental verification layer + permissionless results validation + custom on-chain settlement). Proven on devnet against England vs Argentina. Mainnet path = redeploy same program + switch RPC/TxLINE. No settlement redesign.
```

### TxLINE API experience (paste into form)

```
Endpoints we use (TxLINE): auth/guest/start + on-chain subscribe + token/activate; fixtures/snapshot; odds/stream + odds/updates + odds/snapshot; scores/stream + scores/historical + scores/updates; scores/stat-validation (settlement proofs); TxOracle validate_stat via CPI + .view().

Our MVP routes: /api/matches, /api/live/[fixtureId], /api/replay/[fixtureId], /api/settle-proof/[fixtureId], /api/market/[fixtureId], /api/verify/[fixtureId].

Liked most:
- Pct on TXLineStablePriceDemargined (1X2_PARTICIPANT_RESULT): clean implied probs, no de-vig math.
- Finalisation design (game_finalised / period=100): unforgeable on-chain gate against early-proof attacks.
- validate_stat as a CPI target: one instruction, returned bool; our settle path is ~40 lines around it.
- llms.txt + docs repo + free World Cup tier with on-chain subscribe: permissionless onboarding.

Friction:
- OpenAPI scores schema does not match production (camelCase vs PascalCase; phase in StatusId).
- /api/scores/historical/{id} returns SSE-formatted text while other endpoints feel like JSON.
- Stat-validation V2 shape (statsToProve / statProofs / eventStatRoot) undocumented vs single-stat examples.
- GameState stays "scheduled" during live play; real phase is StatusId.
- Unconfirmed goal events often lack team attribution in Data; we infer from score deltas.
- Devnet SOL faucet often dry: only real onboarding wall.

Full write-up: docs/FEEDBACK.md in the repo.
```

### Anything Else?

```
Live app: https://getkryva.vercel.app
Repo: https://github.com/fozagtx/curva
Tech doc: https://github.com/fozagtx/curva/blob/main/docs/TECHNICAL.md
Program (devnet): 3L9Yb4AicTqnVCAV12R1enNW5dPZHHT26QtWNiQNP4xp
England vs Argentina settle tx: https://explorer.solana.com/tx/4VwkVQmmB1McxjUivcpp6icEGPicAoo8oZWBYkYEmfNfqGKmM9aKq9uw2FRSieLPV2T6dwDwWTDG8zMQrNWU8trN?cluster=devnet
Settled market account: https://explorer.solana.com/address/955uZjkKK4EqnmUFfVtHgWDqr85Wa1GouvMD9cQmgqV1?cluster=devnet

Trustless pitch for judges:
- No house / no admin key: vault PDA escrow, permissionless settle + claim
- Pro-rata winner payouts; auto-refunds if abandoned (72h) or empty winning side
- 3 integrity gates: finalisation-only, post-match window, fixed stat IDs
- Client-side proof re-verification + replay engine for any finished fixture
- Robustness: scripts/settlement-e2e.ts against real World Cup fixtures (not mock data)
- Mainnet path documented: same CPI settlement, redeploy + RPC/TxLINE switch
```

## License

MIT
