"use client";

// Fan Hi-Lo loop beside the real pools: call whether the leader's win prob
// moves higher or lower over the next 8 match-minutes. Works in live + replay.

import { Button, Card, CardBody, Chip, Progress, cn } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { FixtureMeta } from "@/lib/engine/state";
import { homeAwayProbs, type ProbPoint } from "@/lib/usePulse";
import type { UseGameResult } from "@/lib/game";

interface Props {
  meta: FixtureMeta | null;
  probs: ProbPoint[];
  phase: string;
  gameApi: UseGameResult;
}

export default function KryvaCall({ meta, probs, phase, gameApi }: Props) {
  const { game, activeCall, lastResolved, offer, placeCall, progress } = gameApi;
  const latest = probs.length ? probs[probs.length - 1] : null;

  return (
    <Card className="h-full border-small border-default-200" shadow="sm">
      <CardBody className="gap-3 p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex rounded-medium border border-primary-100 bg-primary-50 p-2">
              <Icon className="text-primary" icon="solar:cup-star-bold-duotone" width={20} />
            </div>
            <div>
              <p className="text-medium font-semibold">Kryva Calls</p>
              <p className="text-tiny text-default-400">Beat the market, build your streak</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Chip size="sm" variant="flat">
              <span className="font-mono tabular-nums">{game.score.toLocaleString()}</span> pts
            </Chip>
            <Chip
              color={game.streak >= 3 ? "danger" : game.streak > 0 ? "warning" : "default"}
              size="sm"
              startContent={<Icon icon="solar:fire-bold" width={14} />}
              variant="flat"
            >
              {game.streak}
            </Chip>
          </div>
        </div>

        {activeCall ? (
          <ActiveCallView activeCall={activeCall} latest={latest} meta={meta} progress={progress} />
        ) : offer ? (
          <div className="flex flex-col gap-3">
            <p className="text-small text-default-500">
              The market has <span className="font-semibold text-foreground">{offer.teamName}</span> at{" "}
              <span className="font-mono font-semibold text-primary">{(offer.prob * 100).toFixed(1)}%</span> to win.
              Where is it 8 match-minutes from now?
            </p>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                color="primary"
                radius="full"
                startContent={<Icon icon="solar:alt-arrow-up-bold" width={18} />}
                onPress={() => placeCall("higher")}
              >
                Higher
              </Button>
              <Button
                className="flex-1"
                radius="full"
                startContent={<Icon icon="solar:alt-arrow-down-linear" width={18} />}
                variant="bordered"
                onPress={() => placeCall("lower")}
              >
                Lower
              </Button>
            </div>
          </div>
        ) : lastResolved ? (
          <ResultView call={lastResolved} />
        ) : (
          <p className="text-small text-default-400">
            {["H1", "H2", "ET1", "ET2"].includes(phase)
              ? "Next call is loading - stay close."
              : "Calls open while the ball is in play. Replay a finished match to practice."}
          </p>
        )}

        {lastResolved && (activeCall || offer) ? <ResultView call={lastResolved} compact /> : null}
      </CardBody>
    </Card>
  );
}

function ActiveCallView({
  activeCall,
  latest,
  meta,
  progress,
}: {
  activeCall: NonNullable<UseGameResult["activeCall"]>;
  latest: ProbPoint | null;
  meta: FixtureMeta | null;
  progress: number;
}) {
  const current =
    latest && meta
      ? activeCall.team === "home"
        ? homeAwayProbs(meta, latest.probs).home
        : homeAwayProbs(meta, latest.probs).away
      : activeCall.prob0;
  const delta = current - activeCall.prob0;
  const winning = activeCall.side === "higher" ? delta > 0 : delta < 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-small text-default-500">
          Your call: <span className="font-semibold text-foreground">{activeCall.teamName}</span>{" "}
          <span
            className={cn(
              "font-semibold",
              activeCall.side === "higher" ? "text-primary" : "text-secondary",
            )}
          >
            {activeCall.side.toUpperCase()}
          </span>{" "}
          than <span className="font-mono">{(activeCall.prob0 * 100).toFixed(1)}%</span>
        </p>
        <Chip
          color={winning ? "success" : "danger"}
          size="sm"
          startContent={
            <Icon
              icon={winning ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"}
              width={14}
            />
          }
          variant="flat"
        >
          <span className="font-mono tabular-nums">
            {delta >= 0 ? "+" : ""}
            {(delta * 100).toFixed(1)}
          </span>
        </Chip>
      </div>
      <Progress
        aria-label="Time to resolution"
        color={winning ? "primary" : "danger"}
        size="sm"
        value={progress * 100}
      />
      <p className="text-tiny text-default-400">Resolves on the market&apos;s clock - watch the wave.</p>
    </div>
  );
}

function ResultView({
  call,
  compact,
}: {
  call: NonNullable<UseGameResult["lastResolved"]>;
  compact?: boolean;
}) {
  const won = call.outcome === "win";
  const push = call.outcome === "push";
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-medium border p-3",
        won
          ? "border-primary-100 bg-primary-50"
          : push
            ? "border-default-100 bg-default-50"
            : "border-danger-100 bg-danger-50",
        compact && "p-2",
      )}
    >
      <Icon
        className={won ? "text-primary" : push ? "text-default-500" : "text-danger"}
        icon={
          won
            ? "solar:cup-star-bold"
            : push
              ? "solar:minus-circle-bold"
              : "solar:close-circle-bold"
        }
        width={20}
      />
      <p className="text-small">
        {won ? (
          <>
            Called it. <span className="font-mono font-semibold">+{call.points}</span> pts on{" "}
            {call.teamName}.
          </>
        ) : push ? (
          <>Market held its breath - push, streak safe.</>
        ) : (
          <>The market went the other way. Streak reset.</>
        )}
      </p>
    </div>
  );
}
