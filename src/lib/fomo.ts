// FOMO helpers for the TikTok × SportyBet feed.

export type Urgency = "idle" | "soon" | "hot" | "closing" | "live" | "locked";

export function msUntil(ts: number, now = Date.now()): number {
  return ts - now;
}

export function urgencyFor(
  startTime: number,
  status: "live" | "upcoming" | "finished",
  now = Date.now(),
): Urgency {
  if (status === "live") return "live";
  if (status === "finished") return "locked";
  const left = msUntil(startTime, now);
  if (left <= 0) return "live";
  if (left <= 30 * 60_000) return "closing"; // < 30m
  if (left <= 3 * 3600_000) return "hot"; // < 3h
  if (left <= 24 * 3600_000) return "soon"; // < 24h
  return "idle";
}

/** Compact countdown: 2h 14m / 18:42 / 45s */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}:${sec.toString().padStart(2, "0")}`;
  return `${sec}s`;
}

export function fomoHeadline(urgency: Urgency, teamHint?: string): string {
  switch (urgency) {
    case "live":
      return "In play - pot locked. Watch or call the swing.";
    case "closing":
      return teamHint
        ? `Last minutes - stake ${teamHint} before kick-off locks the pot.`
        : "Last minutes - stake before kick-off locks the pot.";
    case "hot":
      return "Kick-off soon. Pool is filling - don't watch from the sideline.";
    case "soon":
      return "Tonight's card. Get in before the vault closes at kick-off.";
    case "locked":
      return "Done. Replay the drama or claim if you won.";
    default:
      return "Open pool. Be early - early money sets the price.";
  }
}

export function ctaLabel(
  urgency: Urgency,
  status: "live" | "upcoming" | "finished",
): string {
  if (status === "finished") return "Replay match";
  if (urgency === "closing") return "Stake now - closing";
  if (urgency === "hot") return "Get in before kick-off";
  if (urgency === "live") return "Open live match";
  return "Bet this match";
}

export interface SocialPing {
  fixtureId: number;
  text: string;
  at: number;
}

export function activityToPings(
  rows: {
    fixture_id: number;
    kind: string;
    wallet: string;
    side: number | null;
    amount_lamports: number | null;
    created_at: string;
  }[],
  sideNames?: (fixtureId: number, side: number | null) => string,
): SocialPing[] {
  return rows
    .filter((r) => r.kind === "stake" || r.kind === "create_market")
    .slice(0, 12)
    .map((r) => {
      const who = `${r.wallet.slice(0, 4)}…${r.wallet.slice(-4)}`;
      const sol =
        r.amount_lamports != null
          ? (r.amount_lamports / 1e9).toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })
          : null;
      const side =
        r.side != null && sideNames ? sideNames(r.fixture_id, r.side) : null;
      const text =
        r.kind === "create_market"
          ? `${who} just opened a market`
          : sol
            ? `${who} just put ${sol} SOL${side ? ` on ${side}` : ""}`
            : `${who} just staked`;
      return {
        fixtureId: r.fixture_id,
        text,
        at: new Date(r.created_at).getTime(),
      };
    });
}
