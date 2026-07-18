// MatchEngine: one deterministic reducer used by both the live and replay paths.
// Feed it raw TxLINE records in timestamp order; it emits normalized PulseEvents
// that the client renders. No wall-clock reads — replay stays byte-identical.

import type { OddsPayload, ScoresRecord, Fixture, SoccerScore } from "../txline/types";
import { extractProbs, isMatchWinnerMarket, isStablePrice, type Probs } from "./probability";
import { toMatchEvent, clockMinute, type MatchEvent } from "./events";
import { DramaMeter } from "./drama";

export interface ScoreState {
  goals: [number, number];
  corners: [number, number];
  yellows: [number, number];
  reds: [number, number];
  penaltyGoals?: [number, number];
}

export interface FixtureMeta {
  fixtureId: number;
  competition: string;
  startTime: number;
  home: { id: number; name: string; parti: 1 | 2 };
  away: { id: number; name: string; parti: 1 | 2 };
}

export type PulseEvent =
  | { t: "hello"; fixture: FixtureMeta; mode: "live" | "replay"; speed?: number }
  | { t: "prob"; ts: number; probs: Probs; drama: number }
  | { t: "match"; ts: number; ev: MatchEvent; drama: number }
  | { t: "score"; ts: number; score: ScoreState; phase: string; minute?: number }
  | { t: "phase"; ts: number; phase: string; minute?: number }
  | { t: "end"; ts: number };

export function fixtureMeta(f: Fixture): FixtureMeta {
  const p1 = { id: f.Participant1Id, name: f.Participant1, parti: 1 as const };
  const p2 = { id: f.Participant2Id, name: f.Participant2, parti: 2 as const };
  return {
    fixtureId: f.FixtureId,
    competition: f.Competition,
    startTime: f.StartTime,
    home: f.Participant1IsHome ? p1 : p2,
    away: f.Participant1IsHome ? p2 : p1,
  };
}

function totalOf(s: { Total?: SoccerScore } | undefined): SoccerScore {
  return s?.Total ?? { Goals: 0, YellowCards: 0, RedCards: 0, Corners: 0 };
}

export class MatchEngine {
  private drama = new DramaMeter();
  private lastProbs: Probs | null = null;
  private lastScoreKey = "";
  private lastPhase = "";
  private seenEventIds = new Set<string>();
  private hasStableSource = false;

  ingestOdds(o: OddsPayload): PulseEvent[] {
    if (!isMatchWinnerMarket(o)) return [];
    // Prefer StablePrice consensus; once seen, ignore individual books.
    const stable = isStablePrice(o);
    if (stable) this.hasStableSource = true;
    else if (this.hasStableSource) return [];

    const probs = extractProbs(o);
    if (!probs) return [];
    // Drop sub-0.1pt jitter to keep the wire quiet
    if (this.lastProbs) {
      const delta = Math.abs(probs[0] - this.lastProbs[0])
        + Math.abs(probs[1] - this.lastProbs[1])
        + Math.abs(probs[2] - this.lastProbs[2]);
      if (delta < 0.001) return [];
    }
    const drama = this.drama.onProbs(o.Ts, probs);
    this.lastProbs = probs;
    return [{ t: "prob", ts: o.Ts, probs, drama }];
  }

  ingestScore(rec: ScoresRecord): PulseEvent[] {
    const out: PulseEvent[] = [];
    const minute = clockMinute(rec);

    if (rec.gameState && rec.gameState !== this.lastPhase) {
      this.lastPhase = rec.gameState;
      out.push({ t: "phase", ts: rec.ts, phase: rec.gameState, minute });
    }

    if (rec.scoreSoccer) {
      const p1 = totalOf(rec.scoreSoccer.Participant1);
      const p2 = totalOf(rec.scoreSoccer.Participant2);
      const pe1 = rec.scoreSoccer.Participant1?.PE?.Goals;
      const pe2 = rec.scoreSoccer.Participant2?.PE?.Goals;
      const score: ScoreState = {
        goals: [p1.Goals, p2.Goals],
        corners: [p1.Corners, p2.Corners],
        yellows: [p1.YellowCards, p2.YellowCards],
        reds: [p1.RedCards, p2.RedCards],
        ...(pe1 != null || pe2 != null
          ? { penaltyGoals: [pe1 ?? 0, pe2 ?? 0] as [number, number] }
          : {}),
      };
      const key = JSON.stringify(score);
      if (key !== this.lastScoreKey) {
        this.lastScoreKey = key;
        out.push({ t: "score", ts: rec.ts, score, phase: rec.gameState, minute });
      }
    }

    const ev = toMatchEvent(rec);
    if (ev && !this.seenEventIds.has(`${ev.id}:${ev.kind}:${ev.label}`)) {
      this.seenEventIds.add(`${ev.id}:${ev.kind}:${ev.label}`);
      const drama = this.drama.onEvent(rec.ts, ev.weight);
      out.push({ t: "match", ts: rec.ts, ev, drama });
    }
    return out;
  }
}

export function encodeSse(ev: PulseEvent): string {
  return `data: ${JSON.stringify(ev)}\n\n`;
}
