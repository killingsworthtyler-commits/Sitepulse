import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenant } from "@/lib/tenants";
import { ScorecardTool } from "@/components/scorecard-tool";

export default async function ScorecardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await getTenant(id);
  if (!tenant || !tenant.hasScorecard) notFound();

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <Link
          href={`/tenants/${tenant.id}`}
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← {tenant.name}
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide text-ink">
          Score a Site
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {tenant.name} site-selection scorecard. Enter the site inputs — the score updates live.
        </p>
      </div>

      <ScorecardTool />
    </div>
  );
}
