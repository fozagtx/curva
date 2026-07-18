# Demo video plan (≤5 min, record tonight)

**The gift of the schedule:** France vs England kicks off **21:00 UTC July 18**
— our market is already open on-chain with stakes. Record the demo around it:
stake before kickoff, show the wave live during the match, settle + claim after
the final whistle (~23:00 UTC), all before the July 19 23:59 UTC deadline.

## Shot list (Problem → Solution → Demo → Impact)

1. **Hook (0:00–0:20)** — over the lobby: "Every prediction market has the same
   weak spot: someone you have to trust to say who won. Curva removes them.
   The referee is a cryptographic proof, verified by Solana itself."
2. **Stake (0:20–1:10)** — open France vs England, connect Phantom, stake on a
   side. Show the pool bars vs the professional market's consensus percentages.
   Mention: escrow is a program vault, nobody holds the keys.
3. **Live wave (1:10–2:10)** — during the match: the probability wave lurching
   on real events, drama meter, event ticker. One line: "This is TxLINE's
   StablePrice consensus, streamed straight onto the pitch."
4. **Settle (2:10–3:30)** — after full-time: press "Settle on Solana". Narrate
   what happens: the app fetches the finalisation Merkle proof from TxLINE, and
   our program CPIs into TxODDS's own on-chain program to verify it. Show the
   receipt: proven score, Merkle-root account, explorer transaction.
   **Backup if recording before full-time:** show the England vs Argentina
   semifinal — already settled on-chain — and walk the same receipt.
5. **Claim (3:30–4:00)** — winner presses Claim, SOL arrives. Show wallet
   balance change.
6. **Replay + close (4:00–4:45)** — flip a finished match into Replay 60x:
   "104 matches, every one replayable — judges can feel this product any time.
   And the settlement can't lie: not to you, not for us." Show the three gates
   in the program code for 5 seconds (period 100 / proof window / stat keys).

## Recording notes

- Phone-width browser window (390px) — the UI is mobile-first.
- Have `pnpm tsx scripts/settlement-e2e.ts 18257865` ready as fallback if
  Phantom misbehaves on camera — receipts print to the terminal.
- Keep the explorer tabs pre-opened (settle tx, market account, program).

## Submission checklist (Superteam Earn form)

- [ ] Demo video link (YouTube/Loom, ≤5 min)
- [ ] Public repo link (github.com/fozagtx/curva — push before submitting)
- [ ] App link: https://pulse-one-rose.vercel.app
- [ ] Technical doc: `docs/TECHNICAL.md` (endpoints list included)
- [ ] Feedback: `docs/FEEDBACK.md` (paste into the form's feedback field)
- [ ] Submit before **July 19, 23:59 UTC**
