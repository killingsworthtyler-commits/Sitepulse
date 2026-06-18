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
import type { Grade } from "@/lib/scorecard/modwash";

const COMP_RADIUS = 4828; // 3 miles

// Demographic rows worth handing the AI analyst (keeps the prompt focused).
const DEMO_HIGHLIGHT_LABELS = new Set([
  "Total Population",
  "Median Age",
  "Median Household Income",
  "Per Capita Income",
  "Daytime Population",
  "Total Households",
  "Avg Household Size",
]);

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
}

export async function buildSiteReport(address: string): Promise<SiteReport> {
  const loc = await geocodeRobust(address);
  if (!loc || !loc.state || !loc.county) {
    return { ok: false, address, error: "Couldn't find that address. Check the spelling and try again." };
  }

  const gKey = process.env.GOOGLE_MAPS_API_KEY;
  const [metrics, competitors, washes, demographics, ringRadiusM, analogVars] = await Promise.all([
    gatherSiteMetrics(loc.lat, loc.lng),
    gKey ? findCompetitors(loc.lat, loc.lng, COMP_RADIUS, gKey) : Promise.resolve([]),
    gKey ? findCarWashesTyped(loc.lat, loc.lng, COMP_RADIUS, gKey) : Promise.resolve([]),
    fetchDemographicsReport(address),
    popRingRadiusMeters(loc.lat, loc.lng),
    analogVariables(loc.lat, loc.lng),
  ]);

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
        names: competitors.slice(0, 8).map((c) => c.name),
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
  };
}
