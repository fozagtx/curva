"use client";

// Client hook consuming the Pulse SSE stream (live or replay).

import { useEffect, useReducer, useRef } from "react";
import type { PulseEvent, FixtureMeta, ScoreState } from "./engine/state";
import type { MatchEvent } from "./engine/events";

export interface ProbPoint {
  ts: number;
  probs: [number, number, number]; // [P1, draw, P2]
  drama: number;
}

export interface PulseState {
  meta: FixtureMeta | null;
  mode: "live" | "replay";
  speed?: number;
  probs: ProbPoint[];
  events: MatchEvent[];
  score: ScoreState | null;
  phase: string;
  minute?: number;
  drama: number;
  connected: boolean;
  ended: boolean;
  error: string | null;
}

const initialState: PulseState = {
  meta: null,
  mode: "live",
  probs: [],
  events: [],
  score: null,
  phase: "NS",
  drama: 0,
  connected: false,
  ended: false,
  error: null,
};

type Action =
  | { type: "reset" }
  | { type: "connected" }
  | { type: "disconnected" }
  | { type: "error"; message: string }
  | { type: "pulse"; ev: PulseEvent };

function reducer(state: PulseState, action: Action): PulseState {
  switch (action.type) {
    case "reset":
      return { ...initialState };
    case "connected":
      return { ...state, connected: true, error: null };
    case "disconnected":
      return { ...state, connected: false };
    case "error":
      return { ...state, error: action.message };
    case "pulse": {
      const ev = action.ev;
      switch (ev.t) {
        case "hello":
          return { ...state, meta: ev.fixture, mode: ev.mode, speed: ev.speed };
        case "prob": {
          const probs = [...state.probs, { ts: ev.ts, probs: ev.probs, drama: ev.drama }];
          return { ...state, probs, drama: ev.drama };
        }
        case "match": {
          const key = `${ev.ev.id}:${ev.ev.kind}:${ev.ev.label}`;
          if (state.events.some((e) => `${e.id}:${e.kind}:${e.label}` === key)) {
            return { ...state, drama: Math.max(state.drama, ev.drama) };
          }
          const events = [ev.ev, ...state.events].slice(0, 200);
          return { ...state, events, drama: Math.max(state.drama, ev.drama) };
        }
        case "score":
          return { ...state, score: ev.score, phase: ev.phase, minute: ev.minute };
        case "phase":
          return { ...state, phase: ev.phase, minute: ev.minute ?? state.minute };
        case "end":
          return { ...state, ended: true };
        default:
          return state;
      }
    }
    default:
      return state;
  }
}

export function usePulse(
  fixtureId: number | null,
  mode: "live" | "replay",
  speed?: number,
): PulseState {
  const [state, dispatch] = useReducer(reducer, initialState);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!fixtureId) return;
    dispatch({ type: "reset" });

    const url =
      mode === "replay"
        ? `/api/replay/${fixtureId}?speed=${speed ?? 60}`
        : `/api/live/${fixtureId}`;
    const source = new EventSource(url);
    sourceRef.current = source;

    source.onopen = () => dispatch({ type: "connected" });
    source.onmessage = (msg) => {
      try {
        dispatch({ type: "pulse", ev: JSON.parse(msg.data) as PulseEvent });
      } catch {
        // skip malformed frame
      }
    };
    source.addEventListener("stream_error", (msg) => {
      dispatch({ type: "error", message: String((msg as MessageEvent).data ?? "stream error") });
    });
    source.onerror = () => dispatch({ type: "disconnected" });

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [fixtureId, mode, speed]);

  return state;
}

// Home/away mapping helpers: engine probs are [P1, draw, P2] by participant slot.
export function homeAwayProbs(
  meta: FixtureMeta | null,
  probs: [number, number, number],
): { home: number; draw: number; away: number } {
  if (!meta || meta.home.parti === 1) {
    return { home: probs[0], draw: probs[1], away: probs[2] };
  }
  return { home: probs[2], draw: probs[1], away: probs[0] };
}

export function homeAwayScore(
  meta: FixtureMeta | null,
  pair: [number, number],
): [number, number] {
  if (!meta || meta.home.parti === 1) return pair;
  return [pair[1], pair[0]];
}
