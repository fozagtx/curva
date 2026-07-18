// Maps raw TxLINE score records to display-ready match events.

import type { ScoresRecord } from "../txline/types";

export type MatchEventKind =
  | "goal" | "own_goal" | "penalty_goal"
  | "yellow_card" | "red_card"
  | "corner" | "shot_on_target" | "shot_woodwork"
  | "var" | "var_end"
  | "penalty_awarded" | "penalty_missed"
  | "substitution" | "kickoff" | "halftime" | "fulltime"
  | "phase" | "danger" | "injury";

export interface MatchEvent {
  id: string;           // stable id for dedupe/amend (fixture:actionId)
  kind: MatchEventKind;
  team?: 1 | 2;
  minute?: number;
  phase?: string;
  label: string;
  detail?: string;
  confirmed: boolean;
  ts: number;
  weight: number;       // 0..1 drama contribution
}

const PHASE_LABELS: Record<string, string> = {
  H1: "First half", HT: "Half-time", H2: "Second half", F: "Full-time",
  WET: "Waiting for extra time", ET1: "Extra time - first half",
  HTET: "Extra time break", ET2: "Extra time - second half",
  FET: "Full-time (AET)", WPE: "Penalty shootout coming", PE: "Penalty shootout",
  FPE: "Decided on penalties", NS: "Not started",
};

export function clockMinute(rec: ScoresRecord): number | undefined {
  const clock = rec.clockSoccer ?? rec.clock;
  const seconds = clock?.seconds ?? clock?.Seconds;
  if (seconds == null) return undefined;
  return Math.max(1, Math.ceil(seconds / 60));
}

export function toMatchEvent(rec: ScoresRecord, inferredTeam?: 1 | 2): MatchEvent | null {
  const d = rec.dataSoccer ?? {};
  const team =
    d.Participant === 1 || d.Participant === 2
      ? (d.Participant as 1 | 2)
      : inferredTeam;
  const minute = clockMinute(rec);
  const base = {
    id: `${rec.fixtureId}:${rec.id}`,
    team,
    minute,
    phase: rec.gameState,
    confirmed: rec.confirmed !== false,
    ts: rec.ts,
  };

  switch (rec.action) {
    case "goal": {
      const own = d.GoalType === "Own";
      const pen = d.GoalType === "Penalty" || d.Penalty === true;
      return {
        ...base,
        kind: own ? "own_goal" : pen ? "penalty_goal" : "goal",
        label: own ? "Own goal" : pen ? "Penalty goal" : "GOAL",
        detail: d.GoalType && !own && !pen ? d.GoalType : undefined,
        weight: 1,
      };
    }
    case "yellow_card":
      return { ...base, kind: "yellow_card", label: "Yellow card", weight: 0.25 };
    case "red_card":
      return { ...base, kind: "red_card", label: "Red card", weight: 0.9 };
    case "corner":
      return { ...base, kind: "corner", label: "Corner", weight: 0.15 };
    case "shot": {
      if (d.Outcome === "OnTarget")
        return { ...base, kind: "shot_on_target", label: "Shot on target", weight: 0.3 };
      if (d.Outcome === "Woodwork")
        return { ...base, kind: "shot_woodwork", label: "Off the woodwork!", weight: 0.55 };
      return null; // off target / blocked: too noisy for the ticker
    }
    case "var":
      return {
        ...base, kind: "var",
        label: "VAR review",
        detail: d.Type ? `Checking: ${spaceOut(d.Type)}` : undefined,
        weight: 0.7,
      };
    case "var_end":
      return {
        ...base, kind: "var_end",
        label: d.Outcome === "Overturned" ? "VAR: decision overturned" : "VAR: decision stands",
        weight: d.Outcome === "Overturned" ? 0.8 : 0.3,
      };
    case "penalty_attempt":
      return { ...base, kind: "penalty_awarded", label: "PENALTY", weight: 0.9 };
    case "penalty_outcome": {
      if (d.Outcome === "Scored") return null; // the goal event carries it
      if (d.Outcome === "Missed")
        return { ...base, kind: "penalty_missed", label: "Penalty missed!", weight: 0.85 };
      return null;
    }
    case "substitution":
      return { ...base, kind: "substitution", label: "Substitution", weight: 0.05 };
    case "kickoff":
      return { ...base, kind: "kickoff", label: "Kick-off", weight: 0.1 };
    case "free_kick": {
      if (d.FreeKickType === "HighDanger")
        return { ...base, kind: "danger", label: "Dangerous free kick", weight: 0.35 };
      return null;
    }
    case "injury":
      return { ...base, kind: "injury", label: "Injury concern", weight: 0.15 };
    case "status": {
      const label = PHASE_LABELS[rec.gameState];
      if (!label) return null;
      const kind: MatchEventKind =
        rec.gameState === "HT" ? "halftime"
        : rec.gameState === "F" || rec.gameState === "FET" || rec.gameState === "FPE" ? "fulltime"
        : "phase";
      return { ...base, kind, team: undefined, label, weight: kind === "fulltime" ? 0.5 : 0.2 };
    }
    default:
      return null;
  }
}

function spaceOut(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, "$1 $2");
}
