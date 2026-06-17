// Gather the remotely-knowable scorecard metrics for a map point — the desktop
// half of a site evaluation. Reuses the same free/keyed providers the address
// auto-fill uses, but starts from coordinates instead of a typed address.

import {
  geocodeCoords,
  ringBlockGroupGeoids,
  ringDemographics,
  countyGrowth,
} from "@/lib/autofill/census";
import { getRingJobs } from "@/lib/autofill/lodes";
import { nearestAadt } from "@/lib/autofill/aadt";
import {
  detectCompetitionPlaces,
  detectTrafficDriverPlaces,
} from "@/lib/autofill/places";
import { estimateSnowDays, suggestVariant } from "@/lib/autofill/climate";
import type { Variant } from "@/lib/scorecard/modwash";

const RING_METERS = 4828; // 3 miles — matches the trade-area magnitude

/** The desktop-knowable inputs for a location. Site-visit fields are not here. */
export interface SiteMetrics {
  trafficCount: number;
  competition: number;
  population: number;
  qualityOfCompetition: string;
  medianIncome: number;
  daytimePop: number;
  projGrowth: number;
  trafficDriver: string;
  snowDays: number;
  variant: Variant;
  /** How many of the core signals came from real data (0–5) — a confidence cue. */
  dataPoints: number;
}

/** Pull the desktop metrics for a point. Resilient: any provider that fails just
    leaves its field at a neutral default and lowers `dataPoints`. */
export async function gatherSiteMetrics(
  lat: number,
  lng: number,
): Promise<SiteMetrics> {
  const censusKey = process.env.CENSUS_API_KEY;
  const gKey = process.env.GOOGLE_MAPS_API_KEY;
  const variant = suggestVariant(lat);

  // Kick off the independent lookups together.
  const fips = await geocodeCoords(lat, lng);
  const geoids = fips
    ? await ringBlockGroupGeoids(lat, lng, RING_METERS)
    : [];

  const [demo, growth, aadt, comp, driver] = await Promise.all([
    fips ? ringDemographics(fips.state, fips.county, geoids, censusKey) : null,
    fips ? countyGrowth(fips.state, fips.county, censusKey) : null,
    nearestAadt(lat, lng),
    gKey ? detectCompetitionPlaces(lat, lng, gKey) : null,
    gKey ? detectTrafficDriverPlaces(lat, lng, gKey) : null,
  ]);

  const jobs =
    demo && fips ? await getRingJobs(fips.state, geoids) : null;

  let dataPoints = 0;
  if (demo) dataPoints++;
  if (growth != null) dataPoints++;
  if (aadt) dataPoints++;
  if (comp) dataPoints++;
  if (driver) dataPoints++;

  const population = demo?.population ?? 0;
  const daytimePop =
    demo && jobs != null && demo.employedResidents > 0
      ? Math.max(0, Math.round(population + jobs - demo.employedResidents))
      : population;

  return {
    trafficCount: aadt?.aadt ?? 0,
    competition: comp?.count ?? 0,
    population,
    qualityOfCompetition: comp?.quality ?? "None",
    medianIncome: demo?.medianIncome ?? 0,
    daytimePop,
    projGrowth: growth != null ? Math.round(growth * 100) / 100 : 0,
    trafficDriver: driver ?? "D",
    snowDays: estimateSnowDays(lat),
    variant,
    dataPoints,
  };
}
