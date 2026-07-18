"use client";

// Floating chip when the win-prob curve lurches. Auto-dismisses; respects reduced motion.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Icon } from "@iconify/react";
import type { FixtureMeta } from "@/lib/engine/state";
import { homeAwayProbs, type ProbPoint } from "@/lib/usePulse";

const SWING_THRESHOLD = 0.03; // 3pp in the lookback window
const LOOKBACK_MS = 90_000;
const SHOW_MS = 4_500;

type Toast = {
  id: number;
  team: string;
  delta: number; // signed probability delta for that team
};

export default function DramaToast({
  meta,
  probs,
}: {
  meta: FixtureMeta | null;
  probs: ProbPoint[];
}) {
  const reduce = useReducedMotion();
  const [toast, setToast] = useState<Toast | null>(null);
  const lastFired = useRef(0);
  const lastLen = useRef(0);

  useEffect(() => {
    if (!meta || probs.length < 2) return;
    if (probs.length === lastLen.current) return;
    lastLen.current = probs.length;

    const latest = probs[probs.length - 1];
    let older = probs[0];
    for (let i = probs.length - 2; i >= 0; i--) {
      if (latest.ts - probs[i].ts >= LOOKBACK_MS) {
        older = probs[i];
        break;
      }
      older = probs[i];
    }
    if (latest.ts - older.ts < 15_000) return;

    const a = homeAwayProbs(meta, older.probs);
    const b = homeAwayProbs(meta, latest.probs);
    const candidates: Toast[] = [
      { id: latest.ts, team: meta.home.name, delta: b.home - a.home },
      { id: latest.ts + 1, team: meta.away.name, delta: b.away - a.away },
    ];
    const best = candidates.reduce((x, y) =>
      Math.abs(y.delta) > Math.abs(x.delta) ? y : x,
    );
    if (Math.abs(best.delta) < SWING_THRESHOLD) return;
    if (latest.ts - lastFired.current < LOOKBACK_MS) return;
    lastFired.current = latest.ts;
    setToast(best);
  }, [meta, probs]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), SHOW_MS);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.id}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
            className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-full border border-warning-200 bg-content1 px-4 py-2.5 shadow-lg"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning-50 text-warning-600">
              <Icon
                icon={
                  toast.delta >= 0
                    ? "solar:graph-up-bold"
                    : "solar:graph-down-bold"
                }
                width={18}
              />
            </span>
            <p className="text-small">
              <span className="font-semibold">{toast.team}</span>{" "}
              <span
                className={
                  toast.delta >= 0 ? "font-mono font-semibold text-success" : "font-mono font-semibold text-danger"
                }
              >
                {toast.delta >= 0 ? "+" : ""}
                {(toast.delta * 100).toFixed(1)}%
              </span>{" "}
              <span className="text-default-500">in the last 90s</span>
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
