"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { desktopScore } from "@/lib/prospect/score";
import type { SiteMetrics } from "@/lib/prospect/metrics";
import type { CompetitionCandidate } from "@/lib/report/build";
import type { DealType } from "@/lib/deal";
import { regenerateAnalysisAction } from "@/app/report/actions";
import { GradeBadge } from "@/components/badges";

// The score banner, but interactive: the user includes/excludes nearby washes
// and the desktop score recomputes live. The scoring functions are pure, so we
// can run them in the browser — no round-trip. The express set is checked by
// default; other wash types can be opted in if one was mislabeled.
export function CompetitionAdjuster({
  metrics,
  candidates,
  address,
  dealType,
  canRegenerate,
}: {
  metrics: SiteMetrics;
  candidates: CompetitionCandidate[];
  address: string;
  dealType: DealType;
  /** Whether the AI read can be re-run + saved (key + DB configured). */
  canRegenerate: boolean;
}) {
  const [counted, setCounted] = useState<boolean[]>(() => candidates.map((c) => c.counts));
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const competition = counted.filter(Boolean).length;
  const defaultCompetition = candidates.filter((c) => c.counts).length;

  function regenerate() {
    setErr(null);
    startTransition(async () => {
      const res = await regenerateAnalysisAction(address, dealType, counted);
      if (!res.ok) setErr(res.error ?? "Couldn't regenerate.");
      else router.refresh();
    });
  }

  const score = useMemo(
    () => desktopScore({ ...metrics, competition }),
    [metrics, competition],
  );

  const toggle = (i: number) =>
    setCounted((prev) => prev.map((v, j) => (j === i ? !v : v)));
  const reset = () => setCounted(candidates.map((c) => c.counts));
  const trimmed = competition !== defaultCompetition;

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
            {trimmed && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                adjusted
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Desktop score (traffic, competition &amp; market). Visibility, ingress &amp;
            layout need a site visit.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-2xl font-bold text-ink tabular-nums">{competition}</p>
          <p className="text-[11px] text-slate-500">
            competitor{competition === 1 ? "" : "s"} counted
          </p>
        </div>
      </div>

      {/* Trim control */}
      {candidates.length > 0 && (
        <div className="border-t border-slate-100">
          <button
            onClick={() => setOpen((o) => !o)}
            className="no-print flex w-full items-center justify-between px-5 py-2.5 text-left text-xs font-semibold text-brand-blue hover:bg-slate-50"
          >
            <span>{open ? "Hide" : "Adjust"} competition — include/exclude nearby washes</span>
            <span className="text-slate-400">{open ? "▲" : "▼"}</span>
          </button>

          {open && (
            <div className="px-5 pb-4">
              <p className="mb-2 text-[11px] text-slate-500">
                Checked washes count as direct competition. Untick anything that isn&apos;t a
                true express competitor; tick another type if it was mislabeled. The score
                updates instantly.
                {trimmed && (
                  <button onClick={reset} className="ml-2 font-semibold text-brand-blue hover:underline">
                    Reset
                  </button>
                )}
              </p>
              <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                {candidates.map((c, i) => (
                  <li key={`${c.name}-${i}`} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={counted[i]}
                      onChange={() => toggle(i)}
                      className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                    />
                    <span className={`flex-1 truncate ${counted[i] ? "text-slate-900" : "text-slate-400 line-through"}`}>
                      {c.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">{c.type}</span>
                    <span className="shrink-0 tabular-nums text-[11px] text-slate-500">{c.distMi} mi</span>
                  </li>
                ))}
              </ul>

              {/* Persist the selection + re-run the AI analysis for it */}
              {canRegenerate && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    onClick={regenerate}
                    disabled={pending}
                    className="brand-gradient rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pending ? "Updating AI analysis…" : "Save selection & update AI analysis"}
                  </button>
                  <span className="text-[11px] text-slate-400">
                    Saves this competitor set and re-runs the AI read to match it.
                  </span>
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
