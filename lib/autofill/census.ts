// US Census integrations — all free. Geocoding + TIGERweb spatial queries need no
// key; the ACS data API needs a free key (no billing). We degrade gracefully when
// the key is absent.

export interface GeoResult {
  matchedAddress: string;
  lat: number;
  lng: number;
  state: string; // FIPS, e.g. "45"
  county: string; // FIPS, e.g. "083"
  tract?: string;
}

/** Geocode a one-line address → coordinates + FIPS geographies. Free, no key. */
export async function geocode(address: string): Promise<GeoResult | null> {
  const url =
    "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress" +
    `?address=${encodeURIComponent(address)}` +
    "&benchmark=Public_AR_Current&vintage=Current_Current&format=json";

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const m = data?.result?.addressMatches?.[0];
    if (!m) return null;

    const g = m.geographies ?? {};
    const county = g["Counties"]?.[0];
    const tract = g["Census Tracts"]?.[0];

    return {
      matchedAddress: m.matchedAddress,
      lat: m.coordinates.y,
      lng: m.coordinates.x,
      state: county?.STATE ?? tract?.STATE,
      county: county?.COUNTY ?? tract?.COUNTY,
      tract: tract?.TRACT,
    };
  } catch {
    return null;
  }
}

/** OSM Nominatim geocode — a free fallback for addresses the Census geocoder
    can't match (highway-style addresses like "US-441" are common for sites). */
async function geocodeOSM(
  address: string,
): Promise<{ lat: number; lng: number; matched: string } | null> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=" +
    encodeURIComponent(address);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SitePulse/1.0 (Hutton site scoring)" },
    });
    if (!res.ok) return null;
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return {
      lat: Number(arr[0].lat),
      lng: Number(arr[0].lon),
      matched: arr[0].display_name ?? address,
    };
  } catch {
    return null;
  }
}

/** Google Places text search — precise geocoding for addresses Census can't
    match (e.g. highway addresses). Uses the Places key we already have. */
async function geocodeGoogle(
  address: string,
): Promise<{ lat: number; lng: number; matched: string } | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.location,places.formattedAddress",
      },
      body: JSON.stringify({ textQuery: address, maxResultCount: 1 }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const p = data?.places?.[0];
    if (!p?.location) return null;
    return {
      lat: p.location.latitude,
      lng: p.location.longitude,
      matched: p.formattedAddress ?? address,
    };
  } catch {
    return null;
  }
}

/** Geocode robustly: Census first (precise + FIPS), then Google (precise), then
    OSM — with reverse-FIPS for the latter two. Returns the GeoResult or null. */
export async function geocodeRobust(address: string): Promise<GeoResult | null> {
  const c = await geocode(address);
  if (c && c.state && c.county) return c;

  const alt = (await geocodeGoogle(address)) ?? (await geocodeOSM(address));
  if (!alt) return null;
  const fips = await geocodeCoords(alt.lat, alt.lng);
  if (!fips) return null;
  return {
    matchedAddress: alt.matched,
    lat: alt.lat,
    lng: alt.lng,
    state: fips.state,
    county: fips.county,
  };
}

/** Reverse-geocode coordinates → FIPS state + county (no address needed). Free.
    Used by site prospecting, where we start from a map point, not an address. */
export async function geocodeCoords(
  lat: number,
  lng: number,
): Promise<{ state: string; county: string } | null> {
  const url =
    "https://geocoding.geo.census.gov/geocoder/geographies/coordinates" +
    `?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const county = data?.result?.geographies?.["Counties"]?.[0];
    if (!county?.STATE || !county?.COUNTY) return null;
    return { state: county.STATE, county: county.COUNTY };
  } catch {
    return null;
  }
}

/** Census block-group GEOIDs (12-digit) within `meters` of the point. Free.
    Block groups hug a radius ring far better than whole tracts. */
export async function ringBlockGroupGeoids(
  lat: number,
  lng: number,
  meters: number,
): Promise<string[]> {
  const geometry = encodeURIComponent(
    JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
  );
  const url =
    "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/10/query" +
    `?geometry=${geometry}&geometryType=esriGeometryPoint&inSR=4326` +
    `&distance=${meters}&units=esriSRUnit_Meter` +
    "&spatialRel=esriSpatialRelIntersects&outFields=GEOID&returnGeometry=false&f=json";

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features ?? [])
      .map((f: { attributes?: { GEOID?: string } }) => f.attributes?.GEOID)
      .filter(Boolean) as string[];
  } catch {
    return [];
  }
}

export interface RingDemographics {
  population: number;
  /** Household-weighted median household income. */
  medianIncome: number;
  /** Employed residents (ACS B23025_004E) — used for the daytime estimate. */
  employedResidents: number;
  bgCount: number;
}

/**
 * Aggregate ACS 5-year demographics over the trade-area block groups,
 * apportioned by each block group's weight (geoid → area fraction). A plain
 * string[] is treated as full weight. Needs key.
 */
export async function ringDemographics(
  state: string,
  county: string,
  bgs: string[] | Record<string, number>,
  key: string | undefined,
  year = 2023,
): Promise<RingDemographics | null> {
  const weights: Record<string, number> = Array.isArray(bgs)
    ? Object.fromEntries(bgs.map((g) => [g, 1]))
    : bgs;
  if (!key || Object.keys(weights).length === 0) return null;

  const url =
    `https://api.census.gov/data/${year}/acs/acs5` +
    "?get=B01003_001E,B19013_001E,B11001_001E,B23025_004E" +
    `&for=block%20group:*&in=state:${state}%20county:${county}&key=${key}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const rows: string[][] = await res.json();
    const header = rows[0];
    const iPop = header.indexOf("B01003_001E");
    const iInc = header.indexOf("B19013_001E");
    const iHH = header.indexOf("B11001_001E");
    const iEmp = header.indexOf("B23025_004E");
    const iState = header.indexOf("state");
    const iCounty = header.indexOf("county");
    const iTract = header.indexOf("tract");
    const iBg = header.indexOf("block group");

    let population = 0;
    let employedResidents = 0;
    let incWeighted = 0;
    let households = 0;
    let bgCount = 0;

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const geoid = `${r[iState]}${r[iCounty]}${r[iTract]}${r[iBg]}`;
      const w = weights[geoid];
      if (!w) continue;
      bgCount++;
      const pop = Number(r[iPop]);
      const inc = Number(r[iInc]);
      const hh = Number(r[iHH]);
      const emp = Number(r[iEmp]);
      if (pop > 0) population += pop * w;
      if (emp > 0) employedResidents += emp * w;
      if (inc > 0 && hh > 0) {
        incWeighted += inc * hh * w;
        households += hh * w;
      }
    }

    if (population === 0) return null;
    return {
      population: Math.round(population),
      medianIncome: households > 0 ? Math.round(incWeighted / households) : 0,
      employedResidents: Math.round(employedResidents),
      bgCount,
    };
  } catch {
    return null;
  }
}

/** Annualized population growth (%/yr) for the county over a 5-year ACS window.
    County geography is stable across vintages, so this is a clean trend proxy. */
export async function countyGrowth(
  state: string,
  county: string,
  key: string | undefined,
  y0 = 2018,
  y1 = 2023,
): Promise<number | null> {
  if (!key) return null;
  const popFor = async (year: number): Promise<number | null> => {
    const url =
      `https://api.census.gov/data/${year}/acs/acs5` +
      `?get=B01003_001E&for=county:${county}&in=state:${state}&key=${key}`;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data: string[][] = await res.json();
      return Number(data[1][0]);
    } catch {
      return null;
    }
  };
  const p0 = await popFor(y0);
  const p1 = await popFor(y1);
  if (!p0 || !p1 || p0 <= 0) return null;
  return (Math.pow(p1 / p0, 1 / (y1 - y0)) - 1) * 100;
}
