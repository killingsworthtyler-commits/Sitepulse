import Link from "next/link";
import { getTenants, getTenantProjects } from "@/lib/tenants";

export const metadata = {
  title: "Tenants — SITE PULSE",
};

export default async function TenantsPage() {
  const tenants = await getTenants();
  const withCounts = await Promise.all(
    tenants.map(async (t) => ({
      tenant: t,
      projectCount: (await getTenantProjects(t)).length,
    })),
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-ink">
          Tenants
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          The brands Hutton develops for. Each tenant carries its own site-selection criteria.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {withCounts.map(({ tenant, projectCount }) => (
          <Link
            key={tenant.id}
            href={`/tenants/${tenant.id}`}
            className="group flex flex-col rounded-lg border border-slate-200 bg-white p-5 ring-1 ring-slate-900/[0.02] transition-colors hover:border-brand-blue/40"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-xl font-bold uppercase tracking-wide text-ink">
                  {tenant.name}
                </h2>
                <p className="text-xs font-medium text-slate-500">
                  {tenant.category}
                </p>
              </div>
              {tenant.owned && (
                <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Owned
                </span>
              )}
            </div>

            <p className="mt-3 flex-1 text-sm text-slate-600">{tenant.blurb}</p>

            <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs">
              <span className="font-medium text-slate-700 tabular-nums">
                {projectCount} active {projectCount === 1 ? "project" : "projects"}
              </span>
              {tenant.hasScorecard && (
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand-blue/10 px-2 py-0.5 font-medium text-sky-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-blue" />
                  Scorecard
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
