import { NextResponse } from "next/server";
import { fetchFixtures } from "@/lib/txline/client";
import { WORLD_CUP_COMPETITION_ID } from "@/lib/txline/config";
import { fixtureMeta } from "@/lib/engine/state";

export const dynamic = "force-dynamic";

// World Cup 2026 group stage began June 11; list the whole tournament.
const TOURNAMENT_START_EPOCH_DAY = 20614;

export async function GET() {
  try {
    const [current, tournament] = await Promise.allSettled([
      fetchFixtures(WORLD_CUP_COMPETITION_ID),
      fetchFixtures(WORLD_CUP_COMPETITION_ID, TOURNAMENT_START_EPOCH_DAY),
    ]);
    const byId = new Map<number, ReturnType<typeof fixtureMeta>>();
    for (const r of [tournament, current]) {
      if (r.status === "fulfilled") {
        for (const f of r.value) byId.set(f.FixtureId, fixtureMeta(f));
      }
    }
    if (byId.size === 0 && current.status === "rejected") throw current.reason;
    const matches = [...byId.values()].sort((a, b) => a.startTime - b.startTime);
    return NextResponse.json({ matches });
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 502 },
    );
  }
}
