"use client";

// Lobby: top bar -> chips -> hero -> 3 action cards -> match list.

import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, Chip, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import TopBar from "@/components/top-bar";
import ActionCard from "@/components/action-card";
import MatchCard, { inferStatus, type MatchStatus } from "@/components/match-card";
import type { FixtureMeta } from "@/lib/engine/state";

export default function Lobby() {
  const [matches, setMatches] = useState<FixtureMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/matches")
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setMatches(body.matches as FixtureMeta[]);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err.message ?? err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [now] = useState(() => Date.now());
  const groups = useMemo(() => {
    if (!matches) return null;
    const by: Record<MatchStatus, FixtureMeta[]> = { live: [], upcoming: [], finished: [] };
    for (const m of matches) by[inferStatus(m, now)].push(m);
    by.upcoming.sort((a, b) => a.startTime - b.startTime);
    by.finished.sort((a, b) => b.startTime - a.startTime);
    return by;
  }, [matches, now]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <TopBar />

      <div className="flex flex-wrap items-center gap-2">
        <Chip
          color="danger"
          size="sm"
          startContent={<span className="mx-1 h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />}
          variant="flat"
        >
          {groups ? `${groups.live.length} live now` : "Checking pitches…"}
        </Chip>
        <Chip size="sm" variant="flat" startContent={<Icon icon="solar:cup-bold" width={14} />}>
          World Cup 2026
        </Chip>
        <Chip color="primary" size="sm" variant="flat" startContent={<Icon icon="solar:shield-check-bold" width={14} />}>
          Verified on Solana
        </Chip>
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
          Stake on the match. Let Solana settle it.
        </h1>
        <p className="text-medium text-default-500">
          There is no house and no oracle operator here. Your stake is a public
          commitment on Solana before the result exists, and payouts unlock only
          when the chain itself verifies a proof of the final score.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <ActionCard
          color="primary"
          description="Stake SOL on any match. The pot sits in a vault no one controls."
          icon="solar:safe-square-bold-duotone"
          title="Trustless pools"
        />
        <ActionCard
          color="secondary"
          description="Live win probability from TxLINE consensus odds, lurching with every goal."
          icon="solar:pulse-2-bold-duotone"
          title="The market, live"
        />
        <ActionCard
          description="Every claim is checkable: verify any result from your own browser."
          icon="solar:shield-check-bold-duotone"
          title="Don't trust us"
        />
      </div>

      {error ? (
        <Card className="border-small border-danger-300" shadow="sm">
          <CardBody className="flex flex-row items-center gap-3 p-4">
            <div className="flex rounded-medium border border-danger-100 bg-danger-50 p-2">
              <Icon className="text-danger" icon="solar:danger-circle-bold" width={20} />
            </div>
            <div>
              <p className="text-small font-medium">The data feed is catching its breath.</p>
              <p className="text-tiny text-default-400">{error}</p>
            </div>
          </CardBody>
        </Card>
      ) : !groups ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[72px] rounded-large" />
          ))}
        </div>
      ) : (
        <>
          {groups.live.length > 0 && (
            <Section title="Live now">
              {groups.live.map((m) => (
                <MatchCard key={m.fixtureId} meta={m} status="live" />
              ))}
            </Section>
          )}
          {groups.upcoming.length > 0 && (
            <Section title="Coming up">
              {groups.upcoming.slice(0, 8).map((m) => (
                <MatchCard key={m.fixtureId} meta={m} status="upcoming" />
              ))}
            </Section>
          )}
          {groups.finished.length > 0 && (
            <Section title="Relive the drama">
              {groups.finished.slice(0, 10).map((m) => (
                <MatchCard key={m.fixtureId} meta={m} status="finished" />
              ))}
            </Section>
          )}
          {groups.live.length + groups.upcoming.length + groups.finished.length === 0 && (
            <Card className="border-small border-dashed border-default-200" shadow="none">
              <CardBody className="flex flex-col items-center gap-2 p-10">
                <Icon className="text-default-300" icon="solar:football-bold-duotone" width={36} />
                <p className="text-small text-default-400">No fixtures on the schedule right now.</p>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-small font-medium uppercase tracking-wide text-default-400">{title}</h2>
      {children}
    </section>
  );
}
