"use client";

// Match screen: score header -> probability wave -> Pulse Calls -> event ticker.

import { use, useMemo, useState } from "react";
import { Button, Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import TopBar from "@/components/top-bar";
import ScoreHeader from "@/components/score-header";
import ProbWave from "@/components/prob-wave";
import PulseCall from "@/components/pulse-call";
import EventTicker from "@/components/event-ticker";
import VerifyCard from "@/components/verify-card";
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

  const pulse = usePulse(Number.isFinite(fixtureId) ? fixtureId : null, mode, speed);
  const { pubkey } = useWallet();
  const identity = pubkey ?? "guest";

  const gameApi = usePulseGame(fixtureId, pulse.meta, pulse.probs, pulse.phase, identity);

  // A finished match with no live points -> offer replay directly.
  const suggestReplay = useMemo(() => {
    if (mode !== "live") return false;
    if (!pulse.meta) return false;
    const over = Date.now() > pulse.meta.startTime + 2.75 * 3600_000;
    return over && pulse.probs.length < 3;
  }, [mode, pulse.meta, pulse.probs.length]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
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
          <CardBody className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex rounded-medium border border-secondary/20 bg-secondary/10 p-2">
                <Icon className="text-secondary" icon="solar:rewind-back-bold-duotone" width={20} />
              </div>
              <div>
                <p className="text-small font-medium">This one is in the books.</p>
                <p className="text-tiny text-default-400">
                  Replay the full match — real data, real drama, minutes not hours.
                </p>
              </div>
            </div>
            <Button
              color="primary"
              radius="full"
              startContent={<Icon icon="solar:play-bold" width={18} />}
              onPress={() => setMode("replay")}
            >
              Replay the drama
            </Button>
          </CardBody>
        </Card>
      ) : null}

      {mode === "replay" ? (
        <div className="flex items-center gap-2">
          <Chip color="secondary" size="sm" variant="flat">
            Replay · {speed}x
          </Chip>
          {REPLAY_SPEEDS.map((s) => (
            <Button
              key={s}
              radius="full"
              size="sm"
              variant={speed === s ? "solid" : "bordered"}
              color={speed === s ? "primary" : "default"}
              onPress={() => setSpeed(s)}
            >
              {s}x
            </Button>
          ))}
          <Button
            radius="full"
            size="sm"
            startContent={<Icon icon="solar:play-stream-linear" width={14} />}
            variant="light"
            onPress={() => setMode("live")}
          >
            Back to live
          </Button>
        </div>
      ) : null}

      <ProbWave
        connected={pulse.connected}
        events={pulse.events}
        meta={pulse.meta}
        mode={pulse.mode}
        probs={pulse.probs}
      />

      <PulseCall gameApi={gameApi} meta={pulse.meta} phase={pulse.phase} probs={pulse.probs} />

      <VerifyCard meta={pulse.meta} />

      <section className="flex flex-col gap-2">
        <h2 className="text-small font-medium uppercase tracking-wide text-default-400">
          As it happened
        </h2>
        <EventTicker events={pulse.events} meta={pulse.meta} />
      </section>

      {pulse.error ? (
        <Card className="border-small border-danger-300" shadow="sm">
          <CardBody className="flex flex-row items-center gap-3 p-4">
            <Icon className="text-danger" icon="solar:danger-circle-bold" width={20} />
            <p className="text-small text-default-500">{pulse.error}</p>
          </CardBody>
        </Card>
      ) : null}
    </main>
  );
}
