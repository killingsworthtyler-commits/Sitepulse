// Desktop score: the scorecard run over only the criteria we can know remotely
// (traffic, competition, competitor quality, population-per-wash, and the Market
// composite). The site-visit criteria — visibility, ingress/egress, layout — are
// excluded, since they need eyes on the ground. We reuse the real scoring engine
// so the math can never drift from the full scorecard.

import {
  scoreSite,
  gradeFor,
  type ScorecardInputs,
  type Grade,
} from "@/lib/scorecard/modwash";
import type { SiteMetrics } from "./metrics";

/** Criteria the desktop data covers (by criterion id in MODWASH_CRITERIA). */
const DESKTOP_IDS = new Set([
  "trafficCount",
  "competition",
  "qualityOfCompetition",
  "popPerWash",
  "market",
]);

// Site-visit fields don't affect the desktop criteria, but scoreSite needs a full
// inputs object — fill them with the ModWash prototype so the call is well-formed.
const SITE_VISIT_DEFAULTS = {
  trafficSpeed: 35,
  sightLine: "More Than 500 Feet Both Directions",
  offBlock: "No",
  directAccess: "Full Access",
  typeOfSite: "Signalized / Direct Full Access",
  payStations: "3+",
  vacuumSlots: "More than 18 Vacuums",
  memberLane: "Yes",
} as const;

export interface DesktopScore {
  /** 0–1 over the desktop criteria only. */
  percent: number;
  grade: Grade;
  earned: number;
  possible: number;
}

export function inputsFromMetrics(m: SiteMetrics): ScorecardInputs {
  return {
    trafficCount: m.trafficCount,
    competition: m.competition,
    population: m.population,
    qualityOfCompetition: m.qualityOfCompetition,
    medianIncome: m.medianIncome,
    daytimePop: m.daytimePop,
    projGrowth: m.projGrowth,
    trafficDriver: m.trafficDriver,
    snowDays: m.snowDays,
    ...SITE_VISIT_DEFAULTS,
  };
}

/** Score a location on the desktop-knowable criteria. */
export function desktopScore(m: SiteMetrics): DesktopScore {
  const full = scoreSite(inputsFromMetrics(m), m.variant);
  let earned = 0;
  let possible = 0;
  for (const c of full.criteria) {
    if (!DESKTOP_IDS.has(c.id)) continue;
    earned += c.earned;
    possible += c.possible;
  }
  const percent = possible ? earned / possible : 0;
  return { percent, grade: gradeFor(percent), earned, possible };
}
