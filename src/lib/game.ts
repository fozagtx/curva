"use client";

// Kryva Calls: beat-the-market prediction game.
// Every few match-minutes the market posts a line — the leader's live win
// probability. You call HIGHER or LOWER for where it sits N minutes later.
// Resolution uses only stream timestamps, so it works identically in replay.

import { useEffect, useMemo, useRef, useState } from "react";
import type { FixtureMeta } from "./engine/state";
import { homeAwayProbs, type ProbPoint } from "./usePulse";

export const CALL_WINDOW_MS = 8 * 60 * 1000;  // resolves 8 match-minutes later
export const CALL_COOLDOWN_MS = 2 * 60 * 1000; // pause between calls
const DEADBAND = 0.004; // |Δ| below this is a push

export type CallSide = "higher" | "lower";

export interface Call {
  id: string;
  fixtureId: number;
  team: "home" | "away";
  teamName: string;
  side: CallSide;
  prob0: number;
  ts0: number;
  resolveTs: number;
  // resolution
  prob1?: number;
  outcome?: "win" | "loss" | "push";
  points?: number;
}

export interface GameState {
  score: number;
  streak: number;
  bestStreak: number;
  history: Call[];
}

const EMPTY: GameState = { score: 0, streak: 0, bestStreak: 0, history: [] };

function storageKey(identity: string) {
  return `kryva-game:${identity}`;
}

export function loadGame(identity: string): GameState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(storageKey(identity));
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as GameState) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function saveGame(identity: string, state: GameState) {
  try {
    localStorage.setItem(
      storageKey(identity),
      JSON.stringify({ ...state, history: state.history.slice(-50) }),
    );
  } catch { /* storage full/blocked */ }
}

export function scoreCall(call: Call, prob1: number): Call {
  const delta = prob1 - call.prob0;
  if (Math.abs(delta) < DEADBAND) {
    return { ...call, prob1, outcome: "push", points: 0 };
  }
  const correct = call.side === "higher" ? delta > 0 : delta < 0;
  // Bigger moves against the crowd's comfort pay more.
  const points = correct ? 100 + Math.min(200, Math.round(Math.abs(delta) * 1500)) : 0;
  return { ...call, prob1, outcome: correct ? "win" : "loss", points };
}

export interface UseGameResult {
  game: GameState;
  activeCall: Call | null;
  lastResolved: Call | null;
  offer: { team: "home" | "away"; teamName: string; prob: number } | null;
  placeCall: (side: CallSide) => void;
  progress: number; // 0..1 toward resolution of active call
}

export function usePulseGame(
  fixtureId: number | null,
  meta: FixtureMeta | null,
  probs: ProbPoint[],
  phase: string,
  identity: string,
): UseGameResult {
  const [game, setGame] = useState<GameState>(EMPTY);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [lastResolved, setLastResolved] = useState<Call | null>(null);
  const cooldownUntil = useRef(0);

  useEffect(() => {
    setGame(loadGame(identity));
  }, [identity]);

  const latest = probs.length ? probs[probs.length - 1] : null;

  // Resolve the active call once stream time passes its window.
  useEffect(() => {
    if (!activeCall || !latest || !meta) return;
    if (latest.ts < activeCall.resolveTs) return;
    const ha = homeAwayProbs(meta, latest.probs);
    const prob1 = activeCall.team === "home" ? ha.home : ha.away;
    const resolved = scoreCall(activeCall, prob1);
    setActiveCall(null);
    setLastResolved(resolved);
    cooldownUntil.current = latest.ts + CALL_COOLDOWN_MS;
    setGame((prev) => {
      const win = resolved.outcome === "win";
      const streak = win ? prev.streak + 1 : resolved.outcome === "push" ? prev.streak : 0;
      const next: GameState = {
        score: prev.score + (resolved.points ?? 0) * (win ? Math.max(1, prev.streak + 1) : 1),
        streak,
        bestStreak: Math.max(prev.bestStreak, streak),
        history: [...prev.history, resolved],
      };
      saveGame(identity, next);
      return next;
    });
  }, [activeCall, latest, meta, identity]);

  const isLivePhase = ["H1", "H2", "ET1", "ET2"].includes(phase);

  const offer = useMemo(() => {
    if (!meta || !latest || !isLivePhase || activeCall) return null;
    if (latest.ts < cooldownUntil.current) return null;
    const ha = homeAwayProbs(meta, latest.probs);
    const team: "home" | "away" = ha.home >= ha.away ? "home" : "away";
    return {
      team,
      teamName: team === "home" ? meta.home.name : meta.away.name,
      prob: team === "home" ? ha.home : ha.away,
    };
  }, [meta, latest, isLivePhase, activeCall]);

  const placeCall = (side: CallSide) => {
    if (!offer || !latest || !fixtureId) return;
    setLastResolved(null);
    setActiveCall({
      id: `${fixtureId}:${latest.ts}`,
      fixtureId,
      team: offer.team,
      teamName: offer.teamName,
      side,
      prob0: offer.prob,
      ts0: latest.ts,
      resolveTs: latest.ts + CALL_WINDOW_MS,
    });
  };

  const progress = activeCall && latest
    ? Math.min(1, Math.max(0, (latest.ts - activeCall.ts0) / CALL_WINDOW_MS))
    : 0;

  return { game, activeCall, lastResolved, offer, placeCall, progress };
}
