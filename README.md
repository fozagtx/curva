# Kryva

Trustless parimutuel World Cup 1X2 pools on Solana. Stake SOL, watch live win probability from TxLINE, settle with a Merkle proof via CPI into TxOracle `validate_stat`. No house, no admin key, pro-rata payouts + auto-refunds.

Built for the TxODDS **Prediction Markets and Settlement** track (Superteam Earn).

| | |
|---|---|
| **App** | https://getkryva.vercel.app |
| **Repo** | https://github.com/fozagtx/curva |
| **Program (devnet)** | `3L9Yb4AicTqnVCAV12R1enNW5dPZHHT26QtWNiQNP4xp` |
| **Settle receipt** | [England vs Argentina on explorer](https://explorer.solana.com/tx/4VwkVQmmB1McxjUivcpp6icEGPicAoo8oZWBYkYEmfNfqGKmM9aKq9uw2FRSieLPV2T6dwDwWTDG8zMQrNWU8trN?cluster=devnet) |

Product brand is **Kryva**. Repo folder / Vercel project / on-chain crate still use `curva` for the hackathon deploy.

## How It Works

1. **Open** a market for a fixture (permissionless, one PDA per match).
2. **Stake** SOL on Home / Draw / Away into a vault PDA. Closes at kickoff.
3. **Watch** live win probability (TxLINE StablePrice), drama meter, event ticker.
4. **Settle** after final whistle: TxLINE finalisation proof → CPI `validate_stat` → outcome locks on-chain.
5. **Claim** pro-rata. Abandoned markets refund after 72h.

Three integrity gates block bad settles: finalisation-only (`period = 100`), post-match proof window, fixed P1/P2 goal stats. Full design: [docs/TECHNICAL.md](docs/TECHNICAL.md).

## How TxLINE Is Used

| Job | What we call |
|-----|----------------|
| Fixtures | `GET /api/fixtures/snapshot` |
| Live odds | `GET /api/odds/stream` (SSE) + updates / snapshot |
| Live scores | `GET /api/scores/stream` (SSE) + historical / updates |
| Settlement proof | `GET /api/scores/stat-validation?statKeys=1,2` |
| On-chain verify | TxOracle `validate_stat` (CPI + browser `.view()`) |

Auth: guest start → on-chain World Cup subscribe → token activate. Full endpoint list, app routes, and mainnet path: [docs/TECHNICAL.md](docs/TECHNICAL.md). Honest liked / friction notes: [docs/FEEDBACK.md](docs/FEEDBACK.md).

## Tech Stack

| Layer | Stack |
|-------|--------|
| Program | Anchor 0.32, Solana devnet, CPI → TxOracle |
| App | Next.js 16, React 19, HeroUI, Tailwind |
| Data | TxLINE REST + SSE |
| Wallet | Phantom |

## Screenshots

| Lobby | Wave | Receipt |
|-------|------|---------|
| ![lobby](docs/screenshots/lobby.png) | ![wave](docs/screenshots/wave.png) | ![receipt](docs/screenshots/receipt.png) |

## Quick Start

```bash
pnpm install
pnpm tsx scripts/txline-setup.ts   # writes .env.local (server-side token)
pnpm tsx scripts/settlement-e2e.ts # optional: prove settle against a real fixture
pnpm dev                           # http://localhost:3000
```

Needs Node 18+, pnpm, and a little devnet SOL for the one-time TxLINE subscribe.

## Docs

| Doc | What |
|-----|------|
| [Technical](docs/TECHNICAL.md) | Architecture, gates, TxLINE + app endpoints, tests, mainnet |
| [TxLINE feedback](docs/FEEDBACK.md) | Earn form: liked + friction |
| [Submission paste](docs/SUBMISSION.md) | Ready answers for the Superteam form |
| [Demo plan](docs/DEMO.md) | Video shot list |

## License

MIT
