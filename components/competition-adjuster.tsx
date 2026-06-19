"use client";

import { useMemo, useState, useTransition } from "react";
import { desktopScore } from "@/lib/prospect/score";
import type { SiteMetrics } from "@/lib/prospect/metrics";
import type { CompetitionCandidate } from "@/lib/report/build";
import type { DealType } from "@/lib/deal";
import { regenerateAnalysisAction } from "@/app/report/actions";
import { GradeBadge } from "@/components/badges";

// The user hand-classifies each nearby wash (Google's auto-type is noisy). Only
// "Express / automatic" counts as competition; the desktop score recomputes live
// in the browser as types change. "Save & update AI analysis" persists the
// classification and re-runs the AI so excluded washes are no longer mentioned.
const EXPRESS = "Express / automatic";
const WASH_TYPES = [
  EXPRESS,
  "Gas-station wash",
  "Self-serve / coin",
  "Detail / hand / mobile",
  "Unbranded / other",
  "Not a wash",
];

export function CompetitionAdjuster({
  metrics,
  candidates,
  address,
  dealType,
  taKey,
  canRegenerate,
}: {
  metrics: SiteMetrics;
  candidates: CompetitionCandidate[];
  address: string;
  dealType: DealType;
  /** Trade-area cache key — so regenerate updates the right saved report. */
  taKey: string;
  /** Whether the AI read can be re-run + saved (key + DB configured). */
  canRegenerate: boolean;
}) {
  const [types, setTypes] = useState<string[]>(() => candidates.map((c) => c.type));
  const [open, setOpen] = useState(true);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const competition = types.filter((t) => t === EXPRESS).length;
  // Zero competitors logically means no competition quality, so don't keep
  // penalizing "Quality of Competition" once the user has cleared the set.
  const qualityOfCompetition = competition === 0 ? "None" : metrics.qualityOfCompetition;
  const score = useMemo(
    () => desktopScore({ ...metrics, competition, qualityOfCompetition }),
    [metrics, competition, qualityOfCompetition],
  );

  // The AI read was generated for the saved classification; flag it stale if the
  // set of washes counted as competition has changed since.
  const savedExpress = useMemo(
    () => candidates.filter((c) => c.counts).map((c) => c.name).sort().join("|"),
    [candidates],
  );
  const currentExpress = candidates
    .filter((_, i) => types[i] === EXPRESS)
    .map((c) => c.name)
    .sort()
    .join("|");
  const stale = currentExpress !== savedExpress;

  const setType = (i: number, v: string) =>
    setTypes((prev) => prev.map((t, j) => (j === i ? v : t)));
  const reset = () => setTypes(candidates.map((c) => c.type));

  function regenerate() {
    setErr(null);
    startTransition(async () => {
      const res = await regenerateAnalysisAction(address, dealType, taKey, types);
      if (!res.ok) {
        setErr(res.error ?? "Couldn't update.");
        return;
      }
      // Reload the canonical URL (without ?refresh) so the page reads the saved
      // report — never a full rebuild, which would discard this classification.
      const u = new URL(window.location.href);
      u.searchParams.delete("refresh");
      window.location.href = u.toString();
    });
  }

  return (
    <div className="mb-6 rounded-lg border border-slate-200 bg-white ring-1 ring-slate-900/[0.02]">
      {/* Score banner */}
      <div className="flex items-center gap-4 p-5">
        <GradeBadge grade={score.grade} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="font-display text-3xl font-bold text-ink">
              {(score.percent * 100).toFixed(0)}%
            </p>
            {stale && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                adjusted
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Desktop pre-screen — 5 of the 9 scorecard criteria. Excludes the site-visit
            criteria (visibility, ingress/egress, layout), which need eyes on the ground.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-2xl font-bold text-ink tabular-nums">{competition}</p>
          <p className="text-[11px] text-slate-500">
            competitor{competition === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* Per-criterion breakdown — so the score is never a black box. Updates live. */}
      <div className="border-t border-slate-100 px-5 py-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          How the score is built
        </p>
        <ul className="space-y-1">
          {score.criteria.map((c) => {
            const tone =
              c.points >= 3
                ? "bg-emerald-100 text-emerald-700"
                : c.points === 2
                  ? "bg-lime-100 text-lime-700"
                  : c.points === 1
                    ? "bg-amber-100 text-amber-700"
                    : "bg-rose-100 text-rose-700";
            return (
              <li key={c.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate text-slate-600">
                  {c.label}
                  {c.rating && <span className="ml-1 text-slate-400">· {c.rating}</span>}
                </span>
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone}`}>
                  {c.points}/3
                </span>
                <span className="w-14 shrink-0 text-right tabular-nums text-[11px] text-slate-500">
                  {c.earned}/{c.possible} pts
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Hand-classification list */}
      {candidates.length > 0 && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => setOpen((o) => !o)}
            className="no-print flex w-full items-center justify-between px-5 py-2.5 text-left text-xs font-semibold text-brand-blue hover:bg-slate-50"
          >
            <span>
              {open ? "Hide" : "Classify"} nearby washes ({candidates.length}) — only “Express /
              automatic” counts as competition
            </span>
            <span className="text-slate-400">{open ? "▲" : "▼"}</span>
          </button>

          {open && (
            <div className="px-5 pb-4">
              <p className="mb-2 text-[11px] text-slate-500">
                Google tags these as car washes but the type is often wrong. Open each on Google
                Maps to check what it is, then set the type. The score updates instantly.
                {stale && (
                  <button onClick={reset} className="ml-2 font-semibold text-brand-blue hover:underline">
                    Reset
                  </button>
                )}
              </p>
              <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                {candidates.map((c, i) => {
                  const counts = types[i] === EXPRESS;
                  return (
                    <li key={`${c.name}-${i}`} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${counts ? "bg-rose-500" : "bg-slate-200"}`}
                        title={counts ? "Counts as competition" : "Not counted"}
                      />
                      <a
                        href={c.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 truncate font-medium text-slate-800 hover:text-brand-blue hover:underline"
                        title="Open on Google Maps"
                      >
                        {c.name} ↗
                      </a>
                      <span className="shrink-0 tabular-nums text-[11px] text-slate-400">{c.distMi} mi</span>
                      <select
                        value={types[i]}
                        onChange={(e) => setType(i, e.target.value)}
                        className="shrink-0 rounded-md border border-slate-200 px-1.5 py-1 text-xs text-slate-700 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
                      >
                        {WASH_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>

              {/* Persist the classification + re-run the AI to match it */}
              {canRegenerate && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    onClick={regenerate}
                    disabled={pending || !stale}
                    className="brand-gradient rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pending ? "Updating AI analysis…" : "Save classification & update AI analysis"}
                  </button>
                  {stale ? (
                    <span className="text-[11px] font-medium text-amber-700">
                      AI analysis is out of date — it still reflects the old classification.
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400">
                      Saves this classification and re-runs the AI to match it.
                    </span>
                  )}
                  {err && <span className="text-[11px] text-rose-600">{err}</span>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
