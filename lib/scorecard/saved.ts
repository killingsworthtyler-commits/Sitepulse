// The saved-scorecard shape, shared by the client UI and the database layer.

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

export function newScorecardId(): string {
  return `sc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export interface ScorecardListResult {
  ok: boolean;
  /** False when DATABASE_URL isn't set yet. */
  configured: boolean;
  scorecards: SavedScorecard[];
  error?: string;
}

export interface MutationResult {
  ok: boolean;
  error?: string;
}
