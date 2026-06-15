import type { Variant } from "@/lib/scorecard/modwash";

/**
 * Rough snow-days-per-year estimate from latitude (eastern US). A real version
 * would hit NOAA climate normals for the nearest station — this is a defensible
 * first pass so the field isn't left blank.
 */
export function estimateSnowDays(lat: number): number {
  if (lat >= 44) return 30;
  if (lat >= 41) return 18;
  if (lat >= 38) return 10;
  if (lat >= 35) return 3;
  return 0;
}

/** Suggest the scorecard variant: northern markets (snow) vs southern. */
export function suggestVariant(lat: number): Variant {
  return lat >= 37 ? "northern" : "southern";
}
