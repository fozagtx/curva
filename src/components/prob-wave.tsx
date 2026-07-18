"use client";

// The hero: live win-probability wave with event markers.
// Pure SVG, renders from the prob series; team lines lurch on goals in real time.

import React, { useMemo } from "react";
import { Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { FixtureMeta } from "@/lib/engine/state";
import type { MatchEvent } from "@/lib/engine/events";
import { homeAwayProbs, type ProbPoint } from "@/lib/usePulse";

const W = 720;
const H = 260;
const PAD_L = 8;
const PAD_R = 64;
const PAD_T = 18;
const PAD_B = 22;

const HOME_COLOR = "#22C55E";
const AWAY_COLOR = "#38BDF8";
const DRAW_COLOR = "#71717A";

interface Props {
  meta: FixtureMeta | null;
  probs: ProbPoint[];
  events: MatchEvent[];
  connected: boolean;
  mode: "live" | "replay";
}

function smoothPath(points: [number, number][]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx.toFixed(1)} ${y0.toFixed(1)}, ${cx.toFixed(1)} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d;
}

const EVENT_ICON: Partial<Record<MatchEvent["kind"], string>> = {
  goal: "solar:football-bold",
  own_goal: "solar:football-bold",
  penalty_goal: "solar:football-bold",
  red_card: "solar:card-2-bold",
  var: "solar:videocamera-record-bold",
  penalty_awarded: "solar:target-bold",
  penalty_missed: "solar:close-circle-bold",
};

export default function ProbWave({ meta, probs, events, connected, mode }: Props) {
  const view = useMemo(() => {
    if (probs.length < 2 || !meta) return null;

    const t0 = probs[0].ts;
    const t1 = Math.max(probs[probs.length - 1].ts, t0 + 10 * 60 * 1000);
    const xOf = (ts: number) =>
      PAD_L + ((ts - t0) / (t1 - t0)) * (W - PAD_L - PAD_R);
    const yOf = (p: number) => PAD_T + (1 - p) * (H - PAD_T - PAD_B);

    const home: [number, number][] = [];
    const away: [number, number][] = [];
    const draw: [number, number][] = [];
    for (const pt of probs) {
      const { home: hp, draw: dp, away: ap } = homeAwayProbs(meta, pt.probs);
      home.push([xOf(pt.ts), yOf(hp)]);
      away.push([xOf(pt.ts), yOf(ap)]);
      draw.push([xOf(pt.ts), yOf(dp)]);
    }

    const markers = events
      .filter((e) => EVENT_ICON[e.kind] && e.ts >= t0)
      .slice(0, 40)
      .map((e) => ({ x: xOf(e.ts), ev: e }));

    const last = probs[probs.length - 1];
    const lastHA = homeAwayProbs(meta, last.probs);

    return { home, away, draw, markers, last: lastHA, lastX: xOf(last.ts) };
  }, [probs, meta, events]);

  if (!view || !meta) {
    return (
      <Card className="border-small border-default-200" shadow="sm">
        <CardBody className="flex min-h-[280px] items-center justify-center gap-3 p-6">
          <Icon
            className="text-default-300"
            icon="solar:chart-2-bold-duotone"
            width={40}
          />
          <p className="text-small text-default-400">
            {connected
              ? "Waiting for the market to speak…"
              : "Connecting to the live feed…"}
          </p>
        </CardBody>
      </Card>
    );
  }

  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <Card className="border-small border-default-200" shadow="sm">
      <CardBody className="gap-3 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-small font-medium text-default-500">
              Win probability
            </p>
            <Chip
              color={mode === "live" ? "danger" : "secondary"}
              size="sm"
              variant="flat"
            >
              {mode === "live" ? "LIVE" : "REPLAY"}
            </Chip>
          </div>
          <p className="text-tiny text-default-400">
            TxLINE StablePrice consensus
          </p>
        </div>

        <div className="relative w-full">
          <svg
            className="h-auto w-full"
            preserveAspectRatio="none"
            viewBox={`0 0 ${W} ${H}`}
          >
            {/* grid */}
            {[0.25, 0.5, 0.75].map((p) => (
              <line
                key={p}
                stroke="#27272A"
                strokeDasharray={p === 0.5 ? "0" : "4 6"}
                strokeWidth={1}
                x1={PAD_L}
                x2={W - PAD_R}
                y1={PAD_T + (1 - p) * (H - PAD_T - PAD_B)}
                y2={PAD_T + (1 - p) * (H - PAD_T - PAD_B)}
              />
            ))}

            {/* event markers */}
            {view.markers.map(({ x, ev }) => (
              <g key={ev.id + ev.kind}>
                <line
                  stroke={ev.kind.includes("goal") ? "#FACC15" : "#3F3F46"}
                  strokeWidth={ev.kind.includes("goal") ? 1.5 : 1}
                  x1={x}
                  x2={x}
                  y1={PAD_T}
                  y2={H - PAD_B}
                  opacity={0.7}
                />
              </g>
            ))}

            {/* series */}
            <path d={smoothPath(view.draw)} fill="none" stroke={DRAW_COLOR} strokeDasharray="3 5" strokeWidth={1.5} />
            <path d={smoothPath(view.away)} fill="none" stroke={AWAY_COLOR} strokeLinecap="round" strokeWidth={2.5} />
            <path d={smoothPath(view.home)} fill="none" stroke={HOME_COLOR} strokeLinecap="round" strokeWidth={2.5} />

            {/* live dots */}
            <circle cx={view.lastX} cy={view.home[view.home.length - 1][1]} fill={HOME_COLOR} r={4}>
              <animate attributeName="r" dur="1.6s" repeatCount="indefinite" values="3;5;3" />
            </circle>
            <circle cx={view.lastX} cy={view.away[view.away.length - 1][1]} fill={AWAY_COLOR} r={4}>
              <animate attributeName="r" dur="1.6s" repeatCount="indefinite" values="3;5;3" />
            </circle>

            {/* right-edge labels */}
            <text fill={HOME_COLOR} fontSize={15} fontWeight={600} x={view.lastX + 10} y={view.home[view.home.length - 1][1] + 5}>
              {pct(view.last.home)}
            </text>
            <text fill={AWAY_COLOR} fontSize={15} fontWeight={600} x={view.lastX + 10} y={view.away[view.away.length - 1][1] + 5}>
              {pct(view.last.away)}
            </text>
            <text fill={DRAW_COLOR} fontSize={12} x={view.lastX + 10} y={view.draw[view.draw.length - 1][1] + 4}>
              {pct(view.last.draw)}
            </text>
          </svg>

          {/* event icon row overlaid on top edge */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-0">
            {view.markers.map(({ x, ev }) => (
              <span
                key={`i-${ev.id}-${ev.kind}`}
                className="absolute -translate-x-1/2"
                style={{ left: `${(x / W) * 100}%`, top: -2 }}
              >
                <Icon
                  className={
                    ev.kind.includes("goal")
                      ? "text-warning"
                      : ev.kind === "red_card"
                        ? "text-danger"
                        : "text-default-400"
                  }
                  icon={EVENT_ICON[ev.kind]!}
                  width={14}
                />
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="flex items-center gap-2 text-small">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: HOME_COLOR }} />
            {meta.home.name}
          </span>
          <span className="flex items-center gap-2 text-small">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: AWAY_COLOR }} />
            {meta.away.name}
          </span>
          <span className="flex items-center gap-2 text-small text-default-400">
            <span className="h-0.5 w-4 rounded-full" style={{ background: DRAW_COLOR }} />
            Draw
          </span>
        </div>
      </CardBody>
    </Card>
  );
}
