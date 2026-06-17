// The known ModWash sites, geocoded for the map. Addresses live in the scorecard
// data; we geocode them once (free Census geocoder) and memoize for the server's
// lifetime so the map loads instantly on repeat visits.

import { geocode } from "@/lib/autofill/census";
import { getModwashSites } from "@/lib/scorecard/modwash-sites";
import type { Grade } from "@/lib/scorecard/modwash";

export interface MappedSite {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  /** Full scorecard result for the site. */
  percent: number;
  grade: Grade;
}

let cache: Promise<MappedSite[]> | null = null;

export function getProspectSites(): Promise<MappedSite[]> {
  if (!cache) cache = load();
  return cache;
}

async function load(): Promise<MappedSite[]> {
  const sites = getModwashSites();
  const mapped = await Promise.all(
    sites.map(async (s): Promise<MappedSite | null> => {
      const geo = await geocode(`${s.address}, ${s.city}, ${s.state}`);
      if (!geo) return null;
      return {
        id: s.id,
        name: s.name,
        address: s.address,
        city: s.city,
        state: s.state,
        lat: geo.lat,
        lng: geo.lng,
        percent: s.result.percent,
        grade: s.result.grade,
      };
    }),
  );
  return mapped.filter(Boolean) as MappedSite[];
}
