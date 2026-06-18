// Analog footprint = a fixed 3-mile block-group ring (centroid membership).
// We compute the SAME four variables this way for the candidate AND for every
// operational store (precomputed in scripts/store-analogs.mjs), so analogs
// compare like-for-like. This is deliberately decoupled from the heavier
// drive-time report pipeline — a fixed radius is the standard footprint for
// comparable-store matching, and it's cheap + deterministic.

const TIGER_BG =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/10/query";

export const ANALOG_RADIUS_MI = 3;
const RADIUS_M = ANALOG_RADIUS_MI * 1609.34;
const AREA_SQMI = Math.PI * ANALOG_RADIUS_MI * ANALOG_RADIUS_MI;

export interface AnalogVars {
  /** Total population in the 3-mi ring. */
  population: number;
  /** Household-weighted median household income ($). */
  medianIncome: number;
  /** Population-weighted median age (years). */
  medianAge: number;
  /** People per square mile. */
  density: number;
}

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
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

interface Centroid {
  geoid: string;
  lat: number;
  lng: number;
}

/** Block-group centroids whose point is within `meters` of (lat,lng). */
async function bgCentroidsWithin(lat: number, lng: number, meters: number): Promise<Centroid[]> {
  const params = new URLSearchParams({
    geometry: JSON.stringify({ x: lng, y: lat, spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    distance: String(meters),
    units: "esriSRUnit_Meter",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "GEOID,CENTLAT,CENTLON",
    returnGeometry: "false",
    f: "json",
  });
  try {
    const res = await fetch(`${TIGER_BG}?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.features ?? []) as { attributes?: Record<string, string> }[])
      .map((f) => {
        const a = f.attributes ?? {};
        const la = Number(a.CENTLAT);
        const lo = Number(a.CENTLON);
        if (!a.GEOID || !Number.isFinite(la) || !Number.isFinite(lo)) return null;
        return { geoid: a.GEOID, lat: la, lng: lo };
      })
      .filter(Boolean) as Centroid[];
  } catch {
    return [];
  }
}

interface BgAcs {
  pop: number;
  hh: number;
  income: number;
  age: number;
}

/** Per-block-group ACS (pop, households, median income, median age) for a county. */
async function countyAcs(state: string, county: string, key: string): Promise<Map<string, BgAcs>> {
  const url =
    `https://api.census.gov/data/2023/acs/acs5?get=B01003_001E,B11001_001E,B19013_001E,B01002_001E` +
    `&for=block%20group:*&in=state:${state}%20county:${county}&key=${key}`;
  const map = new Map<string, BgAcs>();
  try {
    const res = await fetch(url);
    if (!res.ok) return map;
    const rows: string[][] = await res.json();
    const h = rows[0];
    const ip = h.indexOf("B01003_001E");
    const ihh = h.indexOf("B11001_001E");
    const iinc = h.indexOf("B19013_001E");
    const iage = h.indexOf("B01002_001E");
    const is = h.indexOf("state");
    const ic = h.indexOf("county");
    const it = h.indexOf("tract");
    const ib = h.indexOf("block group");
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      map.set(`${r[is]}${r[ic]}${r[it]}${r[ib]}`, {
        pop: Number(r[ip]) || 0,
        hh: Number(r[ihh]) || 0,
        income: Number(r[iinc]) || 0,
        age: Number(r[iage]) || 0,
      });
    }
  } catch {
    /* leave empty */
  }
  return map;
}

/** The four analog variables over the 3-mile ring around (lat,lng), or null. */
export async function analogVariables(lat: number, lng: number): Promise<AnalogVars | null> {
  const key = process.env.CENSUS_API_KEY;
  if (!key) return null;

  const cents = (await bgCentroidsWithin(lat, lng, RADIUS_M)).filter(
    (c) => haversineM(lat, lng, c.lat, c.lng) <= RADIUS_M,
  );
  if (cents.length === 0) return null;

  const counties = new Map<string, { s: string; co: string }>();
  for (const c of cents) {
    counties.set(c.geoid.slice(0, 5), { s: c.geoid.slice(0, 2), co: c.geoid.slice(2, 5) });
  }
  const maps = await Promise.all([...counties.values()].map((c) => countyAcs(c.s, c.co, key)));
  const acs = new Map<string, BgAcs>();
  for (const m of maps) for (const [g, v] of m) acs.set(g, v);

  let pop = 0;
  let hh = 0;
  let incNum = 0;
  let incDen = 0;
  let ageNum = 0;
  let ageDen = 0;
  for (const c of cents) {
    const v = acs.get(c.geoid);
    if (!v) continue;
    pop += v.pop;
    hh += v.hh;
    if (v.income > 0 && v.hh > 0) {
      incNum += v.income * v.hh;
      incDen += v.hh;
    }
    if (v.age > 0 && v.pop > 0) {
      ageNum += v.age * v.pop;
      ageDen += v.pop;
    }
  }
  if (pop <= 0) return null;

  return {
    population: Math.round(pop),
    medianIncome: incDen > 0 ? Math.round(incNum / incDen) : 0,
    medianAge: ageDen > 0 ? Math.round((ageNum / ageDen) * 10) / 10 : 0,
    density: Math.round(pop / AREA_SQMI),
  };
}
