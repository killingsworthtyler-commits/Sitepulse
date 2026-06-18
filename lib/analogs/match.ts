// Comparable-store ("analog") matching. Given the candidate's 3-mile footprint,
// score every operational ModWash store by how similar its footprint is across
// population, income, age, and density, and return the closest analogs. This is
// the desktop version of what GrowthFactor does: "your best-comparable stores."

import storesRaw from "./store-analogs.json";
import type { AnalogVars } from "./variables";

export interface AnalogStore extends AnalogVars {
  code: string;
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
}

export interface AnalogMatch extends AnalogStore {
  /** 0–100 similarity to the candidate (100 = identical footprint). */
  matchPct: number;
}

const STORES = storesRaw as AnalogStore[];

// The four variables, each scored on its own relative scale so no single
// variable (density swings widely) dominates. Equal weights.
const VARS: { key: keyof AnalogVars; weight: number }[] = [
  { key: "population", weight: 1 },
  { key: "medianIncome", weight: 1 },
  { key: "medianAge", weight: 1 },
  { key: "density", weight: 1 },
];

/** Per-variable similarity: 1 when equal, → 0 as the relative gap grows. */
function varSimilarity(a: number, b: number): number {
  if (a <= 0 && b <= 0) return 1;
  const denom = (a + b) / 2;
  if (denom <= 0) return 0;
  const relDiff = Math.abs(a - b) / denom;
  return Math.max(0, 1 - relDiff);
}

/** Closest operational-store analogs to the candidate footprint, best first. */
export function matchAnalogs(candidate: AnalogVars, topN = 6): AnalogMatch[] {
  const scored = STORES.map((s) => {
    let num = 0;
    let den = 0;
    for (const { key, weight } of VARS) {
      num += weight * varSimilarity(candidate[key], s[key]);
      den += weight;
    }
    return { ...s, matchPct: Math.round((num / den) * 100) };
  });
  scored.sort((a, b) => b.matchPct - a.matchPct);
  return scored.slice(0, topN);
}

/** How many stores are in the analog baseline (for UI copy). */
export const ANALOG_STORE_COUNT = STORES.length;
