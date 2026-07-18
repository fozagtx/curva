# TxLINE API - Builder Feedback

Honest notes from integrating TxLINE end-to-end (auth → streams → historical →
validation proofs → CPI settlement) during the hackathon.

## What we loved

1. **`Pct` on the demargined StablePrice feed is a gift.** We got clean implied
 probabilities without writing any de-vig math. `TXLineStablePriceDemargined`
 with `1X2_PARTICIPANT_RESULT` is exactly what a consumer probability UI
 needs.
2. **The finalisation design is settlement-grade.** `game_finalised` records
 with `StatusId=100` and stat `period=100` gave us an unforgeable on-chain
 gate against early-proof attacks - our program simply requires period 100
 and the attack class disappears. Whoever designed that: thank you.
3. **`validate_stat` as a CPI target works beautifully.** One instruction, a
 returned bool, reasonable compute. Our whole settlement engine is ~40 lines
 around it. The two-stat `Subtract` predicate covers 1X2 in a single call.
4. **`llms.txt` and the docs repo.** Having the whole doc tree greppable (plus
 the runnable devnet scripts) made the auth flow a 30-minute job.
5. **Free World Cup tier with on-chain subscribe** is a genuinely nice
 permissionless onboarding story - no sales call, one transaction.

## Where we hit friction

1. **The OpenAPI schema doesn't match production for scores.** `docs.yaml`
 declares lowercase fields (`fixtureId`, `action`, `seq`, `scoreSoccer`) but
 the live feed sends PascalCase (`FixtureId`, `Action`, `Seq`, `Score`) with
 the phase in `StatusId`. We wrote types against the spec and rewrote them
 against reality.
2. **`/api/scores/historical/{id}` returns SSE-formatted text** (`data:` lines)
 with a JSON content story elsewhere - undocumented, and it breaks any plain
 `res.json()` client. Documenting it (or offering `?format=json`) would save
 every team an hour.
3. **The stat-validation V2 response shape is undocumented.** We had to
 discover `statsToProve[]` + `statProofs[][]` + a single shared
 `eventStatRoot` by probing. The docs' single-stat example
 (`statToProve`/`statProof`) doesn't match the `statKeys=` response.
4. **`GameState` on score records is misleading** - it stays `"scheduled"`
 during live play; the real phase lives in `StatusId`. A note in the soccer
 feed doc would help.
5. **Unconfirmed events carry empty `Data`**, so team attribution for a goal
 isn't in the goal record itself. We infer the team from score-counter deltas;
 an explicit `Participant` even on unconfirmed records would be nicer.
6. **Devnet onboarding needs devnet SOL** and the public faucet is often dry - 
 a tiny faucet or sponsor-funded airdrop for hackathon wallets would remove
 the only real onboarding wall.

## Small wishes

- Publish the `daily_scores_roots` anchoring cadence (how soon after
 `game_finalised` a proof becomes available) - it defines settlement latency.
- A WebSocket or SSE endpoint for fixtures (`GameState` transitions) so lobbies
 don't need to poll snapshots.
