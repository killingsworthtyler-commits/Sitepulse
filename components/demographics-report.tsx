"use client";

import { useState } from "react";
import Link from "next/link";
import { demographicsAction } from "@/app/scorecard/demographics/actions";
import type { DemographicsReport } from "@/lib/demographics/report";

export function DemographicsReportTool({
  initialAddress = "",
}: {
  initialAddress?: string;
}) {
  const [address, setAddress] = useState(initialAddress);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<DemographicsReport | null>(null);

  async function run() {
    if (!address.trim() || loading) return;
    setLoading(true);
    try {
      setReport(await demographicsAction(address));
    } finally {
      setLoading(false);
    }
  }

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
            onClick={run}
            disabled={loading || !address.trim()}
            className="brand-gradient rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Pulling Census…" : "Generate report"}
          </button>
        </div>

        {report && !report.ok && (
          <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {report.error}
          </p>
        )}
        {report?.ok && (
          <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              {report.matchedAddress} · {report.ringMiles}-mi ring (
              {report.bgCount} block groups) · US Census ACS 5-yr
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

      {/* Report */}
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
                      {r.pct && (
                        <span className="text-[11px] text-slate-400">{r.pct}</span>
                      )}
                      <span className="font-medium text-slate-900">{r.value}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {!report && (
        <p className="mt-6 text-center text-sm text-slate-400">
          Enter a site address to pull a full demographic summary — population,
          age, income, employment, housing, vehicles, and education for the
          3-mile trade area.
        </p>
      )}
    </div>
  );
}
