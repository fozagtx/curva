"use client";

// Lobby row: one card per fixture. Compact by default; expands on hover/focus.

import Link from "next/link";
import { Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { FixtureMeta } from "@/lib/engine/state";
import TeamFlag from "./team-flag";

export type MatchStatus = "live" | "upcoming" | "finished";
export type MarketBadge = {
  pool: number;
  settled: boolean;
  /** Lamports [P1, draw, P2] when known */
  pools?: [number, number, number];
} | null;

export function inferStatus(meta: FixtureMeta, now: number): MatchStatus {
  if (now < meta.startTime) return "upcoming";
  if (now < meta.startTime + 2.75 * 3600_000) return "live";
  return "finished";
}

function kickoffLabel(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function dateLabel(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function poolSol(pool: number): string {
  return (pool / 1e9).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function MatchCard({
  meta,
  status,
  market,
}: {
  meta: FixtureMeta;
  status: MatchStatus;
  market?: MarketBadge;
}) {
  return (
    <Card
      as={Link}
      className="surface-interactive border-small border-default-200 hover:border-primary-200"
      href={`/m/${meta.fixtureId}`}
      isPressable
      shadow="sm"
    >
      <CardBody className="flex flex-row items-center gap-2.5 p-2.5">
        <div className="flex shrink-0 items-center gap-1">
          <TeamFlag name={meta.home.name} size={22} />
          <TeamFlag name={meta.away.name} size={22} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-small font-semibold">
            {meta.home.name} <span className="font-normal text-default-400">vs</span>{" "}
            {meta.away.name}
          </p>
          <p className="truncate text-[10px] text-default-400">
            {status === "finished" ? dateLabel(meta.startTime) : kickoffLabel(meta.startTime)}
            {status === "upcoming" && market && market.pool > 0
              ? ` · ${poolSol(market.pool)} SOL`
              : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          {status === "live" ? (
            <Chip
              color="danger"
              size="sm"
              startContent={<span className="mx-1 h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />}
              variant="flat"
            >
              LIVE
            </Chip>
          ) : market?.settled ? (
            <Chip color="success" size="sm" variant="flat">
              Settled
            </Chip>
          ) : status === "finished" ? (
            <Chip size="sm" variant="flat" color="secondary">
              Replay
            </Chip>
          ) : market && market.pool > 0 ? (
            <span className="font-mono text-[10px] font-bold text-primary">
              {poolSol(market.pool)} SOL
            </span>
          ) : (
            <Icon className="text-default-300" icon="solar:alt-arrow-right-linear" width={16} />
          )}
        </div>
      </CardBody>
    </Card>
  );
}
