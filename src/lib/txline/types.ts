// TxLINE payload types, trimmed to what Pulse consumes.
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
  statusSoccerId?: unknown;
  clock?: FixtureClock;
  clockSoccer?: FixtureClock;
  scoreSoccer?: { Participant1: SoccerTotalScore; Participant2: SoccerTotalScore };
  dataSoccer?: SoccerData;
}

// Soccer game phases (statusId)
export const PHASE_NAMES: Record<number, string> = {
  1: "NS", 2: "H1", 3: "HT", 4: "H2", 5: "F",
  6: "WET", 7: "ET1", 8: "HTET", 9: "ET2", 10: "FET",
  11: "WPE", 12: "PE", 13: "FPE", 14: "I", 15: "A",
  16: "C", 17: "TXCC", 18: "TXCS", 19: "P",
};

export const FINISHED_PHASES = new Set(["F", "FET", "FPE", "A", "C"]);
export const LIVE_PHASES = new Set(["H1", "HT", "H2", "WET", "ET1", "HTET", "ET2", "WPE", "PE"]);
