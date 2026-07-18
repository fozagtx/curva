"use client";

// Stacked list of match events, newest first.

import { Card, CardBody, cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { FixtureMeta } from "@/lib/engine/state";
import type { MatchEvent, MatchEventKind } from "@/lib/engine/events";

const ICONS: Record<MatchEventKind, { icon: string; tone: "goal" | "danger" | "warn" | "neutral" }> = {
  goal: { icon: "solar:football-bold", tone: "goal" },
  own_goal: { icon: "solar:football-bold", tone: "danger" },
  penalty_goal: { icon: "solar:football-bold", tone: "goal" },
  yellow_card: { icon: "solar:card-2-bold", tone: "warn" },
  red_card: { icon: "solar:card-2-bold", tone: "danger" },
  corner: { icon: "solar:flag-bold", tone: "neutral" },
  shot_on_target: { icon: "solar:target-bold", tone: "neutral" },
  shot_woodwork: { icon: "solar:danger-triangle-bold", tone: "warn" },
  var: { icon: "solar:videocamera-record-bold", tone: "warn" },
  var_end: { icon: "solar:videocamera-record-bold", tone: "neutral" },
  penalty_awarded: { icon: "solar:target-bold", tone: "danger" },
  penalty_missed: { icon: "solar:close-circle-bold", tone: "warn" },
  substitution: { icon: "solar:transfer-horizontal-bold", tone: "neutral" },
  kickoff: { icon: "solar:play-circle-bold", tone: "neutral" },
  halftime: { icon: "solar:pause-circle-bold", tone: "neutral" },
  fulltime: { icon: "solar:flag-2-bold", tone: "neutral" },
  phase: { icon: "solar:clock-circle-bold", tone: "neutral" },
  danger: { icon: "solar:danger-triangle-bold", tone: "warn" },
  injury: { icon: "solar:health-bold", tone: "neutral" },
};

const TONE_STYLES = {
  goal: { wrap: "bg-primary-50 border-primary-100", icon: "text-primary" },
  danger: { wrap: "bg-danger-50 border-danger-100", icon: "text-danger" },
  warn: { wrap: "bg-warning-50 border-warning-100", icon: "text-warning-600" },
  neutral: { wrap: "bg-default-50 border-default-100", icon: "text-default-500" },
} as const;

export default function EventTicker({
  meta,
  events,
}: {
  meta: FixtureMeta | null;
  events: MatchEvent[];
}) {
  if (!events.length) {
    return (
      <Card className="border-small border-dashed border-default-200" shadow="none">
        <CardBody className="flex flex-col items-center gap-2 p-8">
          <Icon className="text-default-300" icon="solar:soundwave-bold-duotone" width={32} />
          <p className="text-small text-default-400">
            Match events will land here the second they happen.
          </p>
        </CardBody>
      </Card>
    );
  }

  const teamName = (team?: 1 | 2) => {
    if (!team || !meta) return null;
    return meta.home.parti === team ? meta.home.name : meta.away.name;
  };

  return (
    <div className="flex flex-col gap-2">
      {events.slice(0, 30).map((ev) => {
        const cfg = ICONS[ev.kind];
        const tone = TONE_STYLES[cfg.tone];
        const team = teamName(ev.team);
        const big = ev.kind === "goal" || ev.kind === "penalty_goal" || ev.kind === "red_card";
        return (
          <Card
            key={`${ev.id}:${ev.kind}:${ev.label}`}
            className={cn(
              "border-small border-default-200",
              big && "border-primary-200",
            )}
            shadow="sm"
          >
            <CardBody className="flex flex-row items-center gap-3 p-3">
              <div className={cn("flex rounded-medium border p-2", tone.wrap)}>
                <Icon className={tone.icon} icon={cfg.icon} width={18} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className={cn("truncate text-small", big && "font-semibold")}>
                  {ev.label}
                  {team ? <span className="text-default-500"> · {team}</span> : null}
                </p>
                {ev.detail ? (
                  <p className="truncate text-tiny text-default-400">{ev.detail}</p>
                ) : null}
              </div>
              <p className="shrink-0 font-mono text-small text-default-400 tabular-nums">
                {ev.minute ? `${ev.minute}'` : ""}
              </p>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
