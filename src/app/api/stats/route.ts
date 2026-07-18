// Live protocol strip for the lobby: SOL locked, open markets, settlements, scouts.

import { NextResponse } from "next/server";
import { ensureSchema, listActivity, readMarketCache } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSchema();
    const [cache, activity] = await Promise.all([
      readMarketCache(),
      listActivity(undefined, 200),
    ]);

    let tvlLamports = 0;
    let marketsOpen = 0;
    let settlements = 0;
    for (const r of cache) {
      const pool = r.pool_p1 + r.pool_draw + r.pool_p2;
      tvlLamports += pool;
      if (r.settled) settlements += 1;
      else if (pool > 0) marketsOpen += 1;
    }

    const wallets = new Set<string>();
    for (const a of activity) {
      if (a.wallet) wallets.add(a.wallet);
    }

    return NextResponse.json({
      tvlLamports,
      marketsOpen,
      settlements,
      scouts: wallets.size,
      activityCount: activity.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 502 },
    );
  }
}
