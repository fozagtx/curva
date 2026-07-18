"use client";

// Compact match layout — stake + wave side by side on desktop, tight stack on mobile.

import { use, useMemo, useState } from "react";
import { Button, Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import TopBar from "@/components/top-bar";
import ScoreHeader from "@/components/score-header";
import ProbWave from "@/components/prob-wave";
import EventTicker from "@/components/event-ticker";
import MarketCard from "@/components/market-card";
import KryvaCall from "@/components/kryva-call";
import DramaToast from "@/components/drama-toast";
import VerifyCard from "@/components/verify-card";
import RecapCard from "@/components/recap-card";
import ActivityFeed from "@/components/activity-feed";
import { usePulse } from "@/lib/usePulse";
import { usePulseGame } from "@/lib/game";
import { useWallet } from "@/lib/wallet";

const REPLAY_SPEEDS = [30, 60, 120] as const;

export default function MatchPage({
  params,
}: {
  params: Promise<{ fixtureId: string }>;
}) {
  const { fixtureId: fixtureIdRaw } = use(params);
  const fixtureId = Number(fixtureIdRaw);

  const [mode, setMode] = useState<"live" | "replay">("live");
  const [speed, setSpeed] = useState<number>(60);
  const { pubkey } = useWallet();

  const pulse = usePulse(Number.isFinite(fixtureId) ? fixtureId : null, mode, speed);
  const gameApi = usePulseGame(
    Number.isFinite(fixtureId) ? fixtureId : null,
    pulse.meta,
    pulse.probs,
    pulse.phase,
    pubkey ?? "guest",
  );

  const [now] = useState(() => Date.now());
  const suggestReplay = useMemo(() => {
    if (mode !== "live") return false;
    if (!pulse.meta) return false;
    if (["F", "FET", "FPE"].includes(pulse.phase)) return true;
    return now > pulse.meta.startTime + 2.75 * 3600_000;
  }, [mode, pulse.meta, pulse.phase, now]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-3 py-3 sm:px-4 sm:py-5">
      <TopBar backHref="/" />

      <ScoreHeader
        drama={pulse.drama}
        meta={pulse.meta}
        minute={pulse.minute}
        phase={pulse.phase}
        score={pulse.score}
      />

      {suggestReplay ? (
        <Card className="border-small border-default-200" shadow="sm">
          <CardBody className="flex flex-row flex-wrap items-center justify-between gap-2 p-2.5">
            <p className="text-tiny text-default-500">Full-time — replay at speed.</p>
            <Button
              color="primary"
              radius="full"
              size="sm"
              startContent={<Icon icon="solar:play-bold" width={14} />}
              onPress={() => setMode("replay")}
            >
              Replay
            </Button>
          </CardBody>
        </Card>
      ) : null}

      {mode === "replay" ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip color="secondary" size="sm" variant="flat">
            Replay · {speed}x
          </Chip>
          {REPLAY_SPEEDS.map((s) => (
            <Button
              key={s}
              color={speed === s ? "primary" : "default"}
              radius="full"
              size="sm"
              variant={speed === s ? "solid" : "bordered"}
              onPress={() => setSpeed(s)}
            >
              {s}x
            </Button>
          ))}
          <Button radius="full" size="sm" variant="light" onPress={() => setMode("live")}>
            Live
          </Button>
        </div>
      ) : null}

      {/* Dense board: market first on mobile, side-by-side on lg */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="order-1 lg:order-2 lg:col-span-5">
          <MarketCard meta={pulse.meta} phase={pulse.phase} probs={pulse.probs} />
        </div>
        <div className="order-2 lg:order-1 lg:col-span-7">
          <ProbWave
            connected={pulse.connected}
            events={pulse.events}
            meta={pulse.meta}
            mode={pulse.mode}
            probs={pulse.probs}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <KryvaCall gameApi={gameApi} meta={pulse.meta} phase={pulse.phase} probs={pulse.probs} />
        <VerifyCard meta={pulse.meta} />
      </div>

      {pulse.meta && ["F", "FET", "FPE"].includes(pulse.phase) ? (
        <RecapCard meta={pulse.meta} probs={pulse.probs} score={pulse.score} />
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ActivityFeed meta={pulse.meta} />
        <EventTicker events={pulse.events} meta={pulse.meta} />
      </div>

      {pulse.error ? (
        <Card className="border-small border-danger-300" shadow="sm">
          <CardBody className="flex flex-row items-center gap-2 p-2.5">
            <Icon className="text-danger" icon="solar:danger-circle-bold" width={16} />
            <p className="text-tiny text-default-500">{pulse.error}</p>
          </CardBody>
        </Card>
      ) : null}

      <DramaToast meta={pulse.meta} probs={pulse.probs} />
    </main>
  );
}
