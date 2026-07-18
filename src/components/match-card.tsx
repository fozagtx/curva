"use client";

// Lobby row: one card per fixture.

import Link from "next/link";
import { Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { FixtureMeta } from "@/lib/engine/state";

export type MatchStatus = "live" | "upcoming" | "finished";

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
  });
}

export default function MatchCard({ meta, status }: { meta: FixtureMeta; status: MatchStatus }) {
  return (
    <Card
      as={Link}
      className="border-small border-default-200"
      href={`/m/${meta.fixtureId}`}
      isPressable
      shadow="sm"
    >
      <CardBody className="flex flex-row items-center gap-3 p-4">
        <div className="flex shrink-0 rounded-medium border border-default-100 bg-default-50 p-2">
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
          <p className="truncate text-medium font-medium">
            {meta.home.name} <span className="text-default-400">vs</span> {meta.away.name}
          </p>
          <p className="truncate text-tiny text-default-400">{meta.competition}</p>
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
          ) : status === "finished" ? (
            <Chip size="sm" variant="flat" color="secondary">
              Replay
            </Chip>
          ) : (
            <p className="font-mono text-tiny text-default-400">{kickoffLabel(meta.startTime)}</p>
          )}
          <Icon className="text-default-300" icon="solar:alt-arrow-right-linear" width={16} />
        </div>
      </CardBody>
    </Card>
  );
}
