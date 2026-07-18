// TxLINE REST + SSE client (server-side only).

import { API_BASE_URL } from "./config";
import { authHeaders, renewJwt } from "./auth";
import type { Fixture, OddsPayload, ScoresRecord } from "./types";

async function apiGet<T>(pathname: string): Promise<T> {
  let res = await fetch(`${API_BASE_URL}${pathname}`, {
    headers: await authHeaders(),
    cache: "no-store",
  });
  if (res.status === 401) {
    await renewJwt();
    res = await fetch(`${API_BASE_URL}${pathname}`, {
      headers: await authHeaders(),
      cache: "no-store",
    });
  }
  if (!res.ok) {
    throw new Error(`TxLINE GET ${pathname} -> ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export function fetchFixtures(competitionId?: number, startEpochDay?: number): Promise<Fixture[]> {
  const params = new URLSearchParams();
  if (competitionId != null) params.set("competitionId", String(competitionId));
  if (startEpochDay != null) params.set("startEpochDay", String(startEpochDay));
  const qs = params.toString();
  return apiGet<Fixture[]>(`/fixtures/snapshot${qs ? `?${qs}` : ""}`);
}

export function fetchOddsSnapshot(fixtureId: number, asOf?: number): Promise<OddsPayload[]> {
  return apiGet<OddsPayload[]>(
    `/odds/snapshot/${fixtureId}${asOf ? `?asOf=${asOf}` : ""}`,
  );
}

export function fetchLiveOddsUpdates(fixtureId: number): Promise<OddsPayload[]> {
  return apiGet<OddsPayload[]>(`/odds/updates/${fixtureId}`);
}

export function fetchScoresSnapshot(fixtureId: number): Promise<ScoresRecord[]> {
  return apiGet<ScoresRecord[]>(`/scores/snapshot/${fixtureId}`);
}

export function fetchScoresHistorical(fixtureId: number): Promise<ScoresRecord[]> {
  return apiGet<ScoresRecord[]>(`/scores/historical/${fixtureId}`);
}

export function fetchLiveScoresUpdates(fixtureId: number): Promise<ScoresRecord[]> {
  return apiGet<ScoresRecord[]>(`/scores/updates/${fixtureId}`);
}

// Historical odds come in 5-minute interval buckets per hour.
export async function fetchOddsHistoryBucket(
  epochDay: number, hourOfDay: number, interval: number,
): Promise<OddsPayload[]> {
  return apiGet<OddsPayload[]>(`/odds/updates/${epochDay}/${hourOfDay}/${interval}`);
}

export async function fetchOddsHistoryRange(
  fixtureId: number, fromTsMs: number, toTsMs: number,
): Promise<OddsPayload[]> {
  const buckets: { day: number; hour: number; interval: number }[] = [];
  for (let t = fromTsMs; t <= toTsMs; t += 5 * 60 * 1000) {
    const totalSec = Math.floor(t / 1000);
    const day = Math.floor(totalSec / 86400);
    const hour = Math.floor((totalSec % 86400) / 3600);
    const interval = Math.floor((totalSec % 3600) / 300);
    buckets.push({ day, hour, interval });
  }
  const results = await Promise.allSettled(
    buckets.map((b) => fetchOddsHistoryBucket(b.day, b.hour, b.interval)),
  );
  const all: OddsPayload[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") {
      for (const o of r.value) if (o.FixtureId === fixtureId) all.push(o);
    }
  }
  all.sort((a, b) => a.Ts - b.Ts);
  return all;
}

export interface SseMessage {
  id?: string;
  event?: string;
  data: string;
}

// Minimal SSE reader over fetch streaming, with JWT renewal and reconnect.
export async function* streamSse(
  pathname: string,
  signal: AbortSignal,
): AsyncGenerator<SseMessage> {
  let lastEventId: string | undefined;
  let attempt = 0;

  while (!signal.aborted) {
    let res: Response;
    try {
      const headers: Record<string, string> = {
        ...(await authHeaders()),
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
      };
      if (lastEventId) headers["Last-Event-ID"] = lastEventId;
      res = await fetch(`${API_BASE_URL}${pathname}`, { headers, signal, cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        await renewJwt();
        res = await fetch(`${API_BASE_URL}${pathname}`, {
          headers: {
            ...(await authHeaders()),
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
            ...(lastEventId ? { "Last-Event-ID": lastEventId } : {}),
          },
          signal,
          cache: "no-store",
        });
      }
      if (!res.ok || !res.body) {
        throw new Error(`SSE ${pathname} -> ${res.status}`);
      }
    } catch (err) {
      if (signal.aborted) return;
      attempt += 1;
      await sleep(Math.min(1000 * 2 ** attempt, 15000), signal);
      continue;
    }

    attempt = 0;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIndex: number;
        // Events are separated by a blank line
        while ((sepIndex = buffer.search(/\r?\n\r?\n/)) !== -1) {
          const raw = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex).replace(/^\r?\n\r?\n/, "");
          const msg = parseSseBlock(raw);
          if (msg) {
            if (msg.id) lastEventId = msg.id;
            yield msg;
          }
        }
      }
    } catch {
      // network drop -> reconnect loop
    } finally {
      reader.releaseLock();
    }
    if (signal.aborted) return;
    await sleep(1000, signal);
  }
}

function parseSseBlock(block: string): SseMessage | null {
  let id: string | undefined;
  let event: string | undefined;
  const dataLines: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("id:")) id = line.slice(3).trim();
    else if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (!dataLines.length && !event) return null;
  return { id, event, data: dataLines.join("\n") };
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
