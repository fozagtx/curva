"use client";

import { useEffect, useState } from "react";
import { Card, CardBody } from "@heroui/react";

type Stats = {
  tvlLamports: number;
  marketsOpen: number;
  settlements: number;
  scouts: number;
};

export default function ProtocolStats({
  fallbackTvl,
  fallbackOpen,
}: {
  fallbackTvl?: number;
  fallbackOpen?: number;
}) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats")
      .then((r) => r.json())
      .then((b) => {
        if (!cancelled && b.tvlLamports != null) {
          setStats({
            tvlLamports: Number(b.tvlLamports),
            marketsOpen: Number(b.marketsOpen),
            settlements: Number(b.settlements),
            scouts: Number(b.scouts),
          });
        }
      })
      .catch(() => { /* strip is optional */ });
    return () => {
      cancelled = true;
    };
  }, []);

  const tvl = (stats?.tvlLamports ?? fallbackTvl ?? 0) / 1e9;
  const open = stats?.marketsOpen ?? fallbackOpen ?? 0;
  const settled = stats?.settlements ?? 0;
  const scouts = stats?.scouts ?? 0;

  const cells = [
    {
      label: "Locked value",
      value: `${tvl.toLocaleString(undefined, { maximumFractionDigits: 2 })} SOL`,
    },
    { label: "Open markets", value: String(open) },
    { label: "Settlements", value: String(settled) },
    { label: "Active scouts", value: String(scouts) },
  ];

  return (
    <Card className="border-small border-default-200" shadow="sm">
      <CardBody className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-4 sm:gap-4 sm:p-4">
        {cells.map((c) => (
          <div key={c.label} className="flex flex-col gap-0.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-default-400">
              {c.label}
            </p>
            <p className="font-mono text-small font-semibold tabular-nums sm:text-medium">
              {c.value}
            </p>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
