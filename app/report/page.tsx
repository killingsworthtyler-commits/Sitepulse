import Link from "next/link";
import { buildSiteReport } from "@/lib/report/build";
import { dbGetReport, dbSaveReport, reportsConfigured } from "@/lib/db/reports";
import { parseTradeArea, tradeAreaKey, tradeAreaLabel } from "@/lib/autofill/tradearea";
import { getOperationalSites } from "@/lib/prospect/locations";
import { ReportMap } from "@/components/report-map";
import { ShareButton } from "@/components/share-button";
import { PrintButton } from "@/components/print-button";
import { CompetitionAdjuster } from "@/components/competition-adjuster";

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
  searchParams: Promise<{ address?: string; name?: string; deal?: string; refresh?: string; ta?: string }>;
}) {
  const { address, name, deal, refresh, ta } = await searchParams;
  const dealType = deal === "acquisition" ? "acquisition" : "build";
  const tradeArea = parseTradeArea(ta);
  const taKey = tradeAreaKey(tradeArea);

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

  // Cache-first: a report makes many (some billed) external calls, so serve a
  // saved copy when we have one. `?refresh=1` forces a fresh build + re-save.
  const wantRefresh = refresh === "1";
  const cached = wantRefresh ? null : await dbGetReport(address, dealType, taKey);
  let report = cached?.report ?? null;
  let generatedAt = cached?.generatedAt ?? null;
  let fromCache = !!cached;
  if (!report) {
    report = await buildSiteReport(address, dealType, tradeArea);
    if (report.ok && reportsConfigured()) {
      await dbSaveReport(address, dealType, taKey, report);
    }
    generatedAt = new Date().toISOString();
    fromCache = false;
  }

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

  // Existing ModWash stores near the site → "M" markers on the map.
  const nearbyStores = getOperationalSites()
    .filter((s) => distM(report.lat!, report.lng!, s.lat, s.lng) <= 30 * 1609.34)
    .map((s) => ({ name: s.name, lat: s.lat, lng: s.lng }));

  // Build a report URL preserving address/name/deal/ta, overriding as needed.
  const hrefWith = (over: { deal?: string; ta?: string; refresh?: string } = {}) => {
    const p = new URLSearchParams();
    p.set("address", address);
    if (name) p.set("name", name);
    const d = over.deal ?? (dealType === "acquisition" ? "acquisition" : "");
    if (d) p.set("deal", d);
    const t = over.ta ?? (ta ?? "");
    if (t) p.set("ta", t);
    if (over.refresh) p.set("refresh", over.refresh);
    return `/report?${p.toString()}`;
  };

  const metricRows: { label: string; value: string }[] = [
    { label: "Traffic Count (AADT)", value: m.trafficCount ? `${n0(m.trafficCount)} vpd` : "—" },
    { label: "Competition (3-mi)", value: `${m.competition} wash${m.competition === 1 ? "" : "es"}` },
    { label: "Quality of Competition", value: m.qualityOfCompetition },
    { label: `Population (${tradeAreaLabel(tradeArea)})`, value: n0(m.population) },
    { label: "Median HH Income", value: m.medianIncome ? `$${n0(m.medianIncome)}` : "—" },
    { label: "Daytime Population", value: n0(m.daytimePop) },
    { label: "Projected Growth", value: `${m.projGrowth}%` },
    { label: "Traffic Driver", value: m.trafficDriver },
  ];

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
            {report.matchedAddress} · {m.competition} competing wash{m.competition === 1 ? "" : "es"} within 3 mi
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <PrintButton />
          <ShareButton subject={`ModWash Site Report — ${title}`} />
        </div>
      </div>

      {/* Cache status + refresh */}
      {generatedAt && (
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
          <span className="text-slate-500">
            {fromCache ? "Saved report" : "Freshly generated"} ·{" "}
            {new Date(generatedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {fromCache && " · served from cache (no API calls)"}
          </span>
          <Link
            href={hrefWith({ refresh: "1" })}
            className="shrink-0 font-semibold text-brand-blue hover:underline"
          >
            ↻ Refresh data
          </Link>
        </div>
      )}

      {/* Trade area selector — what geography the demographics + score run over */}
      {(() => {
        const PRESETS: { label: string; ta: string }[] = [
          { label: "20K pop", ta: "population:20000" },
          { label: "22K pop", ta: "population:22000" },
          { label: "25K pop", ta: "population:25000" },
          { label: "10-min drive", ta: "drivetime:10" },
          { label: "16-min drive", ta: "drivetime:16" },
          { label: "3-mi radius", ta: "radius:3" },
        ];
        return (
          <div className="no-print mb-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Trade area <span className="text-slate-400">— drives the demographics &amp; score</span>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => {
                const active = taKey === p.ta;
                return (
                  <Link
                    key={p.ta}
                    href={hrefWith({ ta: p.ta })}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "border-brand-blue bg-brand-blue text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {p.label}
                  </Link>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Population zones match the internal CTA size; drive-time matches GrowthFactor.
            </p>
          </div>
        );
      })()}

      {/* Deal type: build (greenfield) vs acquisition (buying the on-site wash) */}
      {(() => {
        const tab = (label: string, value: "build" | "acquisition", sub: string) => {
          const active = dealType === value;
          return (
            <Link
              href={hrefWith({ deal: value })}
              className={`flex-1 rounded-md border px-4 py-2 text-center transition-colors ${
                active
                  ? "border-brand-blue bg-brand-blue/5 ring-1 ring-brand-blue"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span className={`block text-sm font-semibold ${active ? "text-brand-blue" : "text-slate-700"}`}>
                {label}
              </span>
              <span className="block text-[11px] text-slate-500">{sub}</span>
            </Link>
          );
        };
        return (
          <div className="no-print mb-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Evaluation type
            </p>
            <div className="flex gap-2">
              {tab("New build", "build", "Greenfield — entering the market")}
              {tab("Acquisition", "acquisition", "Buying the existing on-site wash")}
            </div>
          </div>
        );
      })()}

      {/* Acquisition banner: which asset we're buying + that it's excluded */}
      {dealType === "acquisition" && (
        <div className="mb-4 rounded-lg border border-brand-blue/30 bg-brand-blue/5 px-4 py-3 text-sm">
          {report.target ? (
            <p className="text-slate-700">
              <span className="font-semibold text-brand-blue">Acquisition</span> — evaluating
              the purchase of <span className="font-semibold">{report.target.name}</span> (
              {report.target.type.toLowerCase()}) on this site. It&apos;s the asset being
              bought, so it&apos;s excluded from the competition count and score below.
            </p>
          ) : (
            <p className="text-slate-700">
              <span className="font-semibold text-brand-blue">Acquisition</span> mode — no
              existing wash was detected right at this address, so the score is the same as a
              new build. Double-check the address if you expected an on-site wash.
            </p>
          )}
        </div>
      )}

      {/* Score banner — interactive: trim competition and the score recomputes */}
      <CompetitionAdjuster
        metrics={m}
        candidates={report.competitionCandidates ?? []}
        address={address}
        dealType={dealType}
        taKey={taKey}
        canRegenerate={!!report.reasoning && reportsConfigured()}
      />

      {/* AI analyst read */}
      {report.reasoning && (
        <section className="mb-6 break-inside-avoid rounded-lg border border-slate-200 bg-white ring-1 ring-slate-900/[0.02]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-ink">
              AI Analyst Read
            </h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                report.reasoning.recommendation === "Pursue"
                  ? "bg-emerald-100 text-emerald-700"
                  : report.reasoning.recommendation === "Investigate"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-rose-100 text-rose-700"
              }`}
            >
              {report.reasoning.recommendation}
            </span>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm leading-relaxed text-slate-700">{report.reasoning.summary}</p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {report.reasoning.strengths.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Strengths
                  </h3>
                  <ul className="space-y-1 text-sm text-slate-700">
                    {report.reasoning.strengths.map((s, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-emerald-500">+</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {report.reasoning.risks.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700">
                    Risks
                  </h3>
                  <ul className="space-y-1 text-sm text-slate-700">
                    {report.reasoning.risks.map((r, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-rose-500">−</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {report.reasoning.criteria.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  By criterion
                </h3>
                <ul className="space-y-1.5 text-sm">
                  {report.reasoning.criteria.map((c, i) => (
                    <li key={i} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                      <span className="shrink-0 font-semibold text-slate-900 sm:w-48">
                        {c.name}
                      </span>
                      <span className="text-slate-600">{c.assessment}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-4 text-[11px] text-slate-400">
              Generated by Claude from the desktop data on this page. A decision aid,
              not a substitute for underwriting or a site visit.
            </p>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Map */}
        <div className="min-w-0">
          <ReportMap
            site={{ lat: report.lat!, lng: report.lng!, label: title }}
            ringed={ringed}
            others={others}
            stores={nearbyStores}
            tradeAreaPolygon={report.demographics?.polygon}
          />
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: "#ff008c" }} />
              Site
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#6366f1", opacity: 0.4 }} />
              Trade area ({tradeAreaLabel(tradeArea)})
            </span>
            {nearbyStores.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: "#0284c7" }} />
                {nearbyStores.length} ModWash store{nearbyStores.length === 1 ? "" : "s"}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: "#ef4444" }} />
              {ringed.length} direct competitor{ringed.length === 1 ? "" : "s"}
            </span>
            {others.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#f87171" }} />
                {others.length} other wash{others.length === 1 ? "" : "es"}
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
