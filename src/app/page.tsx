"use client";

// Compact white sportsbook lobby - featured match + list. No full-screen waste.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card, CardBody, Chip, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import TopBar from "@/components/top-bar";
import MatchCard, { inferStatus, type MatchStatus, type MarketBadge } from "@/components/match-card";
import { SocialProofTicker } from "@/components/fomo-strip";
import { activityToPings, formatCountdown, msUntil, type SocialPing } from "@/lib/fomo";
import type { FixtureMeta } from "@/lib/engine/state";

type LobbyMatch = FixtureMeta & { market: MarketBadge };

export default function Lobby() {
 const [matches, setMatches] = useState<LobbyMatch[] | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [pings, setPings] = useState<SocialPing[]>([]);
 const [stats, setStats] = useState<{
 tvlLamports: number;
 marketsOpen: number;
 settlements: number;
 } | null>(null);
 const [now, setNow] = useState(() => Date.now());

 useEffect(() => {
 const t = setInterval(() => setNow(Date.now()), 30_000);
 return () => clearInterval(t);
 }, []);

 useEffect(() => {
 let cancelled = false;
 fetch("/api/matches")
 .then(async (res) => {
 const body = await res.json();
 if (cancelled) return;
 if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
 setMatches(body.matches as LobbyMatch[]);
 })
 .catch((err) => {
 if (!cancelled) setError(String(err.message ?? err));
 });
 fetch("/api/stats")
 .then((r) => r.json())
 .then((b) => {
 if (!cancelled && b.tvlLamports != null) {
 setStats({
 tvlLamports: Number(b.tvlLamports),
 marketsOpen: Number(b.marketsOpen),
 settlements: Number(b.settlements),
 });
 }
 })
 .catch(() => {});
 fetch("/api/activity")
 .then((r) => r.json())
 .then((b) => {
 if (!cancelled && Array.isArray(b.activity)) {
 setPings(activityToPings(b.activity));
 }
 })
 .catch(() => {});
 return () => {
 cancelled = true;
 };
 }, []);

 const groups = useMemo(() => {
 if (!matches) return null;
 const by: Record<MatchStatus, LobbyMatch[]> = { live: [], upcoming: [], finished: [] };
 for (const m of matches) by[inferStatus(m, now)].push(m);
 by.upcoming.sort((a, b) => {
 const ap = a.market?.pool ?? 0;
 const bp = b.market?.pool ?? 0;
 if (bp !== ap) return bp - ap;
 return a.startTime - b.startTime;
 });
 by.finished.sort((a, b) => b.startTime - a.startTime);
 return by;
 }, [matches, now]);

 const featured = useMemo(() => {
 if (!groups) return null;
 if (groups.live[0]) return { m: groups.live[0], status: "live" as const };
 const withPool = groups.upcoming.find((m) => m.market && m.market.pool > 0);
 if (withPool) return { m: withPool, status: "upcoming" as const };
 if (groups.upcoming[0]) return { m: groups.upcoming[0], status: "upcoming" as const };
 return null;
 }, [groups]);

 const nextLeft = featured ? msUntil(featured.m.startTime, now) : null;

 return (
 <main className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-3 py-4 sm:px-4 sm:py-6">
 <TopBar />

 <div className="flex flex-col gap-1">
 <div className="flex flex-wrap items-center gap-1.5">
 <Chip size="sm" variant="flat" color="success">
 World Cup · 1X2
 </Chip>
 {nextLeft != null && nextLeft > 0 && featured?.status === "upcoming" ? (
 <Chip size="sm" color="warning" variant="flat" className="font-mono font-bold">
 KO {formatCountdown(nextLeft)}
 </Chip>
 ) : null}
 </div>
 <h1 className="text-xl font-bold leading-tight sm:text-2xl">
 Pick 1X2. Cash when it&apos;s proven.
 </h1>
 </div>

 <div className="grid grid-cols-3 gap-2">
 <Stat
 label="Locked"
 value={`${((stats?.tvlLamports ?? 0) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 2 })} SOL`}
 />
 <Stat label="Open" value={String(stats?.marketsOpen ?? "-")} />
 <Stat label="Settled" value={String(stats?.settlements ?? "-")} />
 </div>

 {pings.length > 0 ? <SocialProofTicker pings={pings} /> : null}

 {error ? (
 <Card className="border-small border-danger-300" shadow="sm">
 <CardBody className="flex flex-row items-center gap-2 p-3">
 <Icon className="text-danger" icon="solar:danger-circle-bold" width={18} />
 <p className="text-tiny text-default-500">{error}</p>
 </CardBody>
 </Card>
 ) : !groups ? (
 <div className="flex flex-col gap-2">
 {[0, 1, 2, 3].map((i) => (
 <Skeleton key={i} className="h-16 rounded-large" />
 ))}
 </div>
 ) : (
 <>
 {featured ? (
 <FeaturedCompact
 market={featured.m.market}
 meta={featured.m}
 status={featured.status}
 />
 ) : null}

 {groups.live.filter((m) => m.fixtureId !== featured?.m.fixtureId).length > 0 && (
 <Section title="Live">
 {groups.live
 .filter((m) => m.fixtureId !== featured?.m.fixtureId)
 .map((m) => (
 <MatchCard key={m.fixtureId} market={m.market} meta={m} status="live" />
 ))}
 </Section>
 )}

 {groups.upcoming.filter((m) => m.fixtureId !== featured?.m.fixtureId).length > 0 && (
 <Section title="Coming up">
 {groups.upcoming
 .filter((m) => m.fixtureId !== featured?.m.fixtureId)
 .slice(0, 10)
 .map((m) => (
 <MatchCard key={m.fixtureId} market={m.market} meta={m} status="upcoming" />
 ))}
 </Section>
 )}

 {groups.finished.length > 0 && (
 <Section title="Finished">
 {groups.finished.slice(0, 8).map((m) => (
 <MatchCard key={m.fixtureId} market={m.market} meta={m} status="finished" />
 ))}
 </Section>
 )}
 </>
 )}
 </main>
 );
}

function FeaturedCompact({
 meta,
 status,
 market,
}: {
 meta: FixtureMeta;
 status: MatchStatus;
 market: MarketBadge;
}) {
 const pool = market && market.pool > 0 ? market.pool / 1e9 : 0;
 const pools = market?.pools;
 const total = market?.pool ?? 0;
 const homeIsP1 = meta.home.parti === 1;
 const pct = (n: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : "-");
 const home = homeIsP1 ? (pools?.[0] ?? 0) : (pools?.[2] ?? 0);
 const draw = pools?.[1] ?? 0;
 const away = homeIsP1 ? (pools?.[2] ?? 0) : (pools?.[0] ?? 0);

 return (
 <Card className="border-small border-primary-200" shadow="sm">
 <CardBody className="gap-3 p-3">
 <div className="flex items-center justify-between gap-2">
 <Chip
 color={status === "live" ? "danger" : "primary"}
 size="sm"
 variant="flat"
 startContent={
 status === "live" ? (
 <span className="mx-1 h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
 ) : undefined
 }
 >
 {status === "live" ? "LIVE" : "FEATURED"}
 </Chip>
 {pool > 0 ? (
 <span className="font-mono text-tiny font-bold text-primary">
 {pool.toLocaleString(undefined, { maximumFractionDigits: 2 })} SOL
 </span>
 ) : null}
 </div>

 <div className="flex items-center justify-between gap-2">
 <p className="min-w-0 flex-1 truncate text-right text-small font-bold">{meta.home.name}</p>
 <span className="shrink-0 px-2 text-tiny font-bold text-default-400">VS</span>
 <p className="min-w-0 flex-1 truncate text-left text-small font-bold">{meta.away.name}</p>
 </div>

 <div className="grid grid-cols-3 gap-1.5">
 {[
 ["1", pct(home)],
 ["X", pct(draw)],
 ["2", pct(away)],
 ].map(([k, v]) => (
 <div
 key={k}
 className="flex flex-col items-center rounded-lg border border-default-200 bg-default-50 py-2"
 >
 <span className="text-[10px] font-bold text-default-500">{k}</span>
 <span className="font-mono text-small font-bold">{v}</span>
 </div>
 ))}
 </div>

 <Button
 as={Link}
 className="font-bold"
 color="primary"
 fullWidth
 href={`/m/${meta.fixtureId}`}
 radius="full"
 size="sm"
 >
 Bet this match
 </Button>
 </CardBody>
 </Card>
 );
}

function Stat({ label, value }: { label: string; value: string }) {
 return (
 <div className="rounded-lg border border-default-200 bg-default-50 px-2 py-1.5">
 <p className="text-[10px] font-semibold uppercase text-default-400">{label}</p>
 <p className="truncate font-mono text-tiny font-bold">{value}</p>
 </div>
 );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
 return (
 <section className="flex flex-col gap-1.5">
 <h2 className="text-[10px] font-bold uppercase tracking-wide text-default-400">{title}</h2>
 {children}
 </section>
 );
}
