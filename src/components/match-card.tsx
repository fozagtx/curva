"use client";

// Lobby row: one card per fixture. Compact by default; expands on hover/focus.

import Link from "next/link";
import { Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { FixtureMeta } from "@/lib/engine/state";

export type MatchStatus = "live" | "upcoming" | "finished";
export type MarketBadge = { pool: number; settled: boolean } | null;

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
  const detail =
    status === "live"
      ? "Live odds + pools updating now. Open to stake or watch the wave."
      : market?.settled
        ? "Settled on Solana with a TxLINE finalisation proof. Claims unlocked."
        : status === "finished"
          ? "Full-time. Replay the drama or settle if the market is still open."
          : market && market.pool > 0
            ? `${poolSol(market.pool)} SOL already in the vault. Stake before kick-off.`
            : `Kick-off ${kickoffLabel(meta.startTime)}. Open the market and put conviction on-chain.`;

  return (
    <Card
      as={Link}
      className="group border-small border-default-200 transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none hover:-translate-y-0.5 hover:border-default-300 hover:shadow-md focus-visible:-translate-y-0.5"
      href={`/m/${meta.fixtureId}`}
      isPressable
      shadow="sm"
    >
      <CardBody className="flex flex-col gap-0 p-4">
        <div className="flex flex-row items-center gap-3">
          <div className="flex shrink-0 rounded-medium border border-default-100 bg-default-50 p-2 transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none group-hover:scale-110">
            <Icon
              className={status === "live" ? "text-danger" : "text-default-500"}
              icon={
                status === "live"
                  ? "solar:play-stream-bold"
                  : status === "finished"
                    ? "solar:flag-2-bold-duotone"
                    : "solar:calendar-bold-duotone"
              }
              width={20}
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="truncate text-medium font-medium transition-[max-width] duration-200 group-hover:whitespace-normal group-hover:overflow-visible group-focus-within:whitespace-normal">
              {meta.home.name} <span className="text-default-400">vs</span> {meta.away.name}
            </p>
            <p className="truncate text-tiny text-default-400">
              {meta.competition}
              {status === "finished" ? ` · ${dateLabel(meta.startTime)}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
              <Chip
                color="success"
                size="sm"
                startContent={<Icon icon="solar:check-circle-bold" width={13} />}
                variant="flat"
              >
                Settled
              </Chip>
            ) : status === "finished" ? (
              <Chip size="sm" variant="flat" color="secondary">
                Replay
              </Chip>
            ) : (
              <div className="flex flex-col items-end">
                {market && market.pool > 0 ? (
                  <span className="font-mono text-tiny font-semibold text-primary">
                    {poolSol(market.pool)} SOL pool
                  </span>
                ) : null}
                <p className="font-mono text-tiny text-default-400">{kickoffLabel(meta.startTime)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Expand on hover/focus; collapse when idle. grid 0fr→1fr avoids layout jank. */}
        <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr]">
          <div className="overflow-hidden">
            <div className="flex items-start justify-between gap-3 pt-3 opacity-0 transition-opacity duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none group-hover:opacity-100 group-focus-within:opacity-100">
              <p className="text-tiny leading-snug text-default-500">{detail}</p>
              <span className="flex shrink-0 items-center gap-1 text-tiny font-medium text-primary">
                Open
                <Icon icon="solar:arrow-right-linear" width={14} />
              </span>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
