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

/** Census tract GEOIDs whose geometry falls within `meters` of the point. Free. */
export async function ringTractGeoids(
  lat: number,
  lng: number,
  meters: number,
): Promise<string[]> {
  const geometry = encodeURIComponent(
    JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
  );
  const url =
    "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/8/query" +
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
  medianIncome: number;
  tractCount: number;
}

/**
 * Aggregate ACS 5-year demographics across a set of tract GEOIDs (a radius ring):
 * sum population, population-weight median household income. Needs a free key.
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
    "?get=B01003_001E,B19013_001E" +
    `&for=tract:*&in=state:${state}%20county:${county}&key=${key}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const rows: string[][] = await res.json();
    const header = rows[0];
    const iPop = header.indexOf("B01003_001E");
    const iInc = header.indexOf("B19013_001E");
    const iState = header.indexOf("state");
    const iCounty = header.indexOf("county");
    const iTract = header.indexOf("tract");

    const want = new Set(geoids);
    let population = 0;
    let incWeighted = 0;
    let incPop = 0;
    let tractCount = 0;

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const geoid = `${r[iState]}${r[iCounty]}${r[iTract]}`;
      if (!want.has(geoid)) continue;
      tractCount++;
      const pop = Number(r[iPop]);
      const inc = Number(r[iInc]);
      if (pop > 0) {
        population += pop;
        if (inc > 0) {
          incWeighted += inc * pop;
          incPop += pop;
        }
      }
    }

    if (population === 0) return null;
    return {
      population,
      medianIncome: incPop > 0 ? Math.round(incWeighted / incPop) : 0,
      tractCount,
    };
  } catch {
    return null;
  }
}
