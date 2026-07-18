"use client";

import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";

const STEPS = [
  {
    n: "01",
    title: "Stake",
    body: "Put SOL on Home, Draw, or Away. Escrow sits in a vault no one controls.",
    icon: "solar:safe-square-bold-duotone",
  },
  {
    n: "02",
    title: "Watch",
    body: "TxLINE consensus odds move the curve live. Call swings risk-free with Kryva Calls.",
    icon: "solar:pulse-2-bold-duotone",
  },
  {
    n: "03",
    title: "Settle",
    body: "After full-time, a Merkle proof unlocks the pot. Claim only if the chain agrees.",
    icon: "solar:shield-check-bold-duotone",
  },
] as const;

export default function HowItWorks() {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {STEPS.map((s) => (
        <Card key={s.n} className="border-small border-default-200" shadow="sm">
          <CardBody className="flex flex-row items-start gap-3 p-3 sm:flex-col sm:gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-tiny text-default-300">{s.n}</span>
              <div className="flex rounded-medium border border-primary-100 bg-primary-50 p-1.5">
                <Icon className="text-primary" icon={s.icon} width={18} />
              </div>
            </div>
            <div>
              <p className="text-small font-semibold">{s.title}</p>
              <p className="text-tiny leading-snug text-default-400">{s.body}</p>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
