"use client";

// Compact event list in a scroll pane — newest first.

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
  const teamName = (team?: 1 | 2) => {
    if (!team || !meta) return null;
    return meta.home.parti === team ? meta.home.name : meta.away.name;
  };

  return (
    <Card className="h-full border-small border-default-200" shadow="sm">
      <CardBody className="gap-2 p-3">
        <p className="text-tiny font-medium uppercase tracking-wide text-default-400">
          As it happened
        </p>
        {!events.length ? (
          <div className="flex max-h-52 min-h-[8rem] flex-col items-center justify-center gap-1.5 px-2 py-6">
            <Icon className="text-default-300" icon="solar:soundwave-bold-duotone" width={28} />
            <p className="text-center text-tiny text-default-400">
              Events land here the second they happen.
            </p>
          </div>
        ) : (
          <div className="flex max-h-52 flex-col gap-1 overflow-y-auto">
            {events.slice(0, 24).map((ev) => {
              const cfg = ICONS[ev.kind];
              const tone = TONE_STYLES[cfg.tone];
              const team = teamName(ev.team);
              const big =
                ev.kind === "goal" || ev.kind === "penalty_goal" || ev.kind === "red_card";
              return (
                <div
                  key={`${ev.id}:${ev.kind}:${ev.label}`}
                  className={cn(
                    "flex items-center gap-2 rounded-medium border px-2 py-1.5",
                    tone.wrap,
                    big && "border-primary-200",
                  )}
                >
                  <Icon className={cn("shrink-0", tone.icon)} icon={cfg.icon} width={15} />
                  <p className={cn("min-w-0 flex-1 truncate text-tiny", big && "font-semibold")}>
                    {ev.label}
                    {team ? <span className="text-default-500"> · {team}</span> : null}
                  </p>
                  <p className="shrink-0 font-mono text-tiny tabular-nums text-default-400">
                    {ev.minute ? `${ev.minute}'` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
