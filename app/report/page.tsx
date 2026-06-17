import Link from "next/link";
import { buildSiteReport } from "@/lib/report/build";
import { ReportMap } from "@/components/report-map";
import { ShareButton } from "@/components/share-button";
import { GradeBadge } from "@/components/badges";

export const metadata = {
  title: "Site Report — SITE PULSE",
};

const n0 = (x: number) => Math.round(x).toLocaleString("en-US");

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ address?: string; name?: string }>;
}) {
  const { address, name } = await searchParams;

  if (!address) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-ink">
          Site Report
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Open a report from the{" "}
          <Link href="/scorecard/demographics" className="text-brand-blue underline">
            Demographics
          </Link>{" "}
          tab or the Site Finder by passing an address.
        </p>
      </div>
    );
  }

  const report = await buildSiteReport(address);

  if (!report.ok) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-ink">
          Site Report
        </h1>
        <p className="mt-3 rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {report.error}
        </p>
      </div>
    );
  }

  const m = report.metrics!;
  const title = name || report.matchedAddress || address;

  const metricRows: { label: string; value: string }[] = [
    { label: "Traffic Count (AADT)", value: m.trafficCount ? `${n0(m.trafficCount)} vpd` : "—" },
    { label: "Competition (3-mi)", value: `${m.competition} wash${m.competition === 1 ? "" : "es"}` },
    { label: "Quality of Competition", value: m.qualityOfCompetition },
    { label: "Total Population (3-mi)", value: n0(m.population) },
    { label: "Median HH Income", value: m.medianIncome ? `$${n0(m.medianIncome)}` : "—" },
    { label: "Daytime Population", value: n0(m.daytimePop) },
    { label: "Projected Growth", value: `${m.projGrowth}%` },
    { label: "Traffic Driver", value: m.trafficDriver },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            ModWash Site Report
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold uppercase tracking-wide text-ink">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {report.matchedAddress} · {report.competitors?.length ?? 0} competing washes within 3 mi
          </p>
        </div>
        <ShareButton subject={`ModWash Site Report — ${title}`} />
      </div>

      {/* Score banner */}
      <div className="mb-6 flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 ring-1 ring-slate-900/[0.02]">
        <GradeBadge grade={report.score!.grade} size="lg" />
        <div>
          <p className="font-display text-3xl font-bold text-ink">
            {(report.score!.percent * 100).toFixed(0)}%
          </p>
          <p className="text-xs text-slate-500">
            Desktop score (traffic, competition & market). Visibility, ingress &
            layout need a site visit.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Map */}
        <div>
          <ReportMap
            site={{ lat: report.lat!, lng: report.lng!, label: title }}
            competitors={report.competitors ?? []}
          />
          <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#ff008c" }} />
              Site
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#ef4444" }} />
              Competing wash
            </span>
          </div>
        </div>

        {/* Scorecard metrics */}
        <aside className="rounded-lg border border-slate-200 bg-white ring-1 ring-slate-900/[0.02]">
          <div className="brand-gradient rounded-t-lg px-4 py-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">
              Scorecard Metrics
            </h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {metricRows.map((r) => (
              <li key={r.label} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="text-slate-600">{r.label}</span>
                <span className="font-medium text-slate-900 tabular-nums">{r.value}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {/* Demographics */}
      {report.demographics?.ok && report.demographics.sections && (
        <section className="mt-8">
          <h2 className="font-display mb-3 text-xl font-bold uppercase tracking-wide text-ink">
            Demographics
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            US Census ACS 5-yr · 3-mile ring ({report.demographics.bgCount} block groups)
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {report.demographics.sections.map((s) => (
              <div
                key={s.title}
                className="break-inside-avoid rounded-lg border border-slate-200 bg-white ring-1 ring-slate-900/[0.02]"
              >
                <div className="border-b border-slate-100 px-4 py-2">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
                    {s.title}
                  </h3>
                </div>
                <ul className="divide-y divide-slate-100">
                  {s.rows.map((r) => (
                    <li key={r.label} className="flex items-center justify-between gap-3 px-4 py-1.5 text-sm">
                      <span className="text-slate-600">{r.label}</span>
                      <span className="flex items-baseline gap-2 tabular-nums">
                        {r.pct && <span className="text-[11px] text-slate-400">{r.pct}</span>}
                        <span className="font-medium text-slate-900">{r.value}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
