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
 * Aggregate ACS 5-year demographics over a set of block-group GEOIDs (the ring):
 * sum population & employed residents, household-weight median income. Needs key.
 */
export async function ringDemographics(
  state: string,
  county: string,
  geoids: string[],
  key: string | undefined,
  year = 2023,
): Promise<RingDemographics | null> {
  if (!key || geoids.length === 0) return null;

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

    const want = new Set(geoids);
    let population = 0;
    let employedResidents = 0;
    let incWeighted = 0;
    let households = 0;
    let bgCount = 0;

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const geoid = `${r[iState]}${r[iCounty]}${r[iTract]}${r[iBg]}`;
      if (!want.has(geoid)) continue;
      bgCount++;
      const pop = Number(r[iPop]);
      const inc = Number(r[iInc]);
      const hh = Number(r[iHH]);
      const emp = Number(r[iEmp]);
      if (pop > 0) population += pop;
      if (emp > 0) employedResidents += emp;
      if (inc > 0 && hh > 0) {
        incWeighted += inc * hh;
        households += hh;
      }
    }

    if (population === 0) return null;
    return {
      population,
      medianIncome: households > 0 ? Math.round(incWeighted / households) : 0,
      employedResidents,
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
