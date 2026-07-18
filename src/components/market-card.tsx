"use client";

// The market: stake SOL on the result, watch the pot, settle with a TxLINE
// proof, claim. Settlement is permissionless — the button hands the Merkle
// proof to the TxOracle program on devnet and Solana decides.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, CardBody, Chip, Progress, cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { FixtureMeta } from "@/lib/engine/state";
import { homeAwayProbs, type ProbPoint } from "@/lib/usePulse";
import { useWallet, getProvider } from "@/lib/wallet";
import {
  createMarketTx,
  stakeTx,
  settleTx,
  claimTx,
  explorerUrl,
  lamportsToSol,
  type MarketAccount,
  type PositionAccount,
  type MarketSide,
  type SettleProof,
} from "@/lib/markets/client";

const STAKE_AMOUNTS = [0.05, 0.1, 0.25] as const;

interface Props {
  meta: FixtureMeta | null;
  probs: ProbPoint[];
  phase: string;
}

export default function MarketCard({ meta, probs, phase }: Props) {
  const { pubkey, connecting, connect } = useWallet();
  const [market, setMarket] = useState<MarketAccount | null>(null);
  const [positions, setPositions] = useState<PositionAccount[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [side, setSide] = useState<MarketSide>(0);
  const [amount, setAmount] = useState<number>(0.05);

  const fixtureId = meta?.fixtureId ?? null;

  const refresh = useCallback(async () => {
    if (!fixtureId) return;
    try {
      const qs = pubkey ? `?owner=${pubkey}` : "";
      const res = await fetch(`/api/market/${fixtureId}${qs}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setMarket(body.market as MarketAccount | null);
      setPositions((body.positions ?? []) as PositionAccount[]);
    } catch {
      // devnet hiccup; next poll wins
    } finally {
      setLoaded(true);
    }
  }, [fixtureId, pubkey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial chain read + poll
    refresh();
    const t = setInterval(refresh, 12_000);
    return () => clearInterval(t);
  }, [refresh]);

  const run = async (label: string, fn: () => Promise<string>) => {
    setBusy(label);
    setError(null);
    try {
      const sig = await fn();
      setLastTx(sig);
      await refresh();
    } catch (err) {
      const msg = String(err instanceof Error ? err.message : err);
      setError(msg.includes("User rejected") ? "Transaction cancelled." : msg.slice(0, 220));
    } finally {
      setBusy(null);
    }
  };

  // Mapping: pools are [P1, draw, P2] by participant slot; display home/draw/away.
  const displaySides: { side: MarketSide; name: string }[] = useMemo(() => {
    if (!meta) return [];
    const homeSide = (meta.home.parti === 1 ? 0 : 2) as MarketSide;
    const awaySide = (meta.home.parti === 1 ? 2 : 0) as MarketSide;
    return [
      { side: homeSide, name: meta.home.name },
      { side: 1 as MarketSide, name: "Draw" },
      { side: awaySide, name: meta.away.name },
    ];
  }, [meta]);

  const total = market ? market.pools[0] + market.pools[1] + market.pools[2] : 0;
  const latest = probs.length ? probs[probs.length - 1] : null;
  const consensus = latest && meta ? homeAwayProbs(meta, latest.probs) : null;
  const consensusFor = (s: MarketSide, name: string): number | null => {
    if (!consensus || !meta) return null;
    if (s === 1) return consensus.draw;
    return name === meta.home.name ? consensus.home : consensus.away;
  };
  const matchOver = ["F", "FET", "FPE"].includes(phase);
  // Kickoff gating keys off stream time (latest odds tick) with a wall-clock
  // fallback captured once at mount.
  const [mountedAt] = useState(() => Date.now());
  const streamNow = latest?.ts ?? mountedAt;
  const kickoffPassed = meta ? streamNow > meta.startTime : false;

  if (!meta) return null;

  const wallet = getProvider();

  return (
    <Card className="border-small border-default-200" shadow="sm">
      <CardBody className="gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex shrink-0 rounded-medium border border-primary-100 bg-primary-50 p-2">
              <Icon className="text-primary" icon="solar:safe-square-bold-duotone" width={20} />
            </div>
            <div className="min-w-0">
              <p className="text-medium font-semibold">The pool</p>
              <p className="text-tiny text-default-400">
                Locked on Solana · settled by proof, not by us
              </p>
            </div>
          </div>
          <Chip size="sm" variant="flat" startContent={<Icon icon="solar:safe-2-linear" width={14} />}>
            <span className="font-mono tabular-nums">{lamportsToSol(total)} SOL</span>
          </Chip>
        </div>

        {/* Pools */}
        {market ? (
          <div className="flex flex-col gap-2">
            {displaySides.map(({ side: s, name }) => {
              const pool = market.pools[s];
              const pct = total > 0 ? pool / total : 0;
              const impliedOdds = pool > 0 ? total / pool : null;
              const mine = positions.find((p) => p.side === s);
              const consensusPct = consensusFor(s, name);
              const won = market.settled && market.outcome === s;
              return (
                <div
                  key={s}
                  className={cn(
                    "flex flex-col gap-1 rounded-medium border border-default-100 bg-default-50 p-3",
                    won && "border-primary-200 bg-primary-50",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-small font-medium">
                      {name}
                      {won ? <span className="ml-2 text-primary">✓ result</span> : null}
                    </p>
                    <div className="flex items-center gap-2">
                      {consensusPct != null && !market.settled ? (
                        <span className="text-tiny text-default-400">
                          market {(consensusPct * 100).toFixed(0)}%
                        </span>
                      ) : null}
                      <span className="font-mono text-small tabular-nums">
                        {lamportsToSol(pool)} SOL
                        {impliedOdds ? ` · ${impliedOdds.toFixed(2)}x` : ""}
                      </span>
                    </div>
                  </div>
                  <Progress
                    aria-label={`${name} pool share`}
                    classNames={{ indicator: won ? "bg-primary" : "bg-default-400" }}
                    size="sm"
                    value={pct * 100}
                  />
                  {mine ? (
                    <p className="text-tiny text-default-400">
                      Your stake: <span className="font-mono">{lamportsToSol(mine.amount)} SOL</span>
                      {mine.claimed ? " · claimed" : ""}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : loaded ? (
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-small text-default-500">
              No pool for this match yet. Opening one is permissionless and takes a click.
            </p>
            <Button
              color="primary"
              isLoading={busy === "create"}
              isDisabled={!pubkey || !!busy}
              radius="full"
              startContent={busy === "create" ? undefined : <Icon icon="solar:add-circle-bold" width={18} />}
              onPress={() =>
                wallet && run("create", () => createMarketTx(wallet, meta.fixtureId, meta.startTime))
              }
            >
              Open the market
            </Button>
          </div>
        ) : (
          <p className="text-small text-default-400">Reading the chain…</p>
        )}

        {/* Pick a side: 1X2 odds buttons */}
        {market && !market.settled && !kickoffPassed ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              {displaySides.map(({ side: s, name }) => {
                const pct = consensusFor(s, name);
                const pool = market.pools[s];
                const impliedOdds = pool > 0 ? total / pool : null;
                const active = side === s;
                return (
                  <button
                    key={s}
                    className={cn(
                      "flex min-w-0 flex-col items-center gap-0.5 rounded-medium border p-3 transition-colors",
                      active
                        ? "border-primary-300 bg-primary-50"
                        : "border-default-200 bg-default-50 hover:border-default-300",
                    )}
                    type="button"
                    onClick={() => setSide(s)}
                  >
                    <span className="max-w-full truncate text-tiny text-default-500">{name}</span>
                    <span className={cn("font-mono text-xl font-semibold tabular-nums", active && "text-primary")}>
                      {pct != null ? `${(pct * 100).toFixed(0)}%` : "—"}
                    </span>
                    <span className="font-mono text-[10px] text-default-400">
                      {impliedOdds ? `pool ${impliedOdds.toFixed(2)}x` : "be first in"}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {STAKE_AMOUNTS.map((a) => (
                <Button
                  key={a}
                  radius="full"
                  size="sm"
                  variant={amount === a ? "solid" : "bordered"}
                  color={amount === a ? "secondary" : "default"}
                  onPress={() => setAmount(a)}
                >
                  {a} SOL
                </Button>
              ))}
            </div>
            {pubkey ? (
              <Button
                className="w-full"
                color="primary"
                isLoading={busy === "stake"}
                isDisabled={!!busy}
                radius="full"
                startContent={busy === "stake" ? undefined : <Icon icon="solar:lock-keyhole-bold" width={18} />}
                onPress={() => wallet && run("stake", () => stakeTx(wallet, meta.fixtureId, side, amount))}
              >
                Stake {amount} SOL on {displaySides.find((d) => d.side === side)?.name}
              </Button>
            ) : (
              <Button
                className="w-full"
                color="primary"
                isLoading={connecting}
                radius="full"
                startContent={connecting ? undefined : <Icon icon="solar:wallet-bold" width={18} />}
                onPress={() => connect()}
              >
                Connect wallet to stake
              </Button>
            )}
          </div>
        ) : null}

        {market && !market.settled && kickoffPassed && !matchOver ? (
          <p className="text-small text-default-400">
            Pot locked at kick-off. It settles the moment TxLINE finalises the match.
          </p>
        ) : null}

        {/* Settle */}
        {market && !market.settled && matchOver ? (
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-small text-default-500">
              Match finished. Anyone can settle — the proof does the judging.
            </p>
            <Button
              color="primary"
              isLoading={busy === "settle"}
              isDisabled={!pubkey || !!busy}
              radius="full"
              startContent={busy === "settle" ? undefined : <Icon icon="solar:shield-check-bold" width={18} />}
              onPress={() =>
                wallet &&
                run("settle", async () => {
                  const res = await fetch(`/api/settle-proof/${meta.fixtureId}`);
                  const proof = (await res.json()) as SettleProof & { error?: string };
                  if (!res.ok) throw new Error(proof.error ?? `proof fetch ${res.status}`);
                  return settleTx(wallet, meta.fixtureId, proof);
                })
              }
            >
              Settle on Solana
            </Button>
          </div>
        ) : null}

        {/* Settled receipt + claim */}
        {market?.settled ? (
          <div className="flex flex-col gap-2 rounded-medium border border-primary-100 bg-primary-50 p-3">
            <div className="flex items-center gap-2">
              <Icon className="text-primary" icon="solar:check-circle-bold" width={18} />
              <p className="text-small font-medium">
                Settled trustlessly · final {market.goals[0]}–{market.goals[1]} (P1–P2), proven on-chain
              </p>
            </div>
            <p className="font-mono text-tiny text-default-500">
              <a className="underline decoration-dotted" href={explorerUrl("address", market.rootsAccount)} rel="noreferrer" target="_blank">
                Merkle root {market.rootsAccount.slice(0, 8)}…
              </a>
              {" · "}
              <a className="underline decoration-dotted" href={explorerUrl("address", market.address)} rel="noreferrer" target="_blank">
                market {market.address.slice(0, 8)}…
              </a>
            </p>
            {positions.some((p) => p.side === market.outcome && !p.claimed) ? (
              <Button
                className="self-start"
                color="primary"
                isLoading={busy === "claim"}
                isDisabled={!!busy}
                radius="full"
                size="sm"
                startContent={busy === "claim" ? undefined : <Icon icon="solar:cup-star-bold" width={16} />}
                onPress={() =>
                  wallet && run("claim", () => claimTx(wallet, meta.fixtureId, market.outcome))
                }
              >
                Claim winnings
              </Button>
            ) : null}
          </div>
        ) : null}

        {lastTx ? (
          <p className="font-mono text-tiny text-default-400">
            Last transaction:{" "}
            <a className="underline decoration-dotted" href={explorerUrl("tx", lastTx)} rel="noreferrer" target="_blank">
              {lastTx.slice(0, 16)}…
            </a>
          </p>
        ) : null}
        {error ? <p className="text-tiny text-danger">{error}</p> : null}
      </CardBody>
    </Card>
  );
}
