# World Cup Track Submission (copy-paste)

Social / X fields omitted. Fill those yourself.

| Form field | Value |
|---|---|
| **Link to Your Submission** | https://getkryva.vercel.app |
| **Project Title** | Kryva |
| **Briefly explain your Project** | *(paste block below)* |
| **Link to your live & working MVP** | https://getkryva.vercel.app |
| **Link to Your Live Demo Video** | `TODO` - add public Loom/YouTube after recording ([DEMO.md](DEMO.md)) |
| **Project's Public Repository** | https://github.com/fozagtx/curva |
| **Link to Technical Documentation** | https://github.com/fozagtx/curva/blob/main/docs/TECHNICAL.md |
| **TxLINE API experience** | *(paste short version below; full: [FEEDBACK.md](FEEDBACK.md))* |
| **Anything Else?** | *(paste extras below)* |

## Briefly explain your Project

```
Kryva is a trustless parimutuel World Cup 1X2 prediction market on Solana. No house, fully verifiable, pro-rata payouts + auto-refunds.

Fans stake SOL on Home / Draw / Away into a program-owned vault. Live win probability streams from TxLINE StablePrice SSE. After finalisation, anyone settles via CPI into TxODDS TxOracle validate_stat with a TxLINE Merkle proof. Three on-chain integrity gates make wrong settlement impossible: finalisation-only (period=100), post-match proof window, fixed P1/P2 goal stat IDs. The UI re-verifies the proof in the browser. Finished matches replay through the same engine.

Built for the TxODDS Prediction Markets and Settlement track. Proven on devnet against England vs Argentina. Mainnet path = redeploy same program + switch RPC/TxLINE.
```

## TxLINE API experience (paste into form)

```
Endpoints we use (TxLINE): auth/guest/start + on-chain subscribe + token/activate; fixtures/snapshot; odds/stream + odds/updates + odds/snapshot; scores/stream + scores/historical + scores/updates; scores/stat-validation (settlement proofs); TxOracle validate_stat via CPI + .view().

Our MVP routes: /api/matches, /api/live/[fixtureId], /api/replay/[fixtureId], /api/settle-proof/[fixtureId], /api/market/[fixtureId], /api/verify/[fixtureId].

Liked most:
- Pct on TXLineStablePriceDemargined (1X2_PARTICIPANT_RESULT): clean implied probs, no de-vig math.
- Finalisation design (game_finalised / period=100): unforgeable on-chain gate against early-proof attacks.
- validate_stat as a CPI target: one instruction, returned bool; settle path is ~40 lines around it.
- Free World Cup tier with on-chain subscribe: permissionless onboarding.

Friction:
- OpenAPI scores schema does not match production (camelCase vs PascalCase; phase in StatusId).
- /api/scores/historical/{id} returns SSE-formatted text while other endpoints feel like JSON.
- Stat-validation V2 shape undocumented vs single-stat examples.
- GameState stays "scheduled" during live play; real phase is StatusId.
- Devnet SOL faucet often dry.

Full write-up: docs/FEEDBACK.md
```

## Anything Else?

```
Live app: https://getkryva.vercel.app
Repo: https://github.com/fozagtx/curva
Tech doc: https://github.com/fozagtx/curva/blob/main/docs/TECHNICAL.md
Program (devnet): 3L9Yb4AicTqnVCAV12R1enNW5dPZHHT26QtWNiQNP4xp
Settle tx (England vs Argentina): https://explorer.solana.com/tx/4VwkVQmmB1McxjUivcpp6icEGPicAoo8oZWBYkYEmfNfqGKmM9aKq9uw2FRSieLPV2T6dwDwWTDG8zMQrNWU8trN?cluster=devnet
```
