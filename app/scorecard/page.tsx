import { MODWASH_CRITERIA } from "@/lib/scorecard/modwash";
import { getModwashSites } from "@/lib/scorecard/modwash-sites";
import { GradeBadge } from "@/components/badges";
import { ScorecardTool } from "@/components/scorecard-tool";

export const metadata = {
  title: "Scorecard — SITE PULSE",
};

export default function ScorecardPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-ink">
          Site Scorecard
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          ModWash site-selection model — weighted across traffic, competition,
          demographics, and site quality.
        </p>
      </header>

      <ModelOverview />

      <section className="mt-10">
        <h2 className="font-display mb-1 text-xl font-bold uppercase tracking-wide text-ink">
          Score a Site
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Enter an address to auto-fill what we can, then adjust — the score
          updates live.
        </p>
        <ScorecardTool />
      </section>
    </div>
  );
}

function ModelOverview() {
  const sites = getModwashSites();
  const criteria = [...MODWASH_CRITERIA].sort((a, b) => b.weight - a.weight);
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {/* Model */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 ring-1 ring-slate-900/[0.02]">
        <h2 className="font-display mb-1 text-lg font-bold uppercase tracking-wide text-ink">
          Scorecard Model
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Each criterion is scored A=3 / B=2 / C=1 / D=0 and weighted. Grade: A &gt;85%, B 75–85%, C &lt;75%.
        </p>
        <ul className="space-y-1.5">
          {criteria.map((c) => (
            <li key={c.field.id} className="flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand-blue"
                  style={{ width: `${(c.weight / 5) * 100}%` }}
                />
              </div>
              <span className="w-56 shrink-0 text-sm text-slate-700">
                {c.field.label}
              </span>
              <span className="w-16 shrink-0 text-right text-xs font-medium text-slate-500 tabular-nums">
                ×{c.weight}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          {totalWeight} weight units · {criteria.length} criteria · up to{" "}
          {totalWeight * 3} points
        </p>
      </div>

      {/* Validated scored sites */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 ring-1 ring-slate-900/[0.02]">
        <h2 className="font-display mb-1 text-lg font-bold uppercase tracking-wide text-ink">
          Recent Scored Sites
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Recomputed live by the engine — matches the original spreadsheets.
        </p>
        <ul className="divide-y divide-slate-100">
          {sites.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5">
              <GradeBadge grade={s.result.grade} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {s.name}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {s.city}, {s.state}
                </p>
              </div>
              <span className="font-display text-lg font-bold text-ink tabular-nums">
                {(s.result.percent * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
