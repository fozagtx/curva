"use client";

// TikTok slide × SportyBet 1X2 × FOMO (countdown, social proof, urgency CTA).

import Link from "next/link";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { FixtureMeta } from "@/lib/engine/state";
import type { MatchStatus, MarketBadge } from "./match-card";
import {
  ctaLabel,
  fomoHeadline,
  urgencyFor,
  type SocialPing,
} from "@/lib/fomo";
import { HotPoolBadge, KickoffCountdown, SocialProofTicker } from "./fomo-strip";

export default function FeedSlide({
  meta,
  status,
  market,
  index,
  total,
  pings,
  isHottest,
}: {
  meta: FixtureMeta;
  status: MatchStatus;
  market: MarketBadge;
  index: number;
  total: number;
  pings: SocialPing[];
  isHottest: boolean;
}) {
  const urgency = urgencyFor(meta.startTime, status);
  const poolSol = market && market.pool > 0 ? market.pool / 1e9 : 0;
  const odds = oneXTwo(meta, market);
  const headline = fomoHeadline(urgency, meta.home.name);
  const cta = ctaLabel(urgency, status);

  return (
    <section className="tiktok-slide relative flex flex-col justify-between bg-white px-4 pb-7 pt-20 sm:px-8">
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <KickoffCountdown startTime={meta.startTime} urgency={urgency} />
          <HotPoolBadge isHottest={isHottest} poolSol={poolSol} />
        </div>
        <p className="font-mono text-tiny text-default-500">
          {index + 1}/{total}
          {poolSol > 0 ? (
            <span className="ml-1 font-bold text-primary">
              · {poolSol.toLocaleString(undefined, { maximumFractionDigits: 2 })} SOL in
            </span>
          ) : null}
        </p>
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-default-400">
          {meta.competition}
        </p>

        <div className="grid w-full max-w-lg grid-cols-[1fr_auto_1fr] items-center gap-3">
          <Team name={meta.home.name} accent="#16A34A" />
          <span className="px-1 text-base font-bold tracking-[0.28em] text-default-300">VS</span>
          <Team name={meta.away.name} accent="#0284C7" />
        </div>

        <p
          className={`max-w-md text-center text-tiny font-semibold sm:text-small ${
            urgency === "closing"
              ? "text-danger"
              : urgency === "hot"
                ? "text-warning-600"
                : "text-default-500"
          }`}
        >
          {headline}
        </p>

        <SocialProofTicker fixtureId={meta.fixtureId} pings={pings} />

        <div className="grid w-full max-w-lg grid-cols-3 gap-2">
          {odds.map((o) => (
            <Link
              key={o.key}
              className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-3 transition-colors active:scale-[0.98] ${
                urgency === "closing"
                  ? "border-danger-200 bg-danger-50"
                  : "border-default-200 bg-default-50 active:border-primary-300 active:bg-primary-50"
              }`}
              href={`/m/${meta.fixtureId}`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide text-default-500">
                {o.label}
              </span>
              <span className="font-mono text-xl font-bold tabular-nums text-foreground">
                {o.display}
              </span>
              <span className="truncate text-[10px] text-default-400">{o.name}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-2.5">
        <Button
          as={Link}
          className={`h-12 w-full max-w-lg text-medium font-bold ${
            urgency === "closing" ? "animate-pulse" : ""
          }`}
          color={urgency === "closing" ? "danger" : "primary"}
          href={`/m/${meta.fixtureId}`}
          radius="full"
          size="lg"
        >
          {cta}
        </Button>
        {index < total - 1 ? (
          <div className="flex flex-col items-center text-default-400">
            <Icon className="animate-bounce" icon="solar:alt-arrow-up-linear" width={16} />
            <span className="text-[10px] font-medium uppercase tracking-wider">Next</span>
          </div>
        ) : (
          <p className="text-[10px] uppercase tracking-wider text-default-400">End of feed</p>
        )}
      </div>
    </section>
  );
}

function Team({ name, accent }: { name: string; accent: string }) {
  const code = name.slice(0, 3).toUpperCase();
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-full border-2 text-lg font-bold sm:h-[4.5rem] sm:w-[4.5rem]"
        style={{ borderColor: `${accent}55`, background: `${accent}12`, color: accent }}
      >
        {code}
      </div>
      <p className="max-w-[7.5rem] truncate text-center text-small font-bold sm:max-w-none sm:text-medium">
        {name}
      </p>
    </div>
  );
}

function oneXTwo(meta: FixtureMeta, market: MarketBadge) {
  const homeIsP1 = meta.home.parti === 1;
  const pools = market?.pools;
  const total = market?.pool ?? 0;

  const pct = (lamports: number) =>
    total > 0 ? `${Math.round((lamports / total) * 100)}%` : "—";

  const p1 = pools?.[0] ?? 0;
  const draw = pools?.[1] ?? 0;
  const p2 = pools?.[2] ?? 0;

  const homePool = homeIsP1 ? p1 : p2;
  const awayPool = homeIsP1 ? p2 : p1;

  return [
    { key: "1", label: "1", name: meta.home.name, display: pct(homePool) },
    { key: "X", label: "X", name: "Draw", display: pct(draw) },
    { key: "2", label: "2", name: meta.away.name, display: pct(awayPool) },
  ];
}
