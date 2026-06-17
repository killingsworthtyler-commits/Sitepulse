// ModWash operational sites — the real store footprint, geocoded once into
// modwash-locations.json (see scripts/geocode-locations.mjs). These are the
// reference layer on the Site Finder map: pan to one and prospect nearby.

import data from "./modwash-locations.json";

export interface OperationalSite {
  code: string;
  name: string;
  city: string;
  state: string;
  street: string;
  zip: string;
  region: number;
  district: string;
  lat: number;
  lng: number;
  /** How the coords were resolved: "census"/"osm" = street-level, "zip" = ZIP centroid (approximate). */
  geo: string;
}

export function getOperationalSites(): OperationalSite[] {
  return data as OperationalSite[];
}
