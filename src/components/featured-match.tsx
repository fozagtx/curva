"use client";

import Link from "next/link";
import { Button, Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { FixtureMeta } from "@/lib/engine/state";
import type { MatchStatus, MarketBadge } from "./match-card";
import TeamFlag from "./team-flag";

export default function FeaturedMatch({
  meta,
  status,
  market,
}: {
  meta: FixtureMeta;
  status: MatchStatus;
  market: MarketBadge;
}) {
  const kickoff = new Date(meta.startTime).toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const poolSol = market && market.pool > 0 ? market.pool / 1e9 : 0;

  return (
    <Card className="overflow-hidden border-small border-primary-200 bg-gradient-to-br from-primary-50/40 to-content1" shadow="sm">
      <CardBody className="gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Chip
            color={status === "live" ? "danger" : "primary"}
            size="sm"
            startContent={
              status === "live" ? (
                <span className="mx-1 h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
              ) : (
                <Icon icon="solar:cup-bold" width={13} />
              )
            }
            variant="flat"
          >
            {status === "live" ? "LIVE NOW" : "FEATURED MATCH"}
          </Chip>
          <p className="text-tiny text-default-400">
            {meta.competition} · {kickoff}
          </p>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamBlock accent="#22C55E" name={meta.home.name} align="end" />
          <div className="flex flex-col items-center px-1">
            <p className="text-tiny font-semibold tracking-[0.2em] text-default-400">VS</p>
            {poolSol > 0 ? (
              <p className="mt-1 font-mono text-tiny font-semibold text-primary">
                {poolSol.toLocaleString(undefined, { maximumFractionDigits: 2 })} SOL
              </p>
            ) : (
              <p className="mt-1 text-tiny text-default-400">Open pool</p>
            )}
          </div>
          <TeamBlock accent="#38BDF8" name={meta.away.name} align="start" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-tiny text-default-500">
            Stake SOL · watch the curve · settle by proof
          </p>
          <Button
            as={Link}
            color="primary"
            href={`/m/${meta.fixtureId}`}
            radius="full"
            size="sm"
            startContent={<Icon icon="solar:play-bold" width={16} />}
          >
            Speculate on match
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function TeamBlock({
  name,
  align,
}: {
  name: string;
  accent: string;
  align: "start" | "end";
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-1.5 ${align === "end" ? "items-end text-right" : "items-start text-left"}`}
    >
      <TeamFlag name={name} size={44} />
      <p className="max-w-full truncate text-small font-medium">{name}</p>
    </div>
  );
}
