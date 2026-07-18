"use client";

// "Provably real" card: asks Solana devnet to check the final score's Merkle
// proof via the TxOracle program and shows the receipt.

import { useState } from "react";
import { Button, Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { FixtureMeta } from "@/lib/engine/state";
import { homeAwayScore } from "@/lib/usePulse";

interface VerifyResult {
  verified: boolean;
  seq: number;
  goals: [number, number];
  epochDay: number;
  rootAccount: string;
  programId: string;
  network: string;
  error?: string;
}

export default function VerifyCard({ meta }: { meta: FixtureMeta | null }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!meta) return null;

  const run = async () => {
    setState("loading");
    setError(null);
    try {
      const res = await fetch(`/api/verify/${meta.fixtureId}`);
      const body = (await res.json()) as VerifyResult & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setResult(body);
      setState("done");
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
      setState("error");
    }
  };

  const goals = result ? homeAwayScore(meta, result.goals) : null;

  return (
    <Card className="border-small border-default-200" shadow="sm">
      <CardBody className="gap-3 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex rounded-medium border border-primary-100 bg-primary-50 p-2">
              <Icon className="text-primary" icon="solar:shield-check-bold-duotone" width={20} />
            </div>
            <div>
              <p className="text-medium font-semibold">Provably real</p>
              <p className="text-tiny text-default-400">
                Ask Solana to check this scoreline, not us.
              </p>
            </div>
          </div>
          {state !== "done" ? (
            <Button
              color="primary"
              isLoading={state === "loading"}
              radius="full"
              size="sm"
              startContent={state === "loading" ? undefined : <Icon icon="solar:shield-check-bold" width={16} />}
              onPress={run}
            >
              {state === "loading" ? "Asking the chain" : "Verify on Solana"}
            </Button>
          ) : (
            <Chip
              color={result?.verified ? "success" : "danger"}
              startContent={<Icon icon={result?.verified ? "solar:check-circle-bold" : "solar:close-circle-bold"} width={16} />}
              variant="flat"
            >
              {result?.verified ? "Verified" : "Mismatch"}
            </Chip>
          )}
        </div>

        {state === "done" && result && goals ? (
          <div className="flex flex-col gap-1 rounded-medium border border-primary-100 bg-primary-50 p-3">
            <p className="text-small">
              {meta.home.name} <span className="font-mono font-semibold">{goals[0]}</span> —{" "}
              <span className="font-mono font-semibold">{goals[1]}</span> {meta.away.name}{" "}
              matches the Merkle root stored on Solana {result.network}.
            </p>
            <p className="font-mono text-tiny text-default-400">
              root {result.rootAccount.slice(0, 8)}… · program {result.programId.slice(0, 8)}… · day {result.epochDay} · seq {result.seq}
            </p>
          </div>
        ) : null}

        {state === "error" ? (
          <p className="text-tiny text-default-400">
            {error?.includes("root")
              ? "The chain hasn't received this batch yet — try again in a few minutes."
              : error}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
