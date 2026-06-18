"use client";

import { useState } from "react";
import Link from "next/link";
import { demographicsAction } from "@/app/scorecard/demographics/actions";
import type { DemographicsResult } from "@/lib/demographics/report";
import { CtaMap } from "@/components/cta-map";

export function DemographicsReportTool({
  initialAddress = "",
}: {
  initialAddress?: string;
}) {
  const [address, setAddress] = useState(initialAddress);
  const [minutes, setMinutes] = useState(7);
  const [anchorIdx, setAnchorIdx] = useState(-1); // -1 = site, else anchor index
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DemographicsResult | null>(null);

  async function run(mins = minutes, idx = anchorIdx) {
    if (!address.trim() || loading) return;
    const a = idx >= 0 ? result?.anchors[idx] : undefined;
    const anchor = a ? { lat: a.lat, lng: a.lng, label: `${a.brand} CTA` } : undefined;
    setLoading(true);
    try {
      setResult(await demographicsAction(address, mins, anchor));
    } finally {
      setLoading(false);
    }
  }

  const report = result?.report;
  const anchors = result?.anchors ?? [];
  const site = result?.site ?? null;
  const activeAnchor = anchorIdx >= 0 ? anchors[anchorIdx] : null;

  return (
    <div>
      {/* Address bar */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 ring-1 ring-slate-900/[0.02]">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Site Address
        </label>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="123 Main St, City, ST"
            className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
          <button
            onClick={() => run()}
            disabled={loading || !address.trim()}
            className="brand-gradient rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Pulling Census…" : "Generate report"}
          </button>
        </div>

        {/* Trade-area controls: anchor CTA + drive-time */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {anchors.length > 0 && (
            <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
              Trade area around:
              <select
                value={anchorIdx}
                onChange={(e) => {
                  const i = Number(e.target.value);
                  setAnchorIdx(i);
                  if (report?.ok) run(minutes, i);
                }}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              >
                <option value={-1}>Site</option>
                {anchors.map((a, i) => (
                  <option key={`${a.brand}-${i}`} value={i}>
                    {a.brand} CTA — {a.distMi} mi
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
            Drive-time:
            <select
              value={minutes}
              onChange={(e) => {
                const m = Number(e.target.value);
                setMinutes(m);
                if (report?.ok) run(m, anchorIdx);
              }}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            >
              {[5, 6, 7, 8, 9, 10, 12, 15, 20].map((m) => (
                <option key={m} value={m}>
                  {m} min drive
                </option>
              ))}
            </select>
          </label>
          <span className="text-[11px] text-slate-400">
            Pick an anchor to build the CTA around it; larger drive-time = bigger area.
          </span>
        </div>

        {report && !report.ok && (
          <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {report.error}
          </p>
        )}
        {report?.ok && (
          <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              {report.matchedAddress} · {report.tradeArea} ({report.bgCount} block
              groups) · US Census ACS 5-yr
            </p>
            <Link
              href={`/report?address=${encodeURIComponent(address)}`}
              className="shrink-0 text-xs font-semibold text-brand-blue hover:underline"
            >
              Open shareable site report →
            </Link>
          </div>
        )}
      </div>

      {/* CTA map */}
      {report?.ok && report.polygon && site && (
        <div className="mt-4">
          <CtaMap
            polygon={report.polygon}
            site={site}
            anchor={activeAnchor}
          />
          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: "#eab308", opacity: 0.6 }} />
              {activeAnchor ? `${activeAnchor.brand} CTA` : "Trade area"} ({report.tradeArea})
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#ff008c" }} />
              Proposed site
            </span>
            {activeAnchor && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#1d4ed8" }} />
                {activeAnchor.brand} anchor
              </span>
            )}
          </p>
        </div>
      )}

      {/* Report sections */}
      {report?.ok && report.sections && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {report.sections.map((s) => (
            <div
              key={s.title}
              className="break-inside-avoid rounded-lg border border-slate-200 bg-white ring-1 ring-slate-900/[0.02]"
            >
              <div className="brand-gradient rounded-t-lg px-4 py-2">
                <h3 className="text-sm font-bold uppercase tracking-wide text-white">
                  {s.title}
                </h3>
              </div>
              <ul className="divide-y divide-slate-100">
                {s.rows.map((r) => (
                  <li
                    key={r.label}
                    className="flex items-center justify-between gap-3 px-4 py-1.5 text-sm"
                  >
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
      )}

      {!result && (
        <p className="mt-6 text-center text-sm text-slate-400">
          Enter a site address for a full demographic summary. We&apos;ll also find
          nearby anchors (Walmart, Sam&apos;s, Publix, Lowe&apos;s…) so you can build
          the trade area around the CTA, just like the Experian reports.
        </p>
      )}
    </div>
  );
}
