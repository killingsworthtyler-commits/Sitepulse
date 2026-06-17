import type { Variant } from "@/lib/scorecard/modwash";
import {
  geocodeRobust,
  ringBlockGroupGeoids,
  ringDemographics,
  countyGrowth,
} from "./census";
import { getRingJobs } from "./lodes";
import { nearestAadt } from "./aadt";
import { estimateSnowDays, suggestVariant } from "./climate";
import {
  detectCompetition,
  detectCompetitionPlaces,
  detectTrafficDriverPlaces,
} from "./places";

/** One auto-filled scorecard field + provenance. */
export interface AutofillField {
  value: number | string;
  source: string;
  /** "data" = from a real source, "estimate" = heuristic, "mock" = placeholder. */
  confidence: "data" | "estimate" | "mock";
  note?: string;
}

export interface AutofillResult {
  ok: boolean;
  error?: string;
  matchedAddress?: string;
  lat?: number;
  lng?: number;
  suggestedVariant?: Variant;
  /** Keyed by ScorecardInputs field id. */
  fields: Record<string, AutofillField>;
  warnings: string[];
}

const RING_METERS = 4828; // 3 miles — matches the trade-area magnitude in the data

export async function autofillSite(address: string): Promise<AutofillResult> {
  const geo = await geocodeRobust(address);
  if (!geo) {
    return {
      ok: false,
      error:
        "Couldn't find that address. Check the spelling, or enter the inputs manually.",
      fields: {},
      warnings: [],
    };
  }

  const fields: Record<string, AutofillField> = {};
  const warnings: string[] = [];

  // Traffic count (AADT) — FHWA national HPMS layer (free, no key).
  const aadt = await nearestAadt(geo.lat, geo.lng);
  if (aadt) {
    const road = aadt.routeName ? ` on ${aadt.routeName}` : "";
    const yr = aadt.year ? ` (${aadt.year})` : "";
    fields.trafficCount = {
      value: aadt.aadt,
      source: `FHWA HPMS — nearest segment${road}${yr}`,
      confidence: "estimate",
      note: "Highest AADT within ~250m (the frontage road). National HPMS lags ~2–3 yrs and skips many local roads — confirm against the state DOT for the exact segment.",
    };
  }

  // Climate + variant (free, latitude heuristic)
  fields.snowDays = {
    value: estimateSnowDays(geo.lat),
    source: "Climate estimate (latitude)",
    confidence: "estimate",
    note: "Rough — confirm against NOAA normals for the market.",
  };

  // Competition + traffic driver — Google Places when keyed, else placeholder.
  const gKey = process.env.GOOGLE_MAPS_API_KEY;
  const livePlaces = gKey
    ? await detectCompetitionPlaces(geo.lat, geo.lng, gKey)
    : null;
  const liveDriver = gKey
    ? await detectTrafficDriverPlaces(geo.lat, geo.lng, gKey)
    : null;
  const mock = detectCompetition(address);

  if (livePlaces) {
    fields.competition = {
      value: livePlaces.count,
      source: `Google Places — ${livePlaces.count} car wash${livePlaces.count === 1 ? "" : "es"} within 3 mi`,
      confidence: "data",
    };
    fields.qualityOfCompetition = {
      value: livePlaces.quality,
      source: "Google Places — competitor brands",
      confidence: "data",
    };
  } else {
    fields.competition = {
      value: mock.count,
      source: "Placeholder",
      confidence: "mock",
      note: "Mock — add GOOGLE_MAPS_API_KEY for a real car-wash count.",
    };
    fields.qualityOfCompetition = {
      value: mock.quality,
      source: "Placeholder",
      confidence: "mock",
    };
  }

  if (liveDriver) {
    fields.trafficDriver = {
      value: liveDriver,
      source: "Google Places — nearby retail anchors",
      confidence: "data",
    };
  } else {
    fields.trafficDriver = {
      value: mock.trafficDriver,
      source: "Placeholder",
      confidence: "mock",
      note: "Mock — Places classifies nearby anchors (Walmart=A, Food Lion=B…).",
    };
  }

  if (gKey && !livePlaces && !liveDriver) {
    warnings.push(
      "Google Places returned nothing or the key/billing isn't active yet — using placeholders for competition.",
    );
  }

  // Demographics — real ACS 3-mile block-group ring (needs free key)
  const key = process.env.CENSUS_API_KEY;
  const geoids = await ringBlockGroupGeoids(geo.lat, geo.lng, RING_METERS);
  const demo = await ringDemographics(geo.state, geo.county, geoids, key);

  const ringNote =
    "Census ACS 3-mi block-group ring — approximate; concentric rings read higher than custom trade-area reports, so review.";

  if (demo) {
    fields.population = {
      value: demo.population,
      source: `US Census ACS — 3-mi ring (${demo.bgCount} block groups)`,
      confidence: "data",
      note: ringNote,
    };
    if (demo.medianIncome > 0) {
      fields.medianIncome = {
        value: demo.medianIncome,
        source: "US Census ACS — 3-mi ring (household-weighted)",
        confidence: "data",
        note: ringNote,
      };
    }

    // Daytime population = residents + jobs in area − employed residents.
    const jobs = await getRingJobs(geo.state, geoids);
    if (jobs != null && demo.employedResidents > 0) {
      fields.daytimePop = {
        value: Math.max(
          0,
          Math.round(demo.population + jobs - demo.employedResidents),
        ),
        source: "Census ACS + LODES — 3-mi ring",
        confidence: "estimate",
        note: "Residents + jobs in area − employed residents. Approximate.",
      };
    }
  } else if (!key) {
    warnings.push(
      "Add a free CENSUS_API_KEY to .env.local to auto-fill demographics (population & income). Sign up: api.census.gov/data/key_signup.html",
    );
  } else {
    warnings.push("Census demographics weren't available for this location.");
  }

  // Projected growth — county ACS trend, annualized (needs key)
  const growth = await countyGrowth(geo.state, geo.county, key);
  if (growth != null) {
    fields.projGrowth = {
      value: Math.round(growth * 100) / 100,
      source: "US Census ACS — county trend (5-yr annualized)",
      confidence: "estimate",
      note: "County growth trend as a proxy for projected growth.",
    };
  }

  warnings.push(
    aadt
      ? "The physical site fields (visibility, ingress, layout) still need manual entry."
      : "Traffic count and the physical site fields (visibility, ingress, layout) still need manual entry.",
  );

  return {
    ok: true,
    matchedAddress: geo.matchedAddress,
    lat: geo.lat,
    lng: geo.lng,
    suggestedVariant: suggestVariant(geo.lat),
    fields,
    warnings,
  };
}
