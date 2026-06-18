// Deal type is shared across the report, the scorecard auto-fill, and the AI
// reasoning, so it lives here (a leaf module) to avoid import cycles.

/** Are we evaluating a greenfield build or the purchase of an existing wash? */
export type DealType = "build" | "acquisition";

/** A wash within this distance of the address IS the site, not a neighbor — for
    an acquisition it's the asset being bought, so it must not count as competition. */
export const ONSITE_M = 200; // ~0.12 mi

/** Great-circle distance in meters. */
export function metersBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
