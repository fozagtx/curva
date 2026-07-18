"use client";

// User hub: every stake across fixtures + claim when settled.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, CardBody, Chip, Skeleton } from "@heroui/react";
import { Icon } from "@iconify/react";
import TopBar from "@/components/top-bar";
import { useWallet, getProvider, shortAddress } from "@/lib/wallet";
import { claimTx, explorerUrl, lamportsToSol, type MarketSide } from "@/lib/markets/client";

type PositionRow = {
  fixtureId: number;
  side: number;
  amount: number;
  claimed: boolean;
  settled: boolean;
  outcome: number | null;
  pools: [number, number, number];
  marketAddress: string;
  home: string;
  away: string;
  homeParti: number;
  startTime: number;
  positionAddress: string;
};

const SIDE_LABEL = ["P1", "Draw", "P2"] as const;

export default function HubPage() {
  const { pubkey, connecting, connect } = useWallet();
  const [rows, setRows] = useState<PositionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!pubkey) {
      setRows(null);
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/portfolio?owner=${pubkey}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setRows(body.positions as PositionRow[]);
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
      setRows([]);
    }
  }, [pubkey]);

  useEffect(() => {
    void load();
  }, [load]);

  const sideName = (r: PositionRow) => {
    if (r.side === 1) return "Draw";
    const homeIsP1 = r.homeParti === 1;
    if (r.side === 0) return homeIsP1 ? r.home : r.away || "P1";
    return homeIsP1 ? r.away || "P2" : r.home;
  };

  const claimable = (r: PositionRow) =>
    r.settled && !r.claimed && r.outcome != null && r.side === r.outcome && r.amount > 0;

  const onClaim = async (r: PositionRow) => {
    const wallet = getProvider();
    if (!wallet || !pubkey) return;
    setBusy(r.positionAddress);
    setError(null);
    try {
      const sig = await claimTx(wallet, r.fixtureId, r.side as MarketSide);
      setLastTx(sig);
      fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txSig: sig }),
      }).catch(() => {});
      await load();
    } catch (err) {
      const msg = String(err instanceof Error ? err.message : err);
      setError(msg.includes("User rejected") ? "Transaction cancelled." : msg.slice(0, 220));
    } finally {
      setBusy(null);
    }
  };

  const totalStaked = rows?.reduce((s, r) => s + r.amount, 0) ?? 0;
  const claimCount = rows?.filter(claimable).length ?? 0;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 py-3 sm:px-5 sm:py-5 lg:px-6">
      <TopBar backHref="/" />

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Your hub</h1>
        <p className="text-small text-default-500">
          Stakes across every Kryva market. Claim here when a match settles on-chain.
        </p>
      </div>

      {!pubkey ? (
        <Card className="border-small border-default-200" shadow="sm">
          <CardBody className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <p className="text-small text-default-500">
              Connect Phantom to see your positions and claim winnings.
            </p>
            <Button
              color="primary"
              isLoading={connecting}
              radius="full"
              startContent={connecting ? undefined : <Icon icon="solar:wallet-bold" width={18} />}
              onPress={() => void connect()}
            >
              Connect wallet
            </Button>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Wallet" value={shortAddress(pubkey)} />
            <Stat
              label="Staked"
              value={`${lamportsToSol(totalStaked)} SOL`}
            />
            <Stat label="Ready to claim" value={String(claimCount)} />
          </div>

          {error ? (
            <p className="text-tiny text-danger">{error}</p>
          ) : null}
          {lastTx ? (
            <p className="font-mono text-tiny text-default-400">
              Last claim:{" "}
              <a
                className="underline decoration-dotted"
                href={explorerUrl("tx", lastTx)}
                rel="noreferrer"
                target="_blank"
              >
                {lastTx.slice(0, 16)}…
              </a>
            </p>
          ) : null}

          {rows === null ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 rounded-large" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <Card className="border-small border-dashed border-default-200" shadow="none">
              <CardBody className="flex flex-col items-center gap-2 p-8">
                <Icon className="text-default-300" icon="solar:safe-square-bold-duotone" width={32} />
                <p className="text-small text-default-400">No stakes yet for this wallet.</p>
                <Button as={Link} color="primary" href="/" radius="full" size="sm">
                  Browse matches
                </Button>
              </CardBody>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {rows.map((r) => {
                const won = r.settled && r.outcome === r.side;
                const lost = r.settled && r.outcome !== r.side;
                return (
                  <Card
                    key={r.positionAddress}
                    className="border-small border-default-200"
                    shadow="sm"
                  >
                    <CardBody className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            className="truncate text-small font-medium hover:underline"
                            href={`/m/${r.fixtureId}`}
                          >
                            {r.home}
                            {r.away ? ` vs ${r.away}` : ""}
                          </Link>
                          {r.settled ? (
                            <Chip
                              color={won ? "success" : "default"}
                              size="sm"
                              variant="flat"
                            >
                              {won ? "Won" : lost ? "Lost" : "Settled"}
                            </Chip>
                          ) : (
                            <Chip size="sm" variant="flat">
                              Open
                            </Chip>
                          )}
                          {r.claimed ? (
                            <Chip color="secondary" size="sm" variant="flat">
                              Claimed
                            </Chip>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-tiny text-default-400">
                          {lamportsToSol(r.amount)} SOL on{" "}
                          <span className="font-medium text-default-600">{sideName(r)}</span>
                          {" · "}
                          <span className="font-mono">{SIDE_LABEL[r.side as 0 | 1 | 2]}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          as={Link}
                          href={`/m/${r.fixtureId}`}
                          radius="full"
                          size="sm"
                          variant="bordered"
                        >
                          Open
                        </Button>
                        {claimable(r) ? (
                          <Button
                            color="primary"
                            isLoading={busy === r.positionAddress}
                            isDisabled={!!busy}
                            radius="full"
                            size="sm"
                            startContent={
                              busy === r.positionAddress ? undefined : (
                                <Icon icon="solar:cup-star-bold" width={16} />
                              )
                            }
                            onPress={() => void onClaim(r)}
                          >
                            Claim
                          </Button>
                        ) : null}
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-small border-default-200" shadow="sm">
      <CardBody className="gap-0.5 p-3">
        <p className="text-[10px] font-medium uppercase tracking-wide text-default-400">
          {label}
        </p>
        <p className="truncate font-mono text-small font-semibold">{value}</p>
      </CardBody>
    </Card>
  );
}
