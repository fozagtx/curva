"use client";

// Big score card: teams, score, phase chip, drama meter.

import { Card, CardBody, Chip, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { FixtureMeta, ScoreState } from "@/lib/engine/state";
import { homeAwayScore } from "@/lib/usePulse";

const PHASE_LABEL: Record<string, string> = {
  NS: "Kick-off soon", H1: "1st half", HT: "Half-time", H2: "2nd half",
  F: "Full-time", WET: "Extra time soon", ET1: "ET 1st half", HTET: "ET break",
  ET2: "ET 2nd half", FET: "Full-time (AET)", WPE: "Pens coming", PE: "Penalties",
  FPE: "Decided on pens", I: "Interrupted", A: "Abandoned", C: "Cancelled", P: "Postponed",
};

const LIVE = new Set(["H1", "H2", "ET1", "ET2", "PE"]);

function TeamTile({ name, accent }: { name: string; accent: string }) {
  const code = name.slice(0, 3).toUpperCase();
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full border text-small font-semibold"
        style={{ borderColor: `${accent}55`, background: `${accent}14`, color: accent }}
      >
        {code}
      </div>
      <p className="max-w-full truncate text-small font-medium">{name}</p>
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
        <CardBody className="h-28 animate-pulse p-4" />
      </Card>
    );
  }
  const goals = score ? homeAwayScore(meta, score.goals) : [0, 0];
  const pens = score?.penaltyGoals ? homeAwayScore(meta, score.penaltyGoals) : null;
  const live = LIVE.has(phase);

  return (
    <Card className="border-small border-default-200" shadow="sm">
      <CardBody className="gap-4 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <Chip
            color={live ? "danger" : "default"}
            size="sm"
            startContent={live ? <span className="mx-1 h-1.5 w-1.5 animate-pulse rounded-full bg-danger" /> : undefined}
            variant="flat"
          >
            {PHASE_LABEL[phase] ?? phase}
            {live && minute ? ` · ${minute}'` : ""}
          </Chip>
          <p className="text-tiny text-default-400">{meta.competition}</p>
        </div>

        <div className="flex items-center gap-2">
          <TeamTile accent="#22C55E" name={meta.home.name} />
          <div className="flex flex-col items-center px-2">
            <p className="font-mono text-4xl font-semibold tabular-nums sm:text-5xl">
              {goals[0]}
              <span className="px-1.5 text-default-400">–</span>
              {goals[1]}
            </p>
            {pens ? (
              <p className="font-mono text-tiny text-default-400">
                pens {pens[0]}–{pens[1]}
              </p>
            ) : null}
          </div>
          <TeamTile accent="#38BDF8" name={meta.away.name} />
        </div>

        <div className="flex items-center gap-3">
          <Icon
            className={drama >= 60 ? "text-danger" : drama >= 30 ? "text-warning" : "text-default-400"}
            icon="solar:fire-bold"
            width={18}
          />
          <Progress
            aria-label="Drama meter"
            classNames={{ indicator: drama >= 60 ? "bg-danger" : drama >= 30 ? "bg-warning" : "bg-primary" }}
            size="sm"
            value={drama}
          />
          <p className="w-24 shrink-0 text-right text-tiny text-default-400">
            {drama >= 60 ? "Chaos" : drama >= 30 ? "Heating up" : "Calm"} · {drama}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
