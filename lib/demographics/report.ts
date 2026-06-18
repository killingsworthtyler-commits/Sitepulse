// A full demographic summary for an address — modeled on the Experian
// "Complete Demographic Summary" the team uses, but built from FREE US Census
// ACS 5-year data aggregated over a 3-mile block-group ring. Numbers are
// approximate vs Experian's custom trade area; the Experian-proprietary pieces
// (2029 projections, Seasonal Population) are omitted.

import { geocodeRobust, countyGrowth } from "@/lib/autofill/census";
import { getTradeArea } from "@/lib/autofill/tradearea";
import { getRingJobs } from "@/lib/autofill/lodes";

export interface DemoRow {
  label: string;
  value: string;
  /** Optional share of the section's base (e.g. % of households). */
  pct?: string;
}
export interface DemoSection {
  title: string;
  rows: DemoRow[];
}
export interface DemographicsReport {
  ok: boolean;
  error?: string;
  matchedAddress?: string;
  lat?: number;
  lng?: number;
  bgCount?: number;
  /** Human label for the trade area, e.g. "7-min drive-time" or "3-mi ring". */
  tradeArea?: string;
  sections?: DemoSection[];
}

// ---------------------------------------------------------------------------
// ACS fetch helpers
// ---------------------------------------------------------------------------

type Row = Record<string, number>;

/** Fetch ACS variables for every block group in a county, keep the trade-area
    block groups, and tag each row with its apportionment weight (`__w`). */
async function acsRing(
  state: string,
  county: string,
  vars: string[],
  weights: Record<string, number>,
  key: string,
): Promise<Row[]> {
  const url =
    `https://api.census.gov/data/2023/acs/acs5?get=${vars.join(",")}` +
    `&for=block%20group:*&in=state:${state}%20county:${county}&key=${key}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const rows: string[][] = await res.json();
    const head = rows[0];
    const iSt = head.indexOf("state");
    const iCo = head.indexOf("county");
    const iTr = head.indexOf("tract");
    const iBg = head.indexOf("block group");
    const vi = vars.map((v) => head.indexOf(v));
    const out: Row[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const geoid = `${r[iSt]}${r[iCo]}${r[iTr]}${r[iBg]}`;
      const w = weights[geoid];
      if (!w) continue;
      const rec: Row = { __w: w };
      vars.forEach((v, k) => (rec[v] = Number(r[vi[k]]) || 0));
      out.push(rec);
    }
    return out;
  } catch {
    return [];
  }
}

/** Apportioned sum: each block group's value times its area-fraction weight. */
const sum = (rows: Row[], v: string) =>
  rows.reduce((a, r) => a + (r[v] || 0) * (r.__w ?? 1), 0);

/** Weighted average of a per-BG figure (e.g. median income), where the base
    weight is also scaled by the apportionment fraction. */
function weightedAvg(rows: Row[], valueVar: string, weightVar: string): number {
  let num = 0;
  let den = 0;
  for (const r of rows) {
    const v = r[valueVar];
    const w = (r[weightVar] || 0) * (r.__w ?? 1);
    if (v > 0 && w > 0) {
      num += v * w;
      den += w;
    }
  }
  return den > 0 ? num / den : 0;
}

// ---------------------------------------------------------------------------
// Variable sets
// ---------------------------------------------------------------------------

// Income brackets B19001_002E..._017E
const INCOME_BRACKETS: [string, string][] = [
  ["B19001_002E", "< $10,000"],
  ["B19001_003E", "$10,000–$14,999"],
  ["B19001_004E", "$15,000–$19,999"],
  ["B19001_005E", "$20,000–$24,999"],
  ["B19001_006E", "$25,000–$29,999"],
  ["B19001_007E", "$30,000–$34,999"],
  ["B19001_008E", "$35,000–$39,999"],
  ["B19001_009E", "$40,000–$44,999"],
  ["B19001_010E", "$45,000–$49,999"],
  ["B19001_011E", "$50,000–$59,999"],
  ["B19001_012E", "$60,000–$74,999"],
  ["B19001_013E", "$75,000–$99,999"],
  ["B19001_014E", "$100,000–$124,999"],
  ["B19001_015E", "$125,000–$149,999"],
  ["B19001_016E", "$150,000–$199,999"],
  ["B19001_017E", "$200,000+"],
];

// Age brackets → male B01001 suffixes (female = suffix + 24).
const AGE_BRACKETS: { label: string; m: number[] }[] = [
  { label: "Under 18", m: [3, 4, 5, 6] },
  { label: "18–24", m: [7, 8, 9, 10] },
  { label: "25–34", m: [11, 12] },
  { label: "35–44", m: [13, 14] },
  { label: "45–54", m: [15, 16] },
  { label: "55–64", m: [17, 18, 19] },
  { label: "65–74", m: [20, 21, 22] },
  { label: "75+", m: [23, 24, 25] },
];
const ageVar = (n: number) => `B01001_${String(n).padStart(3, "0")}E`;

// Education B15003 → aggregated brackets.
const EDU_BRACKETS: { label: string; codes: number[] }[] = [
  { label: "No high-school diploma", codes: range(2, 16) },
  { label: "High-school graduate", codes: [17, 18] },
  { label: "Some college", codes: [19, 20] },
  { label: "Associate's degree", codes: [21] },
  { label: "Bachelor's degree", codes: [22] },
  { label: "Graduate / Professional", codes: [23, 24, 25] },
];
const eduVar = (n: number) => `B15003_${String(n).padStart(3, "0")}E`;
function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const n0 = (x: number) => Math.round(x).toLocaleString("en-US");
const usd = (x: number) => `$${Math.round(x).toLocaleString("en-US")}`;
const pct = (part: number, whole: number) =>
  whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "—";

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function fetchDemographicsReport(
  address: string,
  minutes?: number,
): Promise<DemographicsReport> {
  const key = process.env.CENSUS_API_KEY;
  if (!key) {
    return { ok: false, error: "CENSUS_API_KEY is not configured on the server." };
  }

  const loc = await geocodeRobust(address);
  if (!loc || !loc.state || !loc.county) {
    return { ok: false, error: "Couldn't find that address. Check the spelling and try again." };
  }
  const fips = { state: loc.state, county: loc.county };

  const ta = await getTradeArea(loc.lat, loc.lng, minutes ? { minutes } : {});
  const weights = ta.weights;
  const geoids = Object.keys(weights);
  if (geoids.length === 0) {
    return { ok: false, error: "No Census block groups found near that address." };
  }
  const tradeAreaLabel =
    ta.mode === "drivetime" ? `${ta.minutes}-min drive-time` : `${ta.radiusMi}-mi ring`;

  // Three batched ACS calls + jobs + growth, in parallel.
  const summaryVars = [
    "B01003_001E", "B01001_002E", "B01001_026E", "B01002_001E",
    "B11001_001E", "B25010_001E",
    "B19013_001E", "B19025_001E", "B19301_001E",
    "B23025_001E", "B23025_002E", "B23025_004E", "B23025_005E", "B23025_007E",
    "B25001_001E", "B25002_002E", "B25002_003E", "B25003_002E", "B25003_003E",
    "B25044_001E",
    "B25044_003E", "B25044_004E", "B25044_005E", "B25044_006E", "B25044_007E", "B25044_008E",
    "B25044_010E", "B25044_011E", "B25044_012E", "B25044_013E", "B25044_014E", "B25044_015E",
    ...INCOME_BRACKETS.map(([v]) => v),
  ];
  const ageVars = AGE_BRACKETS.flatMap((b) => b.m).flatMap((n) => [ageVar(n), ageVar(n + 24)]);
  const eduVars = ["B15003_001E", ...EDU_BRACKETS.flatMap((b) => b.codes.map(eduVar))];

  const [summary, age, edu, jobs, growth] = await Promise.all([
    acsRing(fips.state, fips.county, summaryVars, weights, key),
    acsRing(fips.state, fips.county, ageVars, weights, key),
    acsRing(fips.state, fips.county, eduVars, weights, key),
    getRingJobs(fips.state, weights),
    countyGrowth(fips.state, fips.county, key),
  ]);

  if (summary.length === 0) {
    return { ok: false, error: "Census demographics weren't available for that area." };
  }

  const pop = sum(summary, "B01003_001E");
  const male = sum(summary, "B01001_002E");
  const female = sum(summary, "B01001_026E");
  const households = sum(summary, "B11001_001E");
  const medianAge = weightedAvg(summary, "B01002_001E", "B01003_001E");
  const avgHhSize = weightedAvg(summary, "B25010_001E", "B11001_001E");
  const medianIncome = weightedAvg(summary, "B19013_001E", "B11001_001E");
  const aggIncome = sum(summary, "B19025_001E");
  const perCapita = weightedAvg(summary, "B19301_001E", "B01003_001E");
  const employed = sum(summary, "B23025_004E");
  const daytime =
    jobs != null && employed > 0 ? Math.max(0, Math.round(pop + jobs - employed)) : null;

  const sections: DemoSection[] = [];

  // Population
  const popRows: DemoRow[] = [
    { label: "Total Population", value: n0(pop) },
    { label: "Male", value: n0(male), pct: pct(male, pop) },
    { label: "Female", value: n0(female), pct: pct(female, pop) },
    { label: "Median Age", value: medianAge ? medianAge.toFixed(1) : "—" },
    { label: "Population Density (per sq mi)", value: ta.areaSqMi > 0 ? n0(pop / ta.areaSqMi) : "—" },
  ];
  if (daytime != null) popRows.push({ label: "Daytime Population", value: n0(daytime) });
  if (growth != null) popRows.push({ label: "Projected Growth (annualized)", value: `${growth.toFixed(2)}%` });
  sections.push({ title: "Population", rows: popRows });

  // Households
  sections.push({
    title: "Households",
    rows: [
      { label: "Total Households", value: n0(households) },
      { label: "Average Household Size", value: avgHhSize ? avgHhSize.toFixed(2) : "—" },
    ],
  });

  // Age
  sections.push({
    title: "Population by Age",
    rows: AGE_BRACKETS.map((b) => {
      const c = b.m.reduce((a, m) => a + sum(age, ageVar(m)) + sum(age, ageVar(m + 24)), 0);
      return { label: b.label, value: n0(c), pct: pct(c, pop) };
    }),
  });

  // Income
  sections.push({
    title: "Households by Income",
    rows: [
      { label: "Mean Household Income", value: households > 0 ? usd(aggIncome / households) : "—" },
      { label: "Median Household Income", value: usd(medianIncome) },
      { label: "Per Capita Income", value: usd(perCapita) },
      ...INCOME_BRACKETS.map(([v, label]) => {
        const c = sum(summary, v);
        return { label, value: n0(c), pct: pct(c, households) };
      }),
    ],
  });

  // Employment
  const total16 = sum(summary, "B23025_001E");
  const inLabor = sum(summary, "B23025_002E");
  const unemployed = sum(summary, "B23025_005E");
  const notInLabor = sum(summary, "B23025_007E");
  sections.push({
    title: "Employment",
    rows: [
      { label: "Population 16+", value: n0(total16) },
      { label: "In Labor Force", value: n0(inLabor), pct: pct(inLabor, total16) },
      { label: "Employed", value: n0(employed), pct: pct(employed, total16) },
      { label: "Unemployed", value: n0(unemployed), pct: pct(unemployed, total16) },
      { label: "Not in Labor Force", value: n0(notInLabor), pct: pct(notInLabor, total16) },
    ],
  });

  // Housing
  const units = sum(summary, "B25001_001E");
  const occupied = sum(summary, "B25002_002E");
  const vacant = sum(summary, "B25002_003E");
  const owner = sum(summary, "B25003_002E");
  const renter = sum(summary, "B25003_003E");
  sections.push({
    title: "Housing Units",
    rows: [
      { label: "Total Housing Units", value: n0(units) },
      { label: "Occupied", value: n0(occupied), pct: pct(occupied, units) },
      { label: "Vacant", value: n0(vacant), pct: pct(vacant, units) },
      { label: "Owner-Occupied", value: n0(owner), pct: pct(owner, occupied) },
      { label: "Renter-Occupied", value: n0(renter), pct: pct(renter, occupied) },
    ],
  });

  // Vehicles available (owner + renter, by count)
  const veh = (ownerVar: string, renterVar: string) =>
    sum(summary, ownerVar) + sum(summary, renterVar);
  const vehBase = sum(summary, "B25044_001E");
  sections.push({
    title: "Vehicles Available",
    rows: [
      ["No Vehicle", "B25044_003E", "B25044_010E"],
      ["1 Vehicle", "B25044_004E", "B25044_011E"],
      ["2 Vehicles", "B25044_005E", "B25044_012E"],
      ["3 Vehicles", "B25044_006E", "B25044_013E"],
      ["4 Vehicles", "B25044_007E", "B25044_014E"],
      ["5+ Vehicles", "B25044_008E", "B25044_015E"],
    ].map(([label, o, r]) => {
      const c = veh(o, r);
      return { label, value: n0(c), pct: pct(c, vehBase) };
    }),
  });

  // Education (25+)
  const eduBase = sum(edu, "B15003_001E");
  sections.push({
    title: "Education (Age 25+)",
    rows: EDU_BRACKETS.map((b) => {
      const c = b.codes.reduce((a, code) => a + sum(edu, eduVar(code)), 0);
      return { label: b.label, value: n0(c), pct: pct(c, eduBase) };
    }),
  });

  return {
    ok: true,
    matchedAddress: loc.matchedAddress,
    lat: loc.lat,
    lng: loc.lng,
    bgCount: geoids.length,
    tradeArea: tradeAreaLabel,
    sections,
  };
}
