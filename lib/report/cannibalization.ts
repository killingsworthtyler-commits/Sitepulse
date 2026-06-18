// Cannibalization: how much a candidate site's 20K ring overlaps the rings of
// our EXISTING ModWash stores. Two equal-radius rings overlap when their centers
// are within 2× the radius; the lens area / ring area is the overlap fraction.

import { getOperationalSites } from "@/lib/prospect/locations";

export interface CannibalStore {
  code: string;
  name: string;
  city: string;
  state: string;
  distMi: number;
  /** % of the candidate's trade-area ring that overlaps this store's ring. */
  overlapPct: number;
}

function distMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
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

/** Overlap area of two equal circles (radius r, centers d apart) ÷ circle area. */
function overlapFraction(d: number, r: number): number {
  if (d >= 2 * r) return 0;
  if (d <= 0) return 1;
  const lens =
    2 * r * r * Math.acos(d / (2 * r)) - (d / 2) * Math.sqrt(4 * r * r - d * d);
  return lens / (Math.PI * r * r);
}

/** Existing ModWash stores whose ring overlaps the candidate's ring, worst first. */
export function findCannibalization(
  lat: number,
  lng: number,
  ringRadiusM: number,
): CannibalStore[] {
  const out: CannibalStore[] = [];
  for (const s of getOperationalSites()) {
    const d = distMeters(lat, lng, s.lat, s.lng);
    if (d >= 2 * ringRadiusM) continue;
    out.push({
      code: s.code,
      name: s.name,
      city: s.city,
      state: s.state,
      distMi: Math.round((d / 1609.34) * 100) / 100,
      overlapPct: Math.round(overlapFraction(d, ringRadiusM) * 100),
    });
  }
  out.sort((a, b) => b.overlapPct - a.overlapPct);
  return out;
}
