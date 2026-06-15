"use client";

import { useMemo, useState } from "react";
import {
  MODWASH_CRITERIA,
  scoreSite,
  popPerWash,
  type ScorecardInputs,
  type Variant,
  type NumericField,
  type SelectField,
  type Criterion,
} from "@/lib/scorecard/modwash";
import { GradeBadge } from "@/components/badges";
import { autofillAction } from "@/app/tenants/[id]/scorecard/actions";

interface AutoMeta {
  source: string;
  confidence: "data" | "estimate" | "mock";
  note?: string;
}
type AutoMap = Record<string, AutoMeta>;

const AUTO_TAG_STYLE: Record<AutoMeta["confidence"], string> = {
  data: "bg-brand-blue/10 text-sky-700",
  estimate: "bg-amber-50 text-amber-700",
  mock: "bg-slate-100 text-slate-500",
};

const DEFAULTS: ScorecardInputs = {
  trafficCount: 25000,
  competition: 1,
  population: 40000,
  qualityOfCompetition: "One-Off Operator",
  medianIncome: 60000,
  daytimePop: 25000,
  projGrowth: 1.0,
  trafficDriver: "B",
  trafficSpeed: 40,
  sightLine: "400 - 500 Feet Both Directions",
  offBlock: "No",
  directAccess: "Full Access",
  typeOfSite: "Signalized / Direct Full Access",
  payStations: "3+",
  vacuumSlots: "More than 18 Vacuums",
  memberLane: "Yes",
  snowDays: 5,
};

export function ScorecardTool() {
  const [inputs, setInputs] = useState<ScorecardInputs>(DEFAULTS);
  const [variant, setVariant] = useState<Variant>("southern");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [autofilled, setAutofilled] = useState<AutoMap>({});
  const [banner, setBanner] = useState<
    { matched?: string; warnings: string[]; error?: string } | null
  >(null);

  const result = useMemo(() => scoreSite(inputs, variant), [inputs, variant]);

  const setNum = (id: string, v: string) => {
    setInputs((prev) => ({ ...prev, [id]: v === "" ? 0 : Number(v) }));
    clearAuto(id);
  };
  const setSel = (id: string, v: string) => {
    setInputs((prev) => ({ ...prev, [id]: v }));
    clearAuto(id);
  };
  // Once a user edits a field, drop its auto-fill tag (it's now their value).
  const clearAuto = (id: string) =>
    setAutofilled((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });

  async function runAutofill() {
    if (!address.trim() || loading) return;
    setLoading(true);
    setBanner(null);
    try {
      const res = await autofillAction(address);
      if (!res.ok) {
        setBanner({ warnings: [], error: res.error });
        return;
      }
      setInputs((prev) => {
        const next = { ...prev } as Record<string, number | string>;
        for (const [k, f] of Object.entries(res.fields)) next[k] = f.value;
        return next as unknown as ScorecardInputs;
      });
      if (res.suggestedVariant) setVariant(res.suggestedVariant);
      const meta: AutoMap = {};
      for (const [k, f] of Object.entries(res.fields)) {
        meta[k] = { source: f.source, confidence: f.confidence, note: f.note };
      }
      setAutofilled(meta);
      setBanner({ matched: res.matchedAddress, warnings: res.warnings });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      {/* ---------------- Form ---------------- */}
      <div className="space-y-4">
        {/* Address + variant */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 ring-1 ring-slate-900/[0.02]">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Site Address
          </label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAutofill()}
              placeholder="123 Main St, City, ST"
              className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
            <button
              type="button"
              onClick={runAutofill}
              disabled={loading || !address.trim()}
              className="rounded-md bg-ink px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Filling…" : "Auto-fill"}
            </button>
          </div>

          {banner?.error && (
            <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {banner.error}
            </p>
          )}
          {banner && !banner.error && (
            <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              {banner.matched && (
                <p className="text-xs font-medium text-slate-700">
                  Matched: {banner.matched}
                </p>
              )}
              {banner.warnings.map((w, i) => (
                <p key={i} className="mt-1 text-[11px] text-slate-500">
                  • {w}
                </p>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Market:</span>
            <div className="flex rounded-md bg-slate-100 p-0.5 text-xs font-medium">
              {(["southern", "northern"] as Variant[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setVariant(v)}
                  className={`rounded px-2.5 py-1 capitalize transition-colors ${
                    variant === v
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-slate-400">
              Northern adds Snow Days
            </span>
          </div>
        </div>

        {/* Criteria */}
        <div className="rounded-lg border border-slate-200 bg-white ring-1 ring-slate-900/[0.02]">
          {MODWASH_CRITERIA.filter(
            (c) => !c.variant || c.variant === variant,
          ).map((c, i) => (
            <CriterionRow
              key={c.field.id}
              criterion={c}
              inputs={inputs}
              autofilled={autofilled}
              setNum={setNum}
              setSel={setSel}
              last={i === MODWASH_CRITERIA.length - 1}
            />
          ))}
        </div>
      </div>

      {/* ---------------- Live result ---------------- */}
      <aside className="lg:sticky lg:top-6 h-fit space-y-4">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white ring-1 ring-slate-900/[0.02]">
          <div className="brand-gradient px-5 py-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-90">
              Site Score
            </p>
            <div className="mt-1 flex items-end justify-between">
              <span className="font-display text-5xl font-bold leading-none">
                {(result.percent * 100).toFixed(1)}%
              </span>
              <GradeBadge grade={result.grade} size="lg" />
            </div>
            <p className="mt-2 text-xs opacity-90">
              {result.earned} / {result.possible} points ·{" "}
              <span className="capitalize">{variant}</span> model
            </p>
          </div>

          <ul className="divide-y divide-slate-100">
            {result.criteria.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-4 py-2">
                <span className="flex-1 truncate text-xs text-slate-600">
                  {c.label}
                  {c.rating && (
                    <span className="ml-1 text-slate-400">· {c.rating}</span>
                  )}
                </span>
                <div className="flex w-14 gap-0.5">
                  {[0, 1, 2].map((seg) => (
                    <span
                      key={seg}
                      className={`h-1.5 flex-1 rounded-full ${
                        seg < c.points ? "bg-brand-blue" : "bg-slate-200"
                      }`}
                    />
                  ))}
                </div>
                <span className="w-10 text-right text-xs font-medium text-slate-500 tabular-nums">
                  {c.earned}/{c.possible}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="px-1 text-[11px] text-slate-400">
          Live preview. Saving scored sites to the platform comes next.
        </p>
      </aside>
    </div>
  );
}

function CriterionRow({
  criterion,
  inputs,
  autofilled,
  setNum,
  setSel,
  last,
}: {
  criterion: Criterion;
  inputs: ScorecardInputs;
  autofilled: AutoMap;
  setNum: (id: string, v: string) => void;
  setSel: (id: string, v: string) => void;
  last: boolean;
}) {
  const { field, weight } = criterion;
  const border = last ? "" : "border-b border-slate-100";

  return (
    <div className={`p-4 ${border}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-800">
          {field.label}
        </span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
          ×{weight}
        </span>
      </div>

      {field.kind === "composite" ? (
        <div className="grid gap-3 rounded-md bg-slate-50 p-3 sm:grid-cols-2">
          {field.children.map((child) => (
            <Leaf
              key={child.id}
              field={child}
              inputs={inputs}
              auto={autofilled[child.id]}
              setNum={setNum}
              setSel={setSel}
            />
          ))}
        </div>
      ) : field.id === "popPerWash" ? (
        <PopPerWash inputs={inputs} auto={autofilled.population} setNum={setNum} />
      ) : (
        <Leaf
          field={field}
          inputs={inputs}
          auto={autofilled[field.id]}
          setNum={setNum}
          setSel={setSel}
        />
      )}
    </div>
  );
}

function AutoTag({ meta }: { meta: AutoMeta }) {
  return (
    <span
      title={`${meta.source}${meta.note ? " — " + meta.note : ""}`}
      className={`ml-1.5 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${AUTO_TAG_STYLE[meta.confidence]}`}
    >
      {meta.confidence === "data" ? "auto" : meta.confidence}
    </span>
  );
}

function Leaf({
  field,
  inputs,
  auto,
  setNum,
  setSel,
}: {
  field: NumericField | SelectField;
  inputs: ScorecardInputs;
  auto?: AutoMeta;
  setNum: (id: string, v: string) => void;
  setSel: (id: string, v: string) => void;
}) {
  const value = (inputs as unknown as Record<string, number | string>)[field.id];
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">
        {field.label}
        {field.kind === "numeric" && field.unit ? ` (${field.unit})` : ""}
        {auto && <AutoTag meta={auto} />}
      </span>
      {field.kind === "numeric" ? (
        <input
          type="number"
          value={String(value ?? "")}
          onChange={(e) => setNum(field.id, e.target.value)}
          className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      ) : (
        <select
          value={String(value ?? "")}
          onChange={(e) => setSel(field.id, e.target.value)}
          className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        >
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.value}
            </option>
          ))}
        </select>
      )}
      {field.help && (
        <span className="mt-1 block text-[11px] text-slate-400">{field.help}</span>
      )}
    </label>
  );
}

/** Population per car wash = population ÷ (1 + competition), shown read-only. */
function PopPerWash({
  inputs,
  auto,
  setNum,
}: {
  inputs: ScorecardInputs;
  auto?: AutoMeta;
  setNum: (id: string, v: string) => void;
}) {
  const computed = popPerWash(inputs);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">
          Trade-area Population
          {auto && <AutoTag meta={auto} />}
        </span>
        <input
          type="number"
          value={String(inputs.population ?? "")}
          onChange={(e) => setNum("population", e.target.value)}
          className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
        />
      </label>
      <div className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">
          Population per Wash
        </span>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 tabular-nums">
          {Math.round(computed).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
