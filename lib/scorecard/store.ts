// Saved scorecards — persisted in the browser (localStorage) so they survive
// reloads without a backend. The data layer mirrors a future DB: pure functions
// that take/return the full list, so swapping in Supabase/Postgres later only
// touches this file. Score is never stored — it's recomputed from inputs.

import type { ScorecardInputs, Variant } from "./modwash";

export interface SavedScorecard {
  id: string;
  name: string;
  /** Matched/typed address, for display + search. */
  address?: string;
  variant: Variant;
  inputs: ScorecardInputs;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

const KEY = "sitepulse.scorecards.v1";

export function loadScorecards(): SavedScorecard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as SavedScorecard[]) : [];
  } catch {
    return [];
  }
}

function persist(list: SavedScorecard[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* quota / private mode — ignore */
  }
}

/** Insert or update by id; newest first. Returns the new list. */
export function upsertScorecard(sc: SavedScorecard): SavedScorecard[] {
  const list = loadScorecards();
  const i = list.findIndex((s) => s.id === sc.id);
  if (i >= 0) list[i] = sc;
  else list.unshift(sc);
  persist(list);
  return list;
}

export function deleteScorecard(id: string): SavedScorecard[] {
  const list = loadScorecards().filter((s) => s.id !== id);
  persist(list);
  return list;
}

export function newScorecardId(): string {
  return `sc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
