import { MODWASH_CRITERIA } from "@/lib/scorecard/modwash";
import { ScorecardWorkbench } from "@/components/scorecard-workbench";

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
          Score and compare ModWash sites — weighted across traffic, competition,
          demographics, and site quality.
        </p>
      </header>

      {/* Model reference — collapsed by default to keep the focus on scorecards */}
      <details className="group mb-6 rounded-lg border border-slate-200 bg-white ring-1 ring-slate-900/[0.02]">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700">
          How scoring works
          <span className="text-xs text-slate-400 group-open:hidden">Show ▾</span>
          <span className="hidden text-xs text-slate-400 group-open:inline">Hide ▴</span>
        </summary>
        <div className="border-t border-slate-100 p-4">
          <ModelWeights />
        </div>
      </details>

      <ScorecardWorkbench />
    </div>
  );
}

function ModelWeights() {
  const criteria = [...MODWASH_CRITERIA].sort((a, b) => b.weight - a.weight);
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);

  return (
    <div>
      <p className="mb-4 text-xs text-slate-500">
        Each criterion is scored A=3 / B=2 / C=1 / D=0 and multiplied by its
        weight. Grade: A &gt;85%, B 75–85%, C &lt;75%.
      </p>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {criteria.map((c) => (
          <li key={c.field.id} className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-blue"
                style={{ width: `${(c.weight / 5) * 100}%` }}
              />
            </div>
            <span className="w-52 shrink-0 text-sm text-slate-700">
              {c.field.label}
            </span>
            <span className="w-10 shrink-0 text-right text-xs font-medium text-slate-500 tabular-nums">
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
  );
}
