"use server";

// Regenerate just the AI analysis for a trimmed competitor selection. Reuses the
// cached report's data (no Census/Places/ORS re-calls) — only the Anthropic call
// re-runs — then persists the trimmed selection + new narrative as the saved copy.

import { dbGetReport, dbSaveReport, reportsConfigured } from "@/lib/db/reports";
import { DEMO_HIGHLIGHT_LABELS } from "@/lib/report/build";
import type { DealType } from "@/lib/deal";
import { desktopScore } from "@/lib/prospect/score";
import { generateReasoning } from "@/lib/ai/reasoning";

export interface RegenerateResult {
  ok: boolean;
  error?: string;
}

const EXPRESS = "Express / automatic";

/** `types` is aligned to report.competitionCandidates — the user's hand-classified
    wash type per row. Only "Express / automatic" counts as competition. */
export async function regenerateAnalysisAction(
  address: string,
  dealType: DealType,
  types: string[],
): Promise<RegenerateResult> {
  if (!reportsConfigured()) {
    return { ok: false, error: "Saving isn't configured (no database)." };
  }
  const cached = await dbGetReport(address, dealType);
  if (!cached?.report?.ok || !cached.report.metrics) {
    return { ok: false, error: "No saved report to regenerate. Refresh the data first." };
  }
  const report = cached.report;
  const candidates = report.competitionCandidates ?? [];

  // Apply the user's classification to each candidate; competition = express count.
  const updatedCandidates = candidates.map((c, i) => {
    const type = types[i] ?? c.type;
    return { ...c, type, counts: type === EXPRESS };
  });
  const competition = updatedCandidates.filter((c) => c.counts).length;
  const competitorNames = updatedCandidates.filter((c) => c.counts).map((c) => c.name);

  const metrics = { ...report.metrics!, competition };
  const score = desktopScore(metrics);

  const demoHighlights = (report.demographics?.sections ?? [])
    .flatMap((s) => s.rows)
    .filter((r) => DEMO_HIGHLIGHT_LABELS.has(r.label))
    .map((r) => ({ label: r.label, value: r.value }));
  const washesByType: Record<string, number> = {};
  for (const w of report.washes ?? []) washesByType[w.type] = (washesByType[w.type] ?? 0) + 1;

  const reasoning = await generateReasoning({
    matchedAddress: report.matchedAddress ?? address,
    dealType,
    target: report.target ?? null,
    variant: metrics.variant,
    scorePercent: score.percent,
    grade: score.grade,
    criteria: score.criteria.map((c) => ({ label: c.label, points: c.points, rating: c.rating })),
    competition: { count: competition, quality: metrics.qualityOfCompetition, names: competitorNames.slice(0, 8) },
    washesByType,
    demographics: demoHighlights,
    analogs: (report.analogs ?? []).slice(0, 4).map((a) => ({
      name: a.name, city: a.city, state: a.state, matchPct: a.matchPct,
    })),
    cannibalization: (report.cannibalization ?? [])
      .filter((c) => c.overlapPct >= 10)
      .map((c) => ({ name: c.name, overlapPct: c.overlapPct })),
  });

  if (!reasoning) {
    return { ok: false, error: "Couldn't reach the AI (check ANTHROPIC_API_KEY)." };
  }

  await dbSaveReport(address, dealType, {
    ...report,
    metrics,
    score: { percent: score.percent, grade: score.grade },
    reasoning,
    competitionCandidates: updatedCandidates,
    defaultCompetitorNames: competitorNames,
  });

  return { ok: true };
}
