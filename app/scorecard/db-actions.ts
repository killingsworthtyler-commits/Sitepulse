"use server";

import {
  dbConfigured,
  dbListScorecards,
  dbUpsertScorecard,
  dbDeleteScorecard,
} from "@/lib/db/scorecards";
import type {
  SavedScorecard,
  ScorecardListResult,
  MutationResult,
} from "@/lib/scorecard/saved";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Database error.");

export async function listScorecardsAction(): Promise<ScorecardListResult> {
  if (!dbConfigured()) return { ok: false, configured: false, scorecards: [] };
  try {
    return { ok: true, configured: true, scorecards: await dbListScorecards() };
  } catch (e) {
    return { ok: false, configured: true, scorecards: [], error: msg(e) };
  }
}

export async function saveScorecardAction(sc: SavedScorecard): Promise<MutationResult> {
  try {
    await dbUpsertScorecard(sc);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function deleteScorecardAction(id: string): Promise<MutationResult> {
  try {
    await dbDeleteScorecard(id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}
