// Live match stream: catches the viewer up with everything since kick-off,
// then relays TxLINE's odds + scores SSE feeds as normalized PulseEvents.

import type { NextRequest } from "next/server";
import {
  fetchFixtures,
  fetchScoresHistorical,
  fetchLiveOddsUpdates,
  fetchOddsSnapshot,
  fetchOddsHistoryRange,
  streamSse,
} from "@/lib/txline/client";
import { WORLD_CUP_COMPETITION_ID } from "@/lib/txline/config";
import type { OddsPayload, ScoresRecord } from "@/lib/txline/types";
import { MatchEngine, encodeSse, fixtureMeta, type PulseEvent } from "@/lib/engine/state";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fixtureId: string }> },
) {
  const { fixtureId: fixtureIdRaw } = await params;
  const fixtureId = Number(fixtureIdRaw);
  if (!Number.isFinite(fixtureId)) {
    return new Response("bad fixtureId", { status: 400 });
  }

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

      const engine = new MatchEngine();
      try {
        // 1. Fixture metadata
        const fixtures = await fetchFixtures(WORLD_CUP_COMPETITION_ID);
        let fixture = fixtures.find((f) => f.FixtureId === fixtureId);
        if (!fixture) {
          const earlier = await fetchFixtures(WORLD_CUP_COMPETITION_ID, 20614);
          fixture = earlier.find((f) => f.FixtureId === fixtureId);
        }
        if (!fixture) {
          send({ t: "end", ts: 0 });
          controller.close();
          return;
        }
        send({ t: "hello", fixture: fixtureMeta(fixture), mode: "live" });

        // 2. Catch-up: full score history + odds history since kick-off
        const [scoresHist, oddsLive] = await Promise.allSettled([
          fetchScoresHistorical(fixtureId),
          fetchLiveOddsUpdates(fixtureId),
        ]);

        const catchup: { ts: number; kind: "odds" | "score"; rec: OddsPayload | ScoresRecord }[] = [];
        if (scoresHist.status === "fulfilled") {
          for (const r of scoresHist.value) catchup.push({ ts: r.ts, kind: "score", rec: r });
        }
        let odds: OddsPayload[] = oddsLive.status === "fulfilled" ? oddsLive.value : [];
        if (odds.length === 0) {
          // fall back to a reconstructed range around the match window
          const from = fixture.StartTime - 60 * 60 * 1000;
          try {
            odds = await fetchOddsHistoryRange(fixtureId, from, Date.now());
          } catch { /* snapshot fallback below */ }
        }
        if (odds.length === 0) {
          try {
            odds = await fetchOddsSnapshot(fixtureId);
          } catch { /* no odds yet */ }
        }
        for (const o of odds) catchup.push({ ts: o.Ts, kind: "odds", rec: o });

        catchup.sort((a, b) => a.ts - b.ts);
        for (const item of catchup) {
          const events = item.kind === "odds"
            ? engine.ingestOdds(item.rec as OddsPayload)
            : engine.ingestScore(item.rec as ScoresRecord);
          for (const ev of events) send(ev);
        }

        // 3. Relay live SSE feeds
        const pump = async (path: string, kind: "odds" | "score") => {
          for await (const msg of streamSse(path, abort.signal)) {
            if (msg.event === "heartbeat") continue;
            if (!msg.data) continue;
            let rec: unknown;
            try {
              rec = JSON.parse(msg.data);
            } catch {
              continue;
            }
            const events = kind === "odds"
              ? engine.ingestOdds(rec as OddsPayload)
              : engine.ingestScore(rec as ScoresRecord);
            for (const ev of events) send(ev);
          }
        };

        await Promise.all([
          pump(`/odds/stream?fixtureId=${fixtureId}`, "odds"),
          pump(`/scores/stream?fixtureId=${fixtureId}`, "score"),
        ]);
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
