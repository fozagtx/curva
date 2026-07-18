"use client";

// The hero: live win-probability wave with event markers.
// SVG stretches to fill; all text renders as HTML overlays so nothing distorts.

import React, { useMemo } from "react";
import { Card, CardBody, Chip, cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { FixtureMeta } from "@/lib/engine/state";
import type { MatchEvent } from "@/lib/engine/events";
import { homeAwayProbs, type ProbPoint } from "@/lib/usePulse";

const W = 720;
const H = 240;
const PAD_L = 6;
const PAD_R = 6;
const PAD_T = 14;
const PAD_B = 14;

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
  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx.toFixed(1)} ${y0.toFixed(1)}, ${cx.toFixed(1)} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d;
}

function areaPath(points: [number, number][]): string {
  if (points.length < 2) return "";
  const line = smoothPath(points);
  const [xEnd] = points[points.length - 1];
  const [xStart] = points[0];
  return `${line} L ${xEnd.toFixed(1)} ${H - PAD_B} L ${xStart.toFixed(1)} ${H - PAD_B} Z`;
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
    const xOf = (ts: number) => PAD_L + ((ts - t0) / (t1 - t0)) * (W - PAD_L - PAD_R);
    const yOf = (p: number) => PAD_T + (1 - p) * (H - PAD_T - PAD_B);

    const home: [number, number][] = [];
    const away: [number, number][] = [];
    const draw: [number, number][] = [];
    for (const pt of probs) {
      const ha = homeAwayProbs(meta, pt.probs);
      home.push([xOf(pt.ts), yOf(ha.home)]);
      away.push([xOf(pt.ts), yOf(ha.away)]);
      draw.push([xOf(pt.ts), yOf(ha.draw)]);
    }

    const markers = events
      .filter((e) => EVENT_ICON[e.kind] && e.ts >= t0 && e.ts <= t1)
      .slice(0, 40)
      .map((e) => ({ xPct: (xOf(e.ts) / W) * 100, x: xOf(e.ts), ev: e }));

    const phaseMarks = events
      .filter((e) => (e.kind === "halftime" || e.kind === "fulltime") && e.ts >= t0 && e.ts <= t1)
      .map((e) => ({
        x: xOf(e.ts),
        xPct: (xOf(e.ts) / W) * 100,
        label: e.kind === "halftime" ? "HT" : "FT",
      }));

    const last = probs[probs.length - 1];
    const ha = homeAwayProbs(meta, last.probs);
    const label = (p: number, pts: [number, number][]) => ({
      pct: `${(p * 100).toFixed(0)}%`,
      xPct: Math.min(92, (pts[pts.length - 1][0] / W) * 100),
      yPct: (pts[pts.length - 1][1] / H) * 100,
    });

    return {
      home, away, draw, markers, phaseMarks,
      labels: {
        home: label(ha.home, home),
        away: label(ha.away, away),
        draw: label(ha.draw, draw),
      },
      lastX: xOf(last.ts),
    };
  }, [probs, meta, events]);

  if (!view || !meta) {
    return (
      <Card className="border-small border-default-200" shadow="sm">
        <CardBody className="flex min-h-[280px] flex-col items-center justify-center gap-3 p-6">
          <Icon className="text-default-300" icon="solar:chart-2-bold-duotone" width={40} />
          <p className="text-small text-default-400">
            {connected ? "Waiting for the market to speak…" : "Connecting to the live feed…"}
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="border-small border-default-200" shadow="sm">
      <CardBody className="gap-3 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-small font-medium text-default-500">Win probability</p>
            <Chip color={mode === "live" ? "danger" : "secondary"} size="sm" variant="flat">
              {mode === "live" ? "LIVE" : "REPLAY"}
            </Chip>
          </div>
          <p className="hidden text-tiny text-default-400 sm:block">TxLINE StablePrice consensus</p>
        </div>

        <div className="relative h-56 w-full sm:h-64">
          <svg className="h-full w-full" preserveAspectRatio="none" viewBox={`0 0 ${W} ${H}`}>
            <defs>
              <linearGradient id="homeFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={HOME_COLOR} stopOpacity="0.22" />
                <stop offset="100%" stopColor={HOME_COLOR} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="awayFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={AWAY_COLOR} stopOpacity="0.18" />
                <stop offset="100%" stopColor={AWAY_COLOR} stopOpacity="0" />
              </linearGradient>
            </defs>

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
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {view.phaseMarks.map((m) => (
              <line
                key={`phase-${m.x}`}
                stroke="#52525B"
                strokeDasharray="2 4"
                strokeWidth={1}
                x1={m.x}
                x2={m.x}
                y1={PAD_T}
                y2={H - PAD_B}
                vectorEffect="non-scaling-stroke"
              />
            ))}

            {view.markers.map(({ x, ev }) => (
              <line
                key={`m-${ev.id}-${ev.kind}`}
                stroke={ev.kind.includes("goal") ? "#FACC15" : "#3F3F46"}
                strokeWidth={ev.kind.includes("goal") ? 1.5 : 1}
                opacity={0.7}
                x1={x}
                x2={x}
                y1={PAD_T}
                y2={H - PAD_B}
                vectorEffect="non-scaling-stroke"
              />
            ))}

            <path d={areaPath(view.away)} fill="url(#awayFill)" />
            <path d={areaPath(view.home)} fill="url(#homeFill)" />

            <path d={smoothPath(view.draw)} fill="none" stroke={DRAW_COLOR} strokeDasharray="3 5" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            <path d={smoothPath(view.away)} fill="none" stroke={AWAY_COLOR} strokeLinecap="round" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
            <path d={smoothPath(view.home)} fill="none" stroke={HOME_COLOR} strokeLinecap="round" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />

            <circle cx={view.lastX} cy={view.home[view.home.length - 1][1]} fill={HOME_COLOR} r={4}>
              <animate attributeName="r" dur="1.6s" repeatCount="indefinite" values="3;5;3" />
            </circle>
            <circle cx={view.lastX} cy={view.away[view.away.length - 1][1]} fill={AWAY_COLOR} r={4}>
              <animate attributeName="r" dur="1.6s" repeatCount="indefinite" values="3;5;3" />
            </circle>
          </svg>

          {/* HTML overlays: never distort */}
          {(["home", "away", "draw"] as const).map((k) => {
            const l = view.labels[k];
            const color = k === "home" ? HOME_COLOR : k === "away" ? AWAY_COLOR : DRAW_COLOR;
            return (
              <span
                key={k}
                className={cn(
                  "pointer-events-none absolute -translate-y-1/2 rounded-full bg-background/70 px-1.5 font-mono font-semibold tabular-nums backdrop-blur-sm",
                  k === "draw" ? "text-[10px]" : "text-xs",
                )}
                style={{ left: `${l.xPct}%`, top: `${l.yPct}%`, color }}
              >
                {l.pct}
              </span>
            );
          })}

          {view.phaseMarks.map((m) => (
            <span
              key={`pl-${m.x}`}
              className="pointer-events-none absolute -translate-x-1/2 font-mono text-[10px] text-default-400"
              style={{ left: `${m.xPct}%`, bottom: -2 }}
            >
              {m.label}
            </span>
          ))}

          <div className="pointer-events-none absolute inset-x-0 top-0 h-0">
            {view.markers.map(({ xPct, ev }) => (
              <span
                key={`i-${ev.id}-${ev.kind}`}
                className="absolute -translate-x-1/2"
                style={{ left: `${xPct}%`, top: -4 }}
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
                  width={13}
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
