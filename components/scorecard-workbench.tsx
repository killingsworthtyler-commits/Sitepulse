"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { scoreSite, type Grade } from "@/lib/scorecard/modwash";
import {
  listScorecardsAction,
  saveScorecardAction,
  deleteScorecardAction,
} from "@/app/scorecard/db-actions";
import { newScorecardId, type SavedScorecard } from "@/lib/scorecard/saved";
import { ScorecardTool, type ScorecardDraft } from "@/components/scorecard-tool";
import { GradeBadge } from "@/components/badges";

const GRADES: Grade[] = ["A", "B", "C"];

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function ScorecardWorkbench() {
  const [list, setList] = useState<SavedScorecard[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"list" | "edit">("list");
  const [draft, setDraft] = useState<ScorecardDraft | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState<Grade | "all">("all");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await listScorecardsAction();
    setConfigured(res.configured);
    setDbError(res.error ?? null);
    setList(res.scorecards);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const scored = useMemo(
    () => list.map((s) => ({ ...s, result: scoreSite(s.inputs, s.variant) })),
    [list],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scored.filter((s) => {
      if (grade !== "all" && s.result.grade !== grade) return false;
      if (q && !`${s.name} ${s.address ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [scored, query, grade]);

  function startNew() {
    setDraft(undefined);
    setMode("edit");
  }

  function startEdit(s: SavedScorecard) {
    setDraft({
      id: s.id,
      name: s.name,
      address: s.address,
      variant: s.variant,
      inputs: s.inputs,
    });
    setMode("edit");
  }

  async function handleSave(d: ScorecardDraft) {
    const now = new Date().toISOString();
    const existing = d.id ? list.find((s) => s.id === d.id) : undefined;
    const sc: SavedScorecard = {
      id: d.id ?? newScorecardId(),
      name: d.name,
      address: d.address,
      variant: d.variant,
      inputs: d.inputs,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    setSaving(true);
    const res = await saveScorecardAction(sc);
    setSaving(false);
    if (!res.ok) {
      setDbError(res.error ?? "Couldn't save the scorecard.");
      return;
    }
    setDbError(null);
    await refresh();
    setMode("list");
  }

  async function handleDelete(id: string) {
    const res = await deleteScorecardAction(id);
    setConfirmId(null);
    if (!res.ok) {
      setDbError(res.error ?? "Couldn't delete the scorecard.");
      return;
    }
    await refresh();
  }

  // ---------------- Editor ----------------
  if (mode === "edit") {
    return (
      <div>
        <button
          onClick={() => setMode("list")}
          className="mb-4 text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to scorecards
        </button>
        <h2 className="font-display mb-4 flex items-center gap-3 text-xl font-bold uppercase tracking-wide text-ink">
          {draft?.id ? "Edit Scorecard" : "New Scorecard"}
          {saving && (
            <span className="text-xs font-medium normal-case tracking-normal text-slate-400">
              Saving…
            </span>
          )}
        </h2>
        <ScorecardTool
          initial={draft}
          onSave={handleSave}
          onCancel={() => setMode("list")}
        />
      </div>
    );
  }

  // ---------------- List ----------------
  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide text-ink">
            Scorecards
          </h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 tabular-nums">
            {filtered.length}
          </span>
        </div>
        <button
          onClick={startNew}
          className="brand-gradient inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
        >
          + New Scorecard
        </button>
      </div>

      {loaded && !configured && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Database not connected.</span> Set{" "}
          <code className="rounded bg-amber-100 px-1">DATABASE_URL</code> to save
          scorecards. Saving won&apos;t work until it&apos;s configured.
        </div>
      )}
      {dbError && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {dbError}
        </div>
      )}

      {list.length > 0 && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or address…"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue sm:max-w-xs"
          />
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
            <FilterChip active={grade === "all"} onClick={() => setGrade("all")}>
              All
            </FilterChip>
            {GRADES.map((g) => (
              <FilterChip key={g} active={grade === g} onClick={() => setGrade(g)}>
                {g}
              </FilterChip>
            ))}
          </div>
        </div>
      )}

      {!loaded && (
        <p className="py-10 text-center text-sm text-slate-400">Loading scorecards…</p>
      )}

      {/* Empty states */}
      {loaded && configured && list.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="font-display text-lg font-bold uppercase tracking-wide text-slate-700">
            No scorecards yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            Score a site by address — population, traffic, and competition
            auto-fill — then save it here to compare candidates.
          </p>
          <button
            onClick={startNew}
            className="brand-gradient mt-5 inline-flex rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
          >
            + Create your first scorecard
          </button>
        </div>
      )}

      {loaded && list.length > 0 && filtered.length === 0 && (
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No scorecards match your filters.
        </p>
      )}

      {/* Cards */}
      {filtered.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <li
              key={s.id}
              className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 ring-1 ring-slate-900/[0.02] transition-colors hover:border-brand-blue/40"
            >
              <div className="flex items-start gap-3">
                <GradeBadge grade={s.result.grade} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{s.name}</p>
                  {s.address && (
                    <p className="truncate text-xs text-slate-500">{s.address}</p>
                  )}
                </div>
                <span className="font-display text-2xl font-bold text-ink tabular-nums">
                  {(s.result.percent * 100).toFixed(0)}%
                </span>
              </div>

              <p className="mt-3 text-[11px] text-slate-400">
                <span className="capitalize">{s.variant}</span> model · updated{" "}
                {fmtDate(s.updatedAt)}
              </p>

              <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
                {confirmId === s.id ? (
                  <>
                    <span className="text-xs text-slate-500">Delete?</span>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      No
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(s)}
                      className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirmId(s.id)}
                      className="ml-auto rounded-md px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
