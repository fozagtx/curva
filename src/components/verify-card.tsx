"use client";

// "Don't trust us" card: your own browser fetches the Merkle proof and asks
// Solana devnet directly whether it validates. Our servers only relay proof
// bytes — the verdict comes from the TxOracle program over your own connection.

import { useState } from "react";
import { Button, Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { FixtureMeta } from "@/lib/engine/state";
import { homeAwayScore } from "@/lib/usePulse";
import { verifyInBrowser, type BrowserVerifyResult } from "@/lib/markets/browser-verify";
import { explorerUrl, type SettleProof } from "@/lib/markets/client";

export default function VerifyCard({ meta }: { meta: FixtureMeta | null }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<BrowserVerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!meta) return null;

  const run = async () => {
    setState("loading");
    setError(null);
    try {
      const res = await fetch(`/api/settle-proof/${meta.fixtureId}`);
      const proof = (await res.json()) as SettleProof & { error?: string };
      if (!res.ok) throw new Error(proof.error ?? `proof fetch ${res.status}`);
      const verdict = await verifyInBrowser(proof);
      setResult(verdict);
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex shrink-0 rounded-medium border border-primary-100 bg-primary-50 p-2">
              <Icon className="text-primary" icon="solar:shield-check-bold-duotone" width={20} />
            </div>
            <div className="min-w-0">
              <p className="text-medium font-semibold">Don&apos;t trust us</p>
              <p className="text-tiny text-default-400">
                Your browser asks Solana directly — our servers never touch the verdict.
              </p>
            </div>
          </div>
          {state !== "done" ? (
            <Button
              className="shrink-0 self-start sm:self-auto"
              color="primary"
              isLoading={state === "loading"}
              radius="full"
              size="sm"
              startContent={state === "loading" ? undefined : <Icon icon="solar:shield-check-bold" width={16} />}
              onPress={run}
            >
              {state === "loading" ? "Asking the chain" : "Verify in your browser"}
            </Button>
          ) : (
            <Chip
              className="self-start sm:self-auto"
              color={result?.isValid ? "success" : "danger"}
              startContent={<Icon icon={result?.isValid ? "solar:check-circle-bold" : "solar:close-circle-bold"} width={16} />}
              variant="flat"
            >
              {result?.isValid ? "Proof valid" : "Proof rejected"}
            </Chip>
          )}
        </div>

        {state === "done" && result && goals ? (
          <div className="flex flex-col gap-1 rounded-medium border border-primary-100 bg-primary-50 p-3">
            <p className="text-small">
              Your browser asked <span className="font-mono">{result.rpc.replace("https://", "")}</span>:
              the Merkle proof for {meta.home.name}{" "}
              <span className="font-mono font-semibold">{goals[0]}–{goals[1]}</span> {meta.away.name}{" "}
              {result.isValid ? "validates against" : "does not match"} the root TxODDS anchors on-chain.
            </p>
            <p className="font-mono text-tiny text-default-400">
              <a className="underline decoration-dotted" href={explorerUrl("address", result.rootsAccount)} rel="noreferrer" target="_blank">
                root {result.rootsAccount.slice(0, 8)}…
              </a>
              {" · judged by TxOracle "}
              <a className="underline decoration-dotted" href={explorerUrl("address", "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J")} rel="noreferrer" target="_blank">
                6pW64gN1…
              </a>
            </p>
          </div>
        ) : null}

        {state === "error" ? (
          <p className="text-tiny text-default-400">
            {error?.includes("proof") || error?.includes("root")
              ? "The finalisation proof isn't anchored yet — try again after the match ends."
              : error}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
