// Assemble a full, shareable site report for an address: location, desktop
// score + metrics, mapped competitors, and the demographic summary. Composed
// from the same data sources used elsewhere, so the report can't drift.

import { geocodeRobust } from "@/lib/autofill/census";
import {
  findCompetitors,
  findCarWashesTyped,
  type Competitor,
  type TypedWash,
} from "@/lib/autofill/places";
import { popRingRadiusMeters } from "@/lib/autofill/tradearea";
import { findCannibalization, type CannibalStore } from "@/lib/report/cannibalization";
import { analogVariables, type AnalogVars } from "@/lib/analogs/variables";
import { matchAnalogs, type AnalogMatch } from "@/lib/analogs/match";
import { generateReasoning, type Reasoning } from "@/lib/ai/reasoning";
import { gatherSiteMetrics, type SiteMetrics } from "@/lib/prospect/metrics";
import { desktopScore } from "@/lib/prospect/score";
import { fetchDemographicsReport, type DemographicsReport } from "@/lib/demographics/report";
import { type DealType, ONSITE_M, metersBetween } from "@/lib/deal";
import type { Grade } from "@/lib/scorecard/modwash";

const COMP_RADIUS = 4828; // 3 miles

// Demographic rows worth handing the AI analyst (keeps the prompt focused).
export const DEMO_HIGHLIGHT_LABELS = new Set([
  "Total Population",
  "Median Age",
  "Median Household Income",
  "Per Capita Income",
  "Daytime Population",
  "Total Households",
  "Avg Household Size",
]);

/** A nearby wash the user can include/exclude from the competition count. */
export interface CompetitionCandidate {
  name: string;
  type: string;
  distMi: number;
  /** Counts toward competition by default (the express set, minus an acquisition's asset). */
  counts: boolean;
}

export interface SiteReport {
  ok: boolean;
  error?: string;
  address: string;
  matchedAddress?: string;
  lat?: number;
  lng?: number;
  score?: { percent: number; grade: Grade };
  metrics?: SiteMetrics;
  competitors?: Competitor[];
  /** Every nearby car wash, labeled by type (for the breakdown). */
  washes?: TypedWash[];
  /** Radius (meters) of the 20K-population competition ring. */
  ringRadiusM?: number;
  /** Existing ModWash stores whose ring overlaps the candidate's. */
  cannibalization?: CannibalStore[];
  /** The candidate's 3-mile analog footprint (for the comparison table). */
  analogVars?: AnalogVars;
  /** Closest operational stores by demographic footprint. */
  analogs?: AnalogMatch[];
  /** AI analyst narrative (only when ANTHROPIC_API_KEY is configured). */
  reasoning?: Reasoning;
  demographics?: DemographicsReport;
  /** Build (greenfield) vs acquisition (buying an existing wash). */
  dealType?: DealType;
  /** For an acquisition: the existing on-site wash being bought (excluded from competition). */
  target?: { name: string; type: string } | null;
  /** Names of the washes counted as direct competition by default (for the trim checklist). */
  defaultCompetitorNames?: string[];
  /** Every nearby wash that could count as competition, with its default state (for the trim UI). */
  competitionCandidates?: CompetitionCandidate[];
}

export async function buildSiteReport(
  address: string,
  dealType: DealType = "build",
): Promise<SiteReport> {
  const loc = await geocodeRobust(address);
  if (!loc || !loc.state || !loc.county) {
    return { ok: false, address, error: "Couldn't find that address. Check the spelling and try again." };
  }

  const gKey = process.env.GOOGLE_MAPS_API_KEY;
  const [rawMetrics, allCompetitors, washes, demographics, ringRadiusM, analogVars] = await Promise.all([
    gatherSiteMetrics(loc.lat, loc.lng),
    gKey ? findCompetitors(loc.lat, loc.lng, COMP_RADIUS, gKey) : Promise.resolve([]),
    gKey ? findCarWashesTyped(loc.lat, loc.lng, COMP_RADIUS, gKey) : Promise.resolve([]),
    fetchDemographicsReport(address),
    popRingRadiusMeters(loc.lat, loc.lng),
    analogVariables(loc.lat, loc.lng),
  ]);

  // Acquisition: the wash sitting on the address is the asset being bought, not a
  // competitor. Detect it (nearest wash within ~0.12 mi), drop it from the
  // competitor count, and re-score so the deal isn't penalized for its own asset.
  const onSite = (la: number, lo: number) => metersBetween(loc.lat, loc.lng, la, lo) <= ONSITE_M;
  const onSiteWashes = washes.filter((w) => onSite(w.lat, w.lng));
  const target =
    dealType === "acquisition" && onSiteWashes.length > 0
      ? { name: onSiteWashes[0].name, type: onSiteWashes[0].type }
      : null;

  // Direct competitors = the express/automatic washes shown on the report (minus
  // the on-site asset in an acquisition). Deriving the count from the SAME list
  // the user sees means the count is exactly what they can trim — the interactive
  // checklist on the report toggles these and re-scores live.
  const directCompetitors = washes.filter(
    (w) => w.type === "Express / automatic" && !(target && onSite(w.lat, w.lng)),
  );
  const defaultCompetitorNames = directCompetitors.map((w) => w.name);
  const competitors = target
    ? allCompetitors.filter((c) => !onSite(c.lat, c.lng))
    : allCompetitors;
  const metrics: SiteMetrics = { ...rawMetrics, competition: directCompetitors.length };

  // Every nearby wash that could plausibly be competition (express by default,
  // plus other types the user can opt in), for the report's trim checklist.
  const competitionCandidates: CompetitionCandidate[] = washes
    .filter((w) => w.type !== "ModWash (own store)" && w.type !== "Not a wash")
    .map((w) => ({
      name: w.name,
      type: w.type,
      distMi: Math.round((metersBetween(loc.lat, loc.lng, w.lat, w.lng) / 1609.34) * 100) / 100,
      counts: w.type === "Express / automatic" && !(target !== null && onSite(w.lat, w.lng)),
    }))
    .sort((a, b) => a.distMi - b.distMi);

  const score = desktopScore(metrics);
  const cannibalization = findCannibalization(loc.lat, loc.lng, ringRadiusM);
  const analogs = analogVars ? matchAnalogs(analogVars) : [];

  // AI analyst read — grounded in everything we just computed. Runs only when a
  // key is configured; otherwise generateReasoning returns null and we omit it.
  const washesByType: Record<string, number> = {};
  for (const w of washes) washesByType[w.type] = (washesByType[w.type] ?? 0) + 1;
  const demoHighlights = (demographics?.sections ?? [])
    .flatMap((s) => s.rows)
    .filter((r) => DEMO_HIGHLIGHT_LABELS.has(r.label))
    .map((r) => ({ label: r.label, value: r.value }));
  const reasoning =
    (await generateReasoning({
      matchedAddress: loc.matchedAddress ?? address,
      dealType,
      target,
      variant: metrics.variant,
      scorePercent: score.percent,
      grade: score.grade,
      criteria: score.criteria.map((c) => ({
        label: c.label,
        points: c.points,
        rating: c.rating,
      })),
      competition: {
        count: metrics.competition,
        quality: metrics.qualityOfCompetition,
        names: defaultCompetitorNames.slice(0, 8),
      },
      washesByType,
      demographics: demoHighlights,
      analogs: analogs.slice(0, 4).map((a) => ({
        name: a.name,
        city: a.city,
        state: a.state,
        matchPct: a.matchPct,
      })),
      cannibalization: cannibalization
        .filter((c) => c.overlapPct >= 10)
        .map((c) => ({ name: c.name, overlapPct: c.overlapPct })),
    })) ?? undefined;

  return {
    ok: true,
    address,
    matchedAddress: loc.matchedAddress,
    lat: loc.lat,
    lng: loc.lng,
    score: { percent: score.percent, grade: score.grade },
    metrics,
    competitors,
    washes,
    ringRadiusM,
    cannibalization,
    analogVars: analogVars ?? undefined,
    analogs,
    reasoning,
    demographics,
    dealType,
    target,
    defaultCompetitorNames,
    competitionCandidates,
  };
}
