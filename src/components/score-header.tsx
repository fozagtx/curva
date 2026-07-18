"use client";

// Big score card: teams, score, phase chip, drama meter.

import { Card, CardBody, Chip, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { FixtureMeta, ScoreState } from "@/lib/engine/state";
import { homeAwayScore } from "@/lib/usePulse";
import TeamFlag from "./team-flag";

const PHASE_LABEL: Record<string, string> = {
  NS: "Kick-off soon", H1: "1st half", HT: "Half-time", H2: "2nd half",
  F: "Full-time", WET: "Extra time soon", ET1: "ET 1st half", HTET: "ET break",
  ET2: "ET 2nd half", FET: "Full-time (AET)", WPE: "Pens coming", PE: "Penalties",
  FPE: "Decided on pens", I: "Interrupted", A: "Abandoned", C: "Cancelled", P: "Postponed",
};

const LIVE = new Set(["H1", "H2", "ET1", "ET2", "PE"]);

function TeamTile({ name }: { name: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <TeamFlag name={name} size={40} />
      <p className="max-w-full truncate text-tiny font-medium sm:text-small">{name}</p>
    </div>
  );
}

export default function ScoreHeader({
  meta, score, phase, minute, drama,
}: {
  meta: FixtureMeta | null;
  score: ScoreState | null;
  phase: string;
  minute?: number;
  drama: number;
}) {
  if (!meta) {
    return (
      <Card className="border-small border-default-200" shadow="sm">
        <CardBody className="h-20 animate-pulse p-3" />
      </Card>
    );
  }
  const goals = score ? homeAwayScore(meta, score.goals) : [0, 0];
  const pens = score?.penaltyGoals ? homeAwayScore(meta, score.penaltyGoals) : null;
  const live = LIVE.has(phase);

  return (
    <Card className="border-small border-default-200" shadow="sm">
      <CardBody className="gap-2.5 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <Chip
            color={live ? "danger" : "default"}
            size="sm"
            startContent={live ? <span className="mx-1 h-1.5 w-1.5 animate-pulse rounded-full bg-danger" /> : undefined}
            variant="flat"
          >
            {phase === "NS"
              ? `Kick-off ${new Date(meta.startTime).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })}`
              : PHASE_LABEL[phase] ?? phase}
            {live && minute ? ` · ${minute}'` : ""}
          </Chip>
          <p className="text-tiny text-default-400">{meta.competition}</p>
        </div>

        <div className="flex items-center gap-2">
          <TeamTile name={meta.home.name} />
          <div className="flex flex-col items-center px-1">
            <p className="font-mono text-3xl font-semibold tabular-nums sm:text-4xl">
              {goals[0]}
              <span className="px-1 text-default-400">-</span>
              {goals[1]}
            </p>
            {pens ? (
              <p className="font-mono text-tiny text-default-400">
                pens {pens[0]}-{pens[1]}
              </p>
            ) : null}
          </div>
          <TeamTile name={meta.away.name} />
        </div>

        <div className="flex items-center gap-2">
          <Icon
            className={drama >= 60 ? "text-danger" : drama >= 30 ? "text-warning" : "text-default-400"}
            icon="solar:fire-bold"
            width={16}
          />
          <Progress
            aria-label="Drama meter"
            classNames={{ indicator: drama >= 60 ? "bg-danger" : drama >= 30 ? "bg-warning" : "bg-primary" }}
            size="sm"
            value={drama}
          />
          <p className="w-24 shrink-0 text-right text-tiny text-default-400">
            {["F", "FET", "FPE"].includes(phase)
              ? `Peak · ${drama}`
              : `${drama >= 60 ? "Chaos" : drama >= 30 ? "Heating" : "Calm"} · ${drama}`}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
