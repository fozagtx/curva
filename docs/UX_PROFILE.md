# Kryva UX Profile — TikTok × SportyBet Prediction Market

> If TikTok and SportyBet shipped a World Cup prediction market settled on Solana, this is how it feels.

## One-liner

**Swipe matches like TikTok. Bet outcomes like SportyBet. Settlement is a proof, not a house.**

## User

- Phone in hand, match night energy
- Knows 1X2 (Home / Draw / Away) — does not know Merkle proofs
- Will swipe 8 matches in 30 seconds; will only open 1–2
- Trusts green odds buttons more than whitepapers

## Product rules

1. **Dense sportsbook, not TikTok wallpaper.** Compact lists + one featured card; never full-viewport empty slides.
2. **Odds first.** 1X2 tiles are the hero; wallet/proof are secondary.
3. **Thumb zone.** Primary CTA is bottom-center, full width, green.
4. **White by default.** Bright sportsbook light — dark is opt-in later, not the brand.
5. **Two lanes, labeled.** Real SOL stake vs risk-free Kryva Calls — never mix copy.
6. **Proof is a receipt, not a lecture.** Show verify after they care about the pot.
7. **FOMO is real data.** Countdown to kick-off, “just staked” from on-chain activity, hottest pool — never fake user counts.

## FOMO layer

| Cue | When | Where |
|-----|------|--------|
| Live KO countdown | Upcoming match | Feed chip + market card |
| “LOCKS Mm:Ss” | < 30 min to KO | Red solid chip + pulsing CTA |
| Social ticker | Recent stake/create txs | Intro + per-match feed |
| Hottest pool | Largest SOL vault in feed | Fire badge |
| Urgency CTA copy | hot / closing | “Get in before kick-off” / “Stake now — closing” |

## Session loop

```
Swipe feed → tap 1X2 / Open → stake SOL → (optional) Call Higher/Lower
→ watch curve during match → settle → claim in Hub
```

## Screen map

| Screen | Job | Scroll model |
|--------|-----|----------------|
| Lobby feed | Discover + pick a match | Vertical snap (TikTok) |
| Match · Play | Score + 1X2 stake | Snap panel 1 |
| Match · Curve | Wave + Calls | Snap panel 2 |
| Match · Proof | Verify + receipts | Snap panel 3 |
| Hub | My stakes / claims | Short list (no snap) |

## Visual system

- **Ground:** pure white `#FFFFFF`
- **Ink:** near-black `#09090B`
- **Accent:** SportyBet-adjacent green `#16A34A` (primary CTA)
- **Away accent:** sky `#0EA5E9` for team 2 only
- **Live:** red pulse chip, not red backgrounds
- **Type:** IBM Plex Sans / Mono — bold prices, quiet labels
- **Cards:** light gray borders, almost no shadow; odds tiles are the “cards”

## Copy voice

- Short. Fan, not protocol engineer.
- Prefer: “Stake France”, “Open match”, “Claim”
- Avoid: “parimutuel”, “CPI”, “Merkle” in the first viewport (keep for Proof panel)

## Success feel

User can explain Kryva in one sentence after 20 seconds:

> “I swipe World Cup matches, put SOL on 1X2, and Solana pays me when the score is proven.”
