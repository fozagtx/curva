// DEV HARNESS ONLY — never used in the product or demo.
// Simulates TxLINE's documented endpoints and payload shapes so the full
// pipeline (auth, snapshots, SSE streams, engine, UI) can be exercised
// end-to-end before real credentials exist.
//
// Run:  pnpm tsx scripts/mock-txline.ts            (port 4600, 30x speed)
// App:  TXLINE_API_BASE=http://localhost:4600/api \
//       TXLINE_JWT_URL=http://localhost:4600/auth/guest/start \
//       TXLINE_API_TOKEN=mock pnpm dev --port 3457

import http from "http";

const PORT = 4600;
const SPEED = 30;
const FIXTURE_ID = 90000001;
const KICKOFF = Date.now() - 30 * 60 * 1000; // 30 real minutes ago -> lobby shows LIVE

interface OddsItem {
  FixtureId: number; MessageId: string; Ts: number; Bookmaker: string;
  BookmakerId: number; SuperOddsType: string; GameState?: string;
  InRunning: boolean; MarketPeriod: string; PriceNames: string[];
  Prices: number[]; Pct: string[];
}
interface ScoreItem { [k: string]: unknown; ts: number; seq: number }

const fixture = {
  Ts: KICKOFF - 86400000,
  StartTime: KICKOFF,
  Competition: "FIFA World Cup",
  CompetitionId: 72,
  FixtureGroupId: 9000,
  Participant1Id: 101,
  Participant1: "France",
  Participant2Id: 102,
  Participant2: "Brazil",
  FixtureId: FIXTURE_ID,
  Participant1IsHome: true,
};

// ---- deterministic match script (match-clock seconds -> events) ----------
interface Beat { sec: number; action: string; parti?: 1 | 2; data?: Record<string, unknown>; phase?: string; goals?: [number, number]; corners?: [number, number]; yellows?: [number, number] }
const SCRIPT: Beat[] = [
  { sec: 0, action: "kickoff", parti: 1, phase: "H1" },
  { sec: 300, action: "corner", parti: 2, corners: [0, 1] },
  { sec: 540, action: "shot", parti: 1, data: { Outcome: "OnTarget" } },
  { sec: 780, action: "free_kick", parti: 2, data: { FreeKickType: "HighDanger" } },
  { sec: 1080, action: "goal", parti: 1, data: { GoalType: "Shot" }, goals: [1, 0] },
  { sec: 1500, action: "yellow_card", parti: 2, yellows: [0, 1] },
  { sec: 1860, action: "corner", parti: 1, corners: [1, 1] },
  { sec: 2100, action: "var", parti: 2, data: { Type: "Penalty" } },
  { sec: 2220, action: "var_end", parti: 2, data: { Outcome: "Overturned" } },
  { sec: 2700, action: "status", phase: "HT" },
  { sec: 2760, action: "status", phase: "H2" },
  { sec: 3300, action: "goal", parti: 2, data: { GoalType: "Head" }, goals: [1, 1] },
  { sec: 3900, action: "shot", parti: 2, data: { Outcome: "Woodwork" } },
  { sec: 4260, action: "red_card", parti: 1 },
  { sec: 4800, action: "goal", parti: 2, data: { GoalType: "Shot" }, goals: [1, 2] },
  { sec: 5640, action: "status", phase: "F" },
];

// probability regimes between beats (P1 win prob drifts toward target)
const PROB_TARGETS: { sec: number; p1: number; draw: number }[] = [
  { sec: 0, p1: 0.44, draw: 0.27 },
  { sec: 1080, p1: 0.68, draw: 0.19 },   // France goal
  { sec: 2100, p1: 0.62, draw: 0.2 },    // VAR scare
  { sec: 3300, p1: 0.41, draw: 0.3 },    // Brazil equalizer
  { sec: 4260, p1: 0.26, draw: 0.3 },    // France red card
  { sec: 4800, p1: 0.07, draw: 0.09 },   // Brazil 2-1
];

function targetAt(sec: number) {
  let cur = PROB_TARGETS[0];
  for (const t of PROB_TARGETS) if (sec >= t.sec) cur = t;
  return cur;
}

function phaseAt(sec: number): string {
  if (sec >= 5640) return "F";
  if (sec >= 2760) return "H2";
  if (sec >= 2700) return "HT";
  return "H1";
}

// pre-build full timelines
const oddsTimeline: OddsItem[] = [];
const scoresTimeline: ScoreItem[] = [];

let seq = 0;
let goals: [number, number] = [0, 0];
let corners: [number, number] = [0, 0];
let yellows: [number, number] = [0, 0];
let reds: [number, number] = [0, 0];

function scoreSoccer() {
  const mk = (i: 0 | 1) => ({
    Total: { Goals: goals[i], YellowCards: yellows[i], RedCards: reds[i], Corners: corners[i] },
  });
  return { Participant1: mk(0), Participant2: mk(1) };
}

for (const beat of SCRIPT) {
  seq += 1;
  if (beat.goals) goals = beat.goals;
  if (beat.corners) corners = beat.corners;
  if (beat.yellows) yellows = beat.yellows;
  if (beat.action === "red_card" && beat.parti) reds[beat.parti - 1] += 1;
  scoresTimeline.push({
    fixtureId: FIXTURE_ID,
    gameState: beat.phase ?? phaseAt(beat.sec),
    startTime: KICKOFF,
    isTeam: true,
    fixtureGroupId: 9000,
    competitionId: 72,
    countryId: 1,
    sportId: 6,
    participant1IsHome: true,
    participant1Id: 101,
    participant2Id: 102,
    action: beat.action,
    id: 1000 + seq,
    ts: KICKOFF + beat.sec * 1000,
    connectionId: 7,
    seq,
    confirmed: true,
    clockSoccer: { running: true, seconds: beat.sec },
    scoreSoccer: scoreSoccer(),
    dataSoccer: { Participant: beat.parti, ...(beat.data ?? {}) },
  });
}

// odds every 20 match-seconds with noise + regime drift
let p1 = 0.44;
let draw = 0.27;
let seed = 42;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2 ** 31;
  return seed / 2 ** 31;
};
for (let sec = -600; sec <= 5640; sec += 20) {
  const t = targetAt(Math.max(0, sec));
  p1 += (t.p1 - p1) * 0.08 + (rand() - 0.5) * 0.012;
  draw += (t.draw - draw) * 0.08 + (rand() - 0.5) * 0.006;
  const p2 = Math.max(0.02, 1 - p1 - draw);
  const sum = p1 + draw + p2;
  const pct = [p1 / sum, draw / sum, p2 / sum];
  oddsTimeline.push({
    FixtureId: FIXTURE_ID,
    MessageId: `m${sec}`,
    Ts: KICKOFF + sec * 1000,
    Bookmaker: "StablePrice",
    BookmakerId: 1,
    SuperOddsType: "1X2",
    GameState: phaseAt(Math.max(0, sec)),
    InRunning: sec >= 0,
    MarketPeriod: "FT",
    PriceNames: ["1", "X", "2"],
    Prices: pct.map((p) => Math.round(1000 / p)),
    Pct: pct.map((p) => (p * 100).toFixed(3)),
  });
}

const simStart = Date.now();
const simNow = () => KICKOFF + (Date.now() - simStart) * SPEED + 15 * 60 * 1000 * SPEED * 0; // starts at kickoff

// second fixture: already finished match for replay testing
const FIXTURE2_ID = 90000002;
const fixture2 = { ...fixture, FixtureId: FIXTURE2_ID, Participant1: "Spain", Participant2: "England", Participant1Id: 103, Participant2Id: 104, StartTime: KICKOFF - 6 * 3600_000 };
const shift = -6 * 3600_000;
const scores2 = scoresTimeline.map((s) => ({ ...s, fixtureId: FIXTURE2_ID, startTime: fixture2.StartTime, ts: (s.ts as number) + shift }));
const odds2 = oddsTimeline.map((o) => ({ ...o, FixtureId: FIXTURE2_ID, Ts: o.Ts + shift }));

function json(res: http.ServerResponse, body: unknown) {
  res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;
  const now = simNow();

  if (path === "/auth/guest/start") return json(res, { token: "mock-jwt" });

  if (path === "/api/fixtures/snapshot") return json(res, [fixture, fixture2]);

  if (path === `/api/scores/historical/${FIXTURE_ID}`)
    return json(res, scoresTimeline.filter((s) => (s.ts as number) <= now));
  if (path === `/api/scores/historical/${FIXTURE2_ID}`) return json(res, scores2);

  if (path === `/api/odds/updates/${FIXTURE_ID}`)
    return json(res, oddsTimeline.filter((o) => o.Ts <= now));
  if (path === `/api/odds/updates/${FIXTURE2_ID}`) return json(res, odds2);
  if (path === `/api/odds/snapshot/${FIXTURE_ID}`)
    return json(res, oddsTimeline.filter((o) => o.Ts <= now).slice(-1));
  if (path === `/api/odds/snapshot/${FIXTURE2_ID}`) return json(res, odds2.slice(-1));

  // historical odds buckets (day/hour/interval) for the replay engine
  const bucket = path.match(/^\/api\/odds\/updates\/(\d+)\/(\d+)\/(\d+)$/);
  if (bucket) {
    const [d, h, i] = [Number(bucket[1]), Number(bucket[2]), Number(bucket[3])];
    const from = (d * 86400 + h * 3600 + i * 300) * 1000;
    const to = from + 300_000;
    return json(res, [...oddsTimeline, ...odds2].filter((o) => o.Ts >= from && o.Ts < to));
  }

  if (path === "/api/odds/stream" || path === "/api/scores/stream") {
    const isOdds = path === "/api/odds/stream";
    const fid = url.searchParams.get("fixtureId");
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    let cursor = now;
    const timer = setInterval(() => {
      const t = simNow();
      const source: { ts?: number; Ts?: number }[] = isOdds ? oddsTimeline : (scoresTimeline as { ts: number }[]);
      for (const item of source) {
        const its = (item.Ts ?? item.ts)!;
        const itemFid = (item as { FixtureId?: number; fixtureId?: number }).FixtureId ?? (item as { fixtureId?: number }).fixtureId;
        if (its > cursor && its <= t && (!fid || Number(fid) === itemFid)) {
          res.write(`id: ${its}:0\ndata: ${JSON.stringify(item)}\n\n`);
        }
      }
      cursor = t;
      if (Math.floor(t / 10000) % 3 === 0) res.write(`event: heartbeat\ndata: {"Ts": ${t}}\n\n`);
    }, 1000);
    req.on("close", () => clearInterval(timer));
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`[mock-txline] listening on :${PORT} — fixture ${FIXTURE_ID} live at ${SPEED}x, fixture ${FIXTURE2_ID} finished`);
});
