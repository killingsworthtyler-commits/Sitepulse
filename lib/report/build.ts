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
import { gatherSiteMetrics, type SiteMetrics } from "@/lib/prospect/metrics";
import { desktopScore } from "@/lib/prospect/score";
import { fetchDemographicsReport, type DemographicsReport } from "@/lib/demographics/report";
import type { Grade } from "@/lib/scorecard/modwash";

const COMP_RADIUS = 4828; // 3 miles

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
  demographics?: DemographicsReport;
}

export async function buildSiteReport(address: string): Promise<SiteReport> {
  const loc = await geocodeRobust(address);
  if (!loc || !loc.state || !loc.county) {
    return { ok: false, address, error: "Couldn't find that address. Check the spelling and try again." };
  }

  const gKey = process.env.GOOGLE_MAPS_API_KEY;
  const [metrics, competitors, washes, demographics, ringRadiusM] = await Promise.all([
    gatherSiteMetrics(loc.lat, loc.lng),
    gKey ? findCompetitors(loc.lat, loc.lng, COMP_RADIUS, gKey) : Promise.resolve([]),
    gKey ? findCarWashesTyped(loc.lat, loc.lng, COMP_RADIUS, gKey) : Promise.resolve([]),
    fetchDemographicsReport(address),
    popRingRadiusMeters(loc.lat, loc.lng),
  ]);

  const score = desktopScore(metrics);
  const cannibalization = findCannibalization(loc.lat, loc.lng, ringRadiusM);

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
    demographics,
  };
}
