// Turns TxLINE StablePrice odds records into win probabilities [P1, Draw, P2].
// Prefers the feed's own Pct (de-margined implied %) and falls back to
// normalizing 1/decimal-odds when Pct is absent.

import type { OddsPayload } from "../txline/types";

export type Probs = [number, number, number]; // [home-ish P1, draw, P2]

const DRAW_NAMES = new Set(["x", "draw", "tie"]);
const FULL_MATCH_PERIODS = new Set(["", "ft", "full time", "fulltime", "match", "0", "m", "reg"]);

// A 1X2 match-winner record: three prices whose middle (or one) outcome is the draw.
export function isMatchWinnerMarket(o: OddsPayload): boolean {
  const names = o.PriceNames;
  if (!names || names.length !== 3) return false;
  const period = (o.MarketPeriod ?? "").toLowerCase().trim();
  if (!FULL_MATCH_PERIODS.has(period) && !period.includes("full")) return false;
  return names.some((n) => DRAW_NAMES.has(n.toLowerCase().trim()));
}

export function extractProbs(o: OddsPayload): Probs | null {
  const names = o.PriceNames;
  if (!names || names.length !== 3) return null;

  let vals: number[] | null = null;

  if (o.Pct && o.Pct.length === 3 && o.Pct.every((p) => p !== "NA")) {
    vals = o.Pct.map((p) => parseFloat(p) / 100);
  } else if (o.Prices && o.Prices.length === 3 && o.Prices.every((p) => p > 1000)) {
    // decimal odds x1000 -> implied, then strip the overround
    vals = o.Prices.map((p) => 1000 / p);
  }
  if (!vals || vals.some((v) => !isFinite(v) || v <= 0)) return null;

  const sum = vals.reduce((a, b) => a + b, 0);
  if (sum <= 0) return null;
  const norm = vals.map((v) => v / sum);

  // Order into [P1, draw, P2] using the draw label position
  const drawIdx = names.findIndex((n) => DRAW_NAMES.has(n.toLowerCase().trim()));
  if (drawIdx === 1 || drawIdx === -1) {
    return [norm[0], norm[1], norm[2]] as Probs;
  }
  const rest = [0, 1, 2].filter((i) => i !== drawIdx);
  return [norm[rest[0]], norm[drawIdx], norm[rest[1]]] as Probs;
}

export function isStablePrice(o: OddsPayload): boolean {
  return /stable/i.test(o.Bookmaker ?? "");
}
