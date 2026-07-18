// Replay stream: rebuilds a finished match's full timeline from TxLINE
// historical data, then re-emits it through the same engine at `speed`x.
// This is real TxLINE data replayed - it keeps the product alive between
// matches and after the tournament ends.

import type { NextRequest } from "next/server";
import {
  fetchFixtures,
  fetchScoresHistorical,
  fetchOddsHistoryRange,
} from "@/lib/txline/client";
import { WORLD_CUP_COMPETITION_ID } from "@/lib/txline/config";
import type { OddsPayload, ScoresRecord } from "@/lib/txline/types";
import { MatchEngine, encodeSse, fixtureMeta, type PulseEvent } from "@/lib/engine/state";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface TimelineItem {
  ts: number;
  kind: "odds" | "score";
  rec: OddsPayload | ScoresRecord;
}

// Built timelines are immutable once a match is finished - cache in-process.
const timelineCache = new Map<number, TimelineItem[]>();

async function buildTimeline(fixtureId: number, startTime: number): Promise<TimelineItem[]> {
  const cached = timelineCache.get(fixtureId);
  if (cached) return cached;

  const scores = await fetchScoresHistorical(fixtureId);
  const lastTs = scores.length ? scores[scores.length - 1].ts : startTime + 3 * 3600_000;
  const odds = await fetchOddsHistoryRange(
    fixtureId,
    startTime - 45 * 60 * 1000,
    lastTs + 10 * 60 * 1000,
  );

  const timeline: TimelineItem[] = [
    ...scores.map((rec) => ({ ts: rec.ts, kind: "score" as const, rec })),
    ...odds.map((rec) => ({ ts: rec.Ts, kind: "odds" as const, rec })),
  ].sort((a, b) => a.ts - b.ts);

  if (timeline.length) timelineCache.set(fixtureId, timeline);
  return timeline;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId: fixtureIdRaw } = await params;
  const fixtureId = Number(fixtureIdRaw);
  const speed = Math.min(600, Math.max(1, Number(req.nextUrl.searchParams.get("speed") ?? 60)));
  if (!Number.isFinite(fixtureId)) return new Response("bad fixtureId", { status: 400 });

  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort(), { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (ev: PulseEvent) => {
        try {
          controller.enqueue(enc.encode(encodeSse(ev)));
        } catch {
          abort.abort();
        }
      };
      try {
        let fixtures = await fetchFixtures(WORLD_CUP_COMPETITION_ID, 20614);
        let fixture = fixtures.find((f) => f.FixtureId === fixtureId);
        if (!fixture) {
          fixtures = await fetchFixtures(WORLD_CUP_COMPETITION_ID);
          fixture = fixtures.find((f) => f.FixtureId === fixtureId);
        }
        if (!fixture) {
          send({ t: "end", ts: 0 });
          controller.close();
          return;
        }
        send({ t: "hello", fixture: fixtureMeta(fixture), mode: "replay", speed });

        const timeline = await buildTimeline(fixtureId, fixture.StartTime);
        const engine = new MatchEngine();

        let prevTs = timeline.length ? timeline[0].ts : 0;
        for (const item of timeline) {
          if (abort.signal.aborted) break;
          const gap = Math.max(0, item.ts - prevTs) / speed;
          prevTs = item.ts;
          if (gap > 5) await sleep(Math.min(gap, 8000), abort.signal);

          const events = item.kind === "odds"
            ? engine.ingestOdds(item.rec as OddsPayload)
            : engine.ingestScore(item.rec as ScoresRecord);
          for (const ev of events) send(ev);
        }
        send({ t: "end", ts: prevTs });
        controller.close();
      } catch (err) {
        if (!abort.signal.aborted) {
          try {
            controller.enqueue(
              new TextEncoder().encode(
                `event: stream_error\ndata: ${JSON.stringify(String(err))}\n\n`,
              ),
            );
            controller.close();
          } catch { /* already closed */ }
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });
}
