"use client";

// End-of-match recap: final score, drama peak, biggest market swing, your points.
// Appears when the match reaches full-time (live or replay).

import { useMemo, useState } from "react";
import { Button, Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import type { FixtureMeta, ScoreState } from "@/lib/engine/state";
import { homeAwayProbs, homeAwayScore, type ProbPoint } from "@/lib/usePulse";
import type { GameState } from "@/lib/game";

interface Props {
  meta: FixtureMeta;
  score: ScoreState | null;
  probs: ProbPoint[];
  game: GameState;
}

const SWING_WINDOW_MS = 5 * 60 * 1000;

export default function RecapCard({ meta, score, probs, game }: Props) {
  const [copied, setCopied] = useState(false);

  const recap = useMemo(() => {
    if (probs.length < 3) return null;
    const peakDrama = Math.max(...probs.map((p) => p.drama));

    // biggest 5-minute swing for either side
    let best = { delta: 0, team: meta.home.name, from: 0, to: 0 };
    let j = 0;
    for (let i = 0; i < probs.length; i++) {
      while (probs[i].ts - probs[j].ts > SWING_WINDOW_MS) j++;
      const now = homeAwayProbs(meta, probs[i].probs);
      const then = homeAwayProbs(meta, probs[j].probs);
      for (const side of ["home", "away"] as const) {
        const delta = now[side] - then[side];
        if (Math.abs(delta) > Math.abs(best.delta)) {
          best = {
            delta,
            team: side === "home" ? meta.home.name : meta.away.name,
            from: then[side],
            to: now[side],
          };
        }
      }
    }
    return { peakDrama, swing: best };
  }, [probs, meta]);

  if (!recap) return null;
  const goals = score ? homeAwayScore(meta, score.goals) : [0, 0];

  const shareText =
    `${meta.home.name} ${goals[0]}–${goals[1]} ${meta.away.name} · ` +
    `biggest swing: ${recap.swing.team} ${(recap.swing.from * 100).toFixed(0)}%→${(recap.swing.to * 100).toFixed(0)}% ` +
    `· drama peak ${recap.peakDrama}/100 · felt live on Pulse`;

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText, url: window.location.href });
        return;
      }
      await navigator.clipboard.writeText(`${shareText} ${window.location.href}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* user dismissed */ }
  };

  return (
    <Card className="border-small border-primary-200" shadow="sm">
      <CardBody className="gap-4 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex rounded-medium border border-primary-100 bg-primary-50 p-2">
              <Icon className="text-primary" icon="solar:flag-2-bold-duotone" width={20} />
            </div>
            <div>
              <p className="text-medium font-semibold">That was the match</p>
              <p className="text-tiny text-default-400">The story the market told</p>
            </div>
          </div>
          <Button
            radius="full"
            size="sm"
            startContent={<Icon icon={copied ? "solar:check-circle-linear" : "solar:share-linear"} width={16} />}
            variant="bordered"
            onPress={share}
          >
            {copied ? "Copied" : "Share"}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <StatTile
            icon="solar:football-bold-duotone"
            label="Final score"
            value={`${goals[0]}–${goals[1]}`}
            sub={`${meta.home.name} vs ${meta.away.name}`}
          />
          <StatTile
            icon="solar:graph-up-bold-duotone"
            label="Biggest swing"
            value={`${(recap.swing.from * 100).toFixed(0)}% → ${(recap.swing.to * 100).toFixed(0)}%`}
            sub={`${recap.swing.team}, inside 5 minutes`}
          />
          <StatTile
            icon="solar:fire-bold-duotone"
            label="Drama peak"
            value={`${recap.peakDrama}/100`}
            sub={recap.peakDrama >= 60 ? "Absolute chaos" : recap.peakDrama >= 30 ? "Proper drama" : "A calm one"}
          />
        </div>

        {game.history.length > 0 ? (
          <div className="flex items-center justify-between rounded-medium border border-default-100 bg-default-50 px-3 py-2">
            <p className="text-small text-default-500">
              Your calls this run:{" "}
              <span className="font-mono font-semibold text-foreground">
                {game.history.filter((h) => h.outcome === "win").length}W
                –{game.history.filter((h) => h.outcome === "loss").length}L
              </span>
            </p>
            <Chip size="sm" variant="flat" startContent={<Icon icon="solar:cup-star-bold" width={14} />}>
              <span className="font-mono tabular-nums">{game.score.toLocaleString()}</span> pts
            </Chip>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function StatTile({ icon, label, value, sub }: { icon: string; label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-medium border border-default-100 bg-default-50 p-3">
      <div className="flex items-center gap-2">
        <Icon className="text-default-400" icon={icon} width={16} />
        <p className="text-tiny uppercase tracking-wide text-default-400">{label}</p>
      </div>
      <p className="font-mono text-large font-semibold tabular-nums">{value}</p>
      <p className="truncate text-tiny text-default-400">{sub}</p>
    </div>
  );
}
