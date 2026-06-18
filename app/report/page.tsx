import Link from "next/link";
import { buildSiteReport } from "@/lib/report/build";
import { ReportMap } from "@/components/report-map";
import { ShareButton } from "@/components/share-button";
import { PrintButton } from "@/components/print-button";
import { GradeBadge } from "@/components/badges";

export const metadata = {
  title: "Site Report — SITE PULSE",
};

const n0 = (x: number) => Math.round(x).toLocaleString("en-US");

function distM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

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

  // Group nearby washes by type (express first — the real competitive set).
  const WASH_ORDER = [
    "Express / automatic",
    "Gas-station wash",
    "Self-serve / coin",
    "Detail / hand / mobile",
    "Unbranded / other",
    "Not a wash",
    "ModWash (own store)",
  ];
  const washGroups = WASH_ORDER.map((type) => ({
    type,
    names: (report.washes ?? []).filter((w) => w.type === type).map((w) => w.name),
  })).filter((g) => g.names.length > 0);

  // 20K-pop competition rings: a competitor whose ring overlaps the site ring
  // (centers within 2× the radius) is "direct competition" — numbered on the map.
  const ringRadiusM = report.ringRadiusM ?? 1.44 * 1609.34;
  const ringMi = (ringRadiusM / 1609.34).toFixed(2);
  const allComps = report.competitors ?? [];
  const ringed = allComps
    .filter((c) => distM(report.lat!, report.lng!, c.lat, c.lng) <= 2 * ringRadiusM)
    .map((c, i) => ({ name: c.name, lat: c.lat, lng: c.lng, n: i + 1 }));
  const ringedKeys = new Set(ringed.map((c) => `${c.lat},${c.lng}`));
  const others = allComps.filter((c) => !ringedKeys.has(`${c.lat},${c.lng}`));

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
        <div className="no-print flex flex-wrap gap-2">
          <PrintButton />
          <ShareButton subject={`ModWash Site Report — ${title}`} />
        </div>
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Map */}
        <div className="min-w-0">
          <ReportMap
            site={{ lat: report.lat!, lng: report.lng!, label: title }}
            ringed={ringed}
            others={others}
            ringRadiusM={ringRadiusM}
          />
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full border-2" style={{ borderColor: "#ff008c" }} />
              Site — {ringMi}-mi 20K-pop ring
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full border-2" style={{ borderColor: "#ef4444" }} />
              {ringed.length} direct competitor{ringed.length === 1 ? "" : "s"} (rings overlap)
            </span>
            {others.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#f87171" }} />
                {others.length} other wash{others.length === 1 ? "" : "es"} nearby
              </span>
            )}
          </div>
          {ringed.length > 0 && (
            <ol className="mt-2 grid gap-x-4 gap-y-0.5 text-[11px] text-slate-600 sm:grid-cols-2">
              {ringed.map((c) => (
                <li key={c.n} className="truncate">
                  <span className="font-semibold text-rose-600">{c.n}.</span> {c.name}
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Scorecard metrics */}
        <aside className="min-w-0 rounded-lg border border-slate-200 bg-white ring-1 ring-slate-900/[0.02]">
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

      {/* Competing washes by type */}
      {washGroups.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display mb-1 text-xl font-bold uppercase tracking-wide text-ink">
            Nearby Car Washes by Type
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            All car washes within 3 mi (Google Places). &ldquo;Express / automatic&rdquo;
            is the direct competitive set — the others are excluded from the
            competition count. Trim to your true competitors as needed.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {washGroups.map((g) => (
              <div
                key={g.type}
                className={`rounded-lg border bg-white p-3 ring-1 ring-slate-900/[0.02] ${
                  g.type === "Express / automatic"
                    ? "border-rose-200"
                    : "border-slate-200"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={`text-xs font-bold uppercase tracking-wide ${
                      g.type === "Express / automatic" ? "text-rose-600" : "text-slate-500"
                    }`}
                  >
                    {g.type}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 tabular-nums">
                    {g.names.length}
                  </span>
                </div>
                <ul className="space-y-0.5 text-sm text-slate-700">
                  {g.names.map((name, i) => (
                    <li key={`${name}-${i}`} className="truncate">
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cannibalization */}
      <section className="mt-8">
        <h2 className="font-display mb-1 text-xl font-bold uppercase tracking-wide text-ink">
          Cannibalization
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Existing ModWash stores whose {ringMi}-mi ring overlaps this site&apos;s
          ring — shared trade area that could split volume.
        </p>
        {(report.cannibalization?.length ?? 0) === 0 ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            ✓ No existing ModWash within range — no cannibalization.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white ring-1 ring-slate-900/[0.02]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Store</th>
                  <th className="px-4 py-2 font-medium">Distance</th>
                  <th className="px-4 py-2 font-medium">Ring overlap</th>
                </tr>
              </thead>
              <tbody>
                {report.cannibalization!.map((s) => (
                  <tr key={s.code} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2">
                      <span className="font-medium text-slate-900">{s.name}</span>{" "}
                      <span className="text-xs text-slate-500">
                        {s.code} · {s.city}, {s.state}
                      </span>
                    </td>
                    <td className="px-4 py-2 tabular-nums text-slate-700">{s.distMi} mi</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                          s.overlapPct >= 40
                            ? "bg-rose-100 text-rose-700"
                            : s.overlapPct >= 15
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {s.overlapPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Analogs — closest operational stores by demographic footprint */}
      {report.analogVars && (report.analogs?.length ?? 0) > 0 && (
        <section className="mt-8">
          <h2 className="font-display mb-1 text-xl font-bold uppercase tracking-wide text-ink">
            Comparable Stores (Analogs)
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Operational ModWash stores whose 3-mi demographic footprint most
            resembles this site — use their real performance to sanity-check the
            projection. Match blends population, income, median age, and density.
          </p>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white ring-1 ring-slate-900/[0.02]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2 font-medium">Store</th>
                  <th className="px-4 py-2 font-medium">Match</th>
                  <th className="px-4 py-2 text-right font-medium">Population</th>
                  <th className="px-4 py-2 text-right font-medium">Med. income</th>
                  <th className="px-4 py-2 text-right font-medium">Med. age</th>
                  <th className="px-4 py-2 text-right font-medium">Density</th>
                </tr>
              </thead>
              <tbody>
                {/* This site, as the comparison baseline */}
                <tr className="border-b border-slate-200 bg-brand-blue/5">
                  <td className="px-4 py-2 font-semibold text-brand-blue">This site</td>
                  <td className="px-4 py-2 text-xs text-slate-400">—</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-900">
                    {report.analogVars.population.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-900">
                    ${report.analogVars.medianIncome.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-900">
                    {report.analogVars.medianAge}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-900">
                    {report.analogVars.density.toLocaleString()}
                  </td>
                </tr>
                {report.analogs!.map((a) => (
                  <tr key={a.code} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2">
                      <span className="font-medium text-slate-900">{a.name}</span>{" "}
                      <span className="text-xs text-slate-500">
                        {a.code} · {a.city}, {a.state}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                          a.matchPct >= 85
                            ? "bg-emerald-100 text-emerald-700"
                            : a.matchPct >= 70
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {a.matchPct}%
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                      {a.population.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                      ${a.medianIncome.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-700">{a.medianAge}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-700">
                      {a.density.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Demographics */}
      {report.demographics?.ok && report.demographics.sections && (
        <section className="mt-8">
          <h2 className="font-display mb-3 text-xl font-bold uppercase tracking-wide text-ink">
            Demographics
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            US Census ACS 5-yr · {report.demographics.tradeArea} ({report.demographics.bgCount} block groups)
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
