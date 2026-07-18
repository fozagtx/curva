// Drama meter: how wild is this match right now? (0..100)
// Two ingredients:
//  1. Market volatility - decayed accumulation of win-probability movement.
//  2. Event spikes - goals/reds/VAR inject drama that decays with a half-life.

import type { Probs } from "./probability";

const HALF_LIFE_MS = 120_000;
const VOLATILITY_GAIN = 900;  // scales |Δprob| into drama points
const SPIKE_GAIN = 55;        // scales event weight (0..1) into drama points

export class DramaMeter {
  private level = 0;
  private lastTs = 0;
  private lastProbs: Probs | null = null;

  private decayTo(ts: number) {
    if (this.lastTs && ts > this.lastTs) {
      const dt = ts - this.lastTs;
      this.level *= Math.pow(0.5, dt / HALF_LIFE_MS);
    }
    this.lastTs = Math.max(this.lastTs, ts);
  }

  onProbs(ts: number, probs: Probs): number {
    this.decayTo(ts);
    if (this.lastProbs) {
      const delta =
        Math.abs(probs[0] - this.lastProbs[0]) +
        Math.abs(probs[2] - this.lastProbs[2]);
      this.level += delta * VOLATILITY_GAIN;
    }
    this.lastProbs = probs;
    return this.value();
  }

  onEvent(ts: number, weight: number): number {
    this.decayTo(ts);
    this.level += weight * SPIKE_GAIN;
    return this.value();
  }

  value(): number {
    return Math.round(Math.min(100, this.level));
  }
}
