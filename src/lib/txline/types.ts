// TxLINE payload types, trimmed to what Kryva consumes.
// Source: https://txline.txodds.com/docs/docs.yaml + soccer feed spec v1.1

export interface Fixture {
  Ts: number;
  StartTime: number; // ms epoch
  Competition: string;
  CompetitionId: number;
  FixtureGroupId: number;
  Participant1Id: number;
  Participant1: string;
  Participant2Id: number;
  Participant2: string;
  FixtureId: number;
  Participant1IsHome: boolean;
}

export interface OddsPayload {
  FixtureId: number;
  MessageId: string;
  Ts: number; // ms epoch
  Bookmaker: string;
  BookmakerId: number;
  SuperOddsType: string;
  GameState?: string;
  InRunning: boolean;
  MarketParameters?: string;
  MarketPeriod?: string;
  PriceNames?: string[];
  Prices?: number[]; // decimal odds x1000
  Pct?: string[]; // implied % as "52.632", or "NA"
}

export interface SoccerScore {
  Goals: number;
  YellowCards: number;
  RedCards: number;
  Corners: number;
}

export interface SoccerTotalScore {
  H1?: SoccerScore;
  HT?: SoccerScore;
  H2?: SoccerScore;
  ET1?: SoccerScore;
  ET2?: SoccerScore;
  PE?: SoccerScore;
  ETTotal?: SoccerScore;
  Total?: SoccerScore;
}

export interface SoccerData {
  Action?: string;
  Color?: string;
  Corner?: boolean;
  FreeKickType?: string; // Safe | Attack | Danger | HighDanger | Offside
  Goal?: boolean;
  GoalType?: string; // Shot | Head | Own | Other
  Minutes?: number;
  Outcome?: string; // shot: OnTarget/OffTarget/Woodwork/Blocked; penalty: Scored/Missed/Retake; var_end: Stands/Overturned
  Participant?: number; // 1 | 2
  Penalty?: boolean;
  PlayerId?: number;
  PlayerInId?: number;
  PlayerOutId?: number;
  StatusId?: number;
  Text?: string;
  Type?: string; // var: Goal/Penalty/RedCard/SecondYellowCard/CornerKick/...
  RedCard?: boolean;
  YellowCard?: boolean;
  VAR?: boolean;
}

export interface FixtureClock {
  running?: boolean;
  seconds?: number;
  Running?: boolean;
  Seconds?: number;
}

export interface ScoresRecord {
  fixtureId: number;
  gameState: string;
  startTime: number;
  isTeam: boolean;
  fixtureGroupId: number;
  competitionId: number;
  countryId: number;
  sportId: number;
  participant1IsHome: boolean;
  participant1Id: number;
  participant2Id: number;
  action: string;
  id: number;
  ts: number; // ms epoch
  connectionId: number;
  seq: number;
  confirmed?: boolean;
  statusId?: number;
  stats?: Record<string, number>;
  clock?: FixtureClock;
  clockSoccer?: FixtureClock;
  scoreSoccer?: { Participant1: SoccerTotalScore; Participant2: SoccerTotalScore };
  dataSoccer?: SoccerData;
}

// Soccer game phases (statusId). 100 = game_finalised.
export const PHASE_NAMES: Record<number, string> = {
  1: "NS", 2: "H1", 3: "HT", 4: "H2", 5: "F",
  6: "WET", 7: "ET1", 8: "HTET", 9: "ET2", 10: "FET",
  11: "WPE", 12: "PE", 13: "FPE", 14: "I", 15: "A",
  16: "C", 17: "TXCC", 18: "TXCS", 19: "P", 100: "F",
};

export const FINISHED_PHASES = new Set(["F", "FET", "FPE", "A", "C"]);
export const LIVE_PHASES = new Set(["H1", "HT", "H2", "WET", "ET1", "HTET", "ET2", "WPE", "PE"]);

// The live feed serializes records in PascalCase (FixtureId, Action, Seq, Score,
// Clock, Data, Stats) with the phase in StatusId - the OpenAPI's lowercase
// schema does not match production. This normalizer accepts both shapes and
// produces the internal ScoresRecord the engine consumes.
export function normalizeScoresRecord(input: unknown): ScoresRecord | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw feed record
  const raw = input as Record<string, any>;
  if (!raw || typeof raw !== "object") return null;
  const fixtureId = raw.FixtureId ?? raw.fixtureId;
  const action = raw.Action ?? raw.action;
  if (fixtureId == null || !action) return null;

  const statusId: number | undefined =
    raw.StatusId ?? raw.statusId ?? raw.Data?.StatusId ?? undefined;
  const clock = raw.Clock ?? raw.clockSoccer ?? raw.clock;

  return {
    fixtureId: Number(fixtureId),
    gameState:
      (statusId != null ? PHASE_NAMES[statusId] : undefined) ??
      (typeof raw.gameState === "string" && PHASE_NAMES_SET.has(raw.gameState)
        ? raw.gameState
        : ""), // unknown -> engine keeps the last known phase
    startTime: Number(raw.StartTime ?? raw.startTime ?? 0),
    isTeam: Boolean(raw.IsTeam ?? raw.isTeam ?? true),
    fixtureGroupId: Number(raw.FixtureGroupId ?? raw.fixtureGroupId ?? 0),
    competitionId: Number(raw.CompetitionId ?? raw.competitionId ?? 0),
    countryId: Number(raw.CountryId ?? raw.countryId ?? 0),
    sportId: Number(raw.SportId ?? raw.sportId ?? 0),
    participant1IsHome: Boolean(raw.Participant1IsHome ?? raw.participant1IsHome ?? true),
    participant1Id: Number(raw.Participant1Id ?? raw.participant1Id ?? 0),
    participant2Id: Number(raw.Participant2Id ?? raw.participant2Id ?? 0),
    action: String(action),
    id: Number(raw.Id ?? raw.id ?? 0),
    ts: Number(raw.Ts ?? raw.ts ?? 0),
    connectionId: Number(raw.ConnectionId ?? raw.connectionId ?? 0),
    seq: Number(raw.Seq ?? raw.seq ?? 0),
    confirmed: raw.Confirmed ?? raw.confirmed,
    statusId,
    clockSoccer: clock
      ? {
          running: clock.Running ?? clock.running,
          seconds: clock.Seconds ?? clock.seconds,
        }
      : undefined,
    scoreSoccer: raw.Score ?? raw.scoreSoccer,
    dataSoccer: raw.Data ?? raw.dataSoccer,
    stats: raw.Stats ?? raw.stats,
  };
}

const PHASE_NAMES_SET = new Set(Object.values(PHASE_NAMES));

// SSE-formatted text ("data: {...}" blocks) -> parsed records. The historical
// scores endpoint responds in this format rather than a JSON array.
export function parseSseText(text: string): unknown[] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data: "))
    .map((line) => {
      try {
        return JSON.parse(line.slice(6));
      } catch {
        return null;
      }
    })
    .filter((x) => x != null);
}
