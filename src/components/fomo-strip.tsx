"use client";

import { useEffect, useState } from "react";
import { Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  formatCountdown,
  msUntil,
  type SocialPing,
  type Urgency,
} from "@/lib/fomo";

/** Live countdown chip - ticks every second. */
export function KickoffCountdown({
  startTime,
  urgency,
}: {
  startTime: number;
  urgency: Urgency;
}) {
  const [left, setLeft] = useState(() => msUntil(startTime));

  useEffect(() => {
    setLeft(msUntil(startTime));
    const t = setInterval(() => setLeft(msUntil(startTime)), 1000);
    return () => clearInterval(t);
  }, [startTime]);

  if (urgency === "live") {
    return (
      <Chip
        className="font-bold"
        color="danger"
        size="sm"
        startContent={<span className="mx-1 h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />}
        variant="solid"
      >
        LIVE NOW
      </Chip>
    );
  }
  if (urgency === "locked") {
    return (
      <Chip color="default" size="sm" variant="flat">
        Full-time
      </Chip>
    );
  }

  const hot = urgency === "closing" || urgency === "hot";
  return (
    <Chip
      className="font-mono font-bold tabular-nums"
      color={urgency === "closing" ? "danger" : hot ? "warning" : "success"}
      size="sm"
      startContent={<Icon icon="solar:alarm-bold" width={13} />}
      variant={urgency === "closing" ? "solid" : "flat"}
    >
      {urgency === "closing" ? "LOCKS " : "KO "}
      {formatCountdown(left)}
    </Chip>
  );
}

/** Rotating “someone just staked” social proof. */
export function SocialProofTicker({
  pings,
  fixtureId,
}: {
  pings: SocialPing[];
  fixtureId?: number;
}) {
  const list =
    fixtureId != null ? pings.filter((p) => p.fixtureId === fixtureId) : pings;
  const [i, setI] = useState(0);

  useEffect(() => {
    if (list.length <= 1) return;
    const t = setInterval(() => setI((x) => (x + 1) % list.length), 3200);
    return () => clearInterval(t);
  }, [list.length]);

  if (!list.length) return null;
  const ping = list[i % list.length];

  return (
    <div className="flex w-full max-w-lg items-center gap-2 rounded-full border border-warning-200 bg-warning-50 px-3 py-1.5">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning-500 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-warning-500" />
      </span>
      <p className="min-w-0 flex-1 truncate text-tiny font-medium text-warning-800">
        {ping.text}
      </p>
      <span className="shrink-0 text-[10px] font-semibold uppercase text-warning-600">
        FOMO
      </span>
    </div>
  );
}

export function HotPoolBadge({
  isHottest,
  poolSol,
}: {
  isHottest: boolean;
  poolSol: number;
}) {
  if (!isHottest || poolSol <= 0) return null;
  return (
    <Chip
      className="font-bold"
      color="warning"
      size="sm"
      startContent={<Icon icon="solar:fire-bold" width={13} />}
      variant="flat"
    >
      Hottest pool
    </Chip>
  );
}
