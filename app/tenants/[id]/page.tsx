import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenant, getTenantProjects } from "@/lib/tenants";
import { MODWASH_CRITERIA } from "@/lib/scorecard/modwash";
import { getModwashSites } from "@/lib/scorecard/modwash-sites";
import { GradeBadge, HealthBadge, StageBadge } from "@/components/badges";
import { money } from "@/lib/format";

export default async function TenantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await getTenant(id);
  if (!tenant) notFound();

  const projects = await getTenantProjects(tenant);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Breadcrumb + header */}
      <div className="mb-6">
        <Link
          href="/tenants"
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Tenants
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-ink">
            {tenant.name}
          </h1>
          {tenant.owned && (
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Hutton-Owned
            </span>
          )}
          <span className="text-sm text-slate-500">{tenant.category}</span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">{tenant.blurb}</p>
      </div>

      {tenant.hasScorecard && <ModwashScorecardSection />}

      {/* Active projects */}
      <section className="mt-8">
        <h2 className="font-display mb-3 text-lg font-bold uppercase tracking-wide text-ink">
          Active Projects
        </h2>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white ring-1 ring-slate-900/[0.02]">
          {projects.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              No active projects for this tenant.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <tbody>
                {projects.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">
                        {p.city}, {p.state}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StageBadge stage={p.stage} />
                    </td>
                    <td className="px-4 py-3">
                      <HealthBadge health={p.health} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700 tabular-nums">
                      {money(p.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function ModwashScorecardSection() {
  const sites = getModwashSites();
  // Show the model weights (northern variant covers all criteria).
  const criteria = [...MODWASH_CRITERIA].sort((a, b) => b.weight - a.weight);
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {/* Model */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 ring-1 ring-slate-900/[0.02]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-ink">
            Site Scorecard Model
          </h2>
          <Link
            href="/tenants/modwash/scorecard"
            className="rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-ink-soft"
          >
            Score a Site →
          </Link>
        </div>
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
