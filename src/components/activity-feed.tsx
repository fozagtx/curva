"use client";

// Receipts feed: every row is a confirmed on-chain transaction, linked to the
// explorer. The server verified each one before it was recorded.

import { useEffect, useState } from "react";
import { Card, CardBody, cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { FixtureMeta } from "@/lib/engine/state";
import { explorerUrl } from "@/lib/markets/client";

interface ActivityItem {
  tx_sig: string;
  fixture_id: number;
  kind: string;
  wallet: string;
  side: number | null;
  amount_lamports: number | null;
  created_at: string;
}

const KIND_META: Record<string, { icon: string; tone: string; label: (a: ActivityItem, sides: string[]) => string }> = {
  create_market: {
    icon: "solar:add-circle-bold",
    tone: "text-default-500",
    label: () => "opened the market",
  },
  stake: {
    icon: "solar:lock-keyhole-bold",
    tone: "text-primary",
    label: (a, sides) =>
      `staked ${((a.amount_lamports ?? 0) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 3 })} SOL on ${sides[a.side ?? 0]}`,
  },
  settle: {
    icon: "solar:shield-check-bold",
    tone: "text-success",
    label: (a, sides) => `settled the market - ${sides[a.side ?? 0]} proven on-chain`,
  },
  claim: {
    icon: "solar:cup-star-bold",
    tone: "text-warning",
    label: () => "claimed winnings",
  },
};

export default function ActivityFeed({ meta }: { meta: FixtureMeta | null }) {
  const [items, setItems] = useState<ActivityItem[] | null>(null);

  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    const load = () =>
      fetch(`/api/activity?fixtureId=${meta.fixtureId}`)
        .then((r) => r.json())
        .then((b) => {
          if (!cancelled && Array.isArray(b.activity)) setItems(b.activity);
        })
        .catch(() => { /* feed is optional */ });
    load();
    const t = setInterval(load, 20_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [meta]);

  if (!meta || !items || items.length === 0) return null;

  const sides = (() => {
    const p1 = meta.home.parti === 1 ? meta.home.name : meta.away.name;
    const p2 = meta.home.parti === 1 ? meta.away.name : meta.home.name;
    return [p1, "Draw", p2];
  })();

  return (
    <Card className="h-full border-small border-default-200" shadow="sm">
      <CardBody className="gap-2 p-3">
        <p className="text-tiny font-medium uppercase tracking-wide text-default-400">
          On-chain receipts
        </p>
        <div className="flex max-h-52 flex-col gap-0.5 overflow-y-auto">
          {items.slice(0, 12).map((a) => {
            const k = KIND_META[a.kind] ?? KIND_META.create_market;
            return (
              <a
                key={a.tx_sig}
                className="flex items-center gap-2 rounded-medium px-2 py-1.5 transition-colors hover:bg-default-50"
                href={explorerUrl("tx", a.tx_sig)}
                rel="noreferrer"
                target="_blank"
              >
                <Icon className={cn("shrink-0", k.tone)} icon={k.icon} width={15} />
                <p className="min-w-0 flex-1 truncate text-tiny text-default-500">
                  <span className="font-mono text-default-400">
                    {a.wallet.slice(0, 4)}…{a.wallet.slice(-4)}
                  </span>{" "}
                  {k.label(a, sides)}
                </p>
                <Icon className="shrink-0 text-default-300" icon="solar:square-top-up-linear" width={12} />
              </a>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
