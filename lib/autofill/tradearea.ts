// Trade area = the geography we aggregate demographics over. We return per
// block-group WEIGHTS (the fraction of each block group inside the area) so the
// demographic aggregation is apportioned, not all-or-nothing.
//
//  - DRIVE-TIME (accurate): an OpenRouteService isochrone (e.g. 7-min drive),
//    then each Census block group weighted by the share of its area inside the
//    drive polygon. This is how Experian/Placer build a custom trade area.
//  - RING (fallback, no ORS key): the same apportionment against a circle.
//
// Area share is estimated by point-sampling each block group — robust for the
// non-convex isochrone polygons and large rural block groups (where a centroid
// test would wrongly drop or keep a whole block group).

const TIGER_BG =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/10/query";
const ORS_ISO = "https://api.openrouteservice.org/v2/isochrones/driving-car";

export interface TradeArea {
  /** geoid → fraction (0–1] of that block group inside the trade area. */
  weights: Record<string, number>;
  areaSqMi: number;
  mode: "drivetime" | "ring";
  minutes?: number;
  radiusMi?: number;
}

export const DEFAULT_DRIVE_MINUTES = 7;
const FALLBACK_RADIUS_MI = 3;
const SAMPLES = 700; // points sampled per block group for the area fraction

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Ray-casting point-in-polygon. ring is [[lng,lat], …], pt is [lng,lat]. */
function pointInPolygon(pt: [number, number], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const hit =
      yi > pt[1] !== yj > pt[1] &&
      pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

/** Approximate area of a lon/lat ring in square miles. */
function ringAreaSqMi(ring: number[][]): number {
  if (ring.length < 3) return 0;
  const latC = ring.reduce((a, p) => a + p[1], 0) / ring.length;
  const miLat = 69.17;
  const miLng = 69.17 * Math.cos((latC * Math.PI) / 180);
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return (Math.abs(area) / 2) * miLat * miLng;
}

/** A circle (as a polygon ring [[lng,lat], …]) of `radiusMi` around a point. */
function circlePolygon(lat: number, lng: number, radiusMi: number, n = 48): number[][] {
  const dLat = radiusMi / 69.17;
  const dLng = radiusMi / (69.17 * Math.cos((lat * Math.PI) / 180));
  const ring: number[][] = [];
  for (let i = 0; i <= n; i++) {
    const a = (2 * Math.PI * i) / n;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return ring;
}

/** Fraction of a block group's area inside the trade-area polygon (0–1). */
function areaFraction(bgOuter: number[][], polygon: number[][]): number {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of bgOuter) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  let inBG = 0;
  let inBoth = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const x = minX + Math.random() * (maxX - minX);
    const y = minY + Math.random() * (maxY - minY);
    if (pointInPolygon([x, y], bgOuter)) {
      inBG++;
      if (pointInPolygon([x, y], polygon)) inBoth++;
    }
  }
  return inBG > 0 ? inBoth / inBG : 0;
}

// ---------------------------------------------------------------------------
// Data sources
// ---------------------------------------------------------------------------

/** OpenRouteService drive-time isochrone → outer ring [[lng,lat], …]. */
async function getIsochrone(
  lat: number,
  lng: number,
  minutes: number,
  key: string,
): Promise<number[][] | null> {
  try {
    const res = await fetch(ORS_ISO, {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify({
        locations: [[lng, lat]],
        range: [Math.round(minutes * 60)],
        range_type: "time",
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const coords = data?.features?.[0]?.geometry?.coordinates;
    if (!coords || !coords[0] || coords[0].length < 3) return null;
    return coords[0] as number[][];
  } catch {
    return null;
  }
}

interface BGGeom {
  geoid: string;
  outer: number[][];
}

/** Block groups intersecting the polygon, with their (generalized) geometry. */
async function fetchBGGeometries(polygon: number[][]): Promise<BGGeom[]> {
  const params = new URLSearchParams({
    geometry: JSON.stringify({ rings: [polygon], spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryPolygon",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "GEOID",
    returnGeometry: "true",
    geometryPrecision: "5",
    f: "json",
  });
  try {
    const res = await fetch(TIGER_BG, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.features ?? [])
      .map((f: { attributes?: { GEOID?: string }; geometry?: { rings?: number[][][] } }) => {
        const geoid = f.attributes?.GEOID;
        const outer = f.geometry?.rings?.[0];
        if (!geoid || !outer || outer.length < 3) return null;
        return { geoid, outer };
      })
      .filter(Boolean) as BGGeom[];
  } catch {
    return [];
  }
}

/** geoid → area fraction inside the polygon (keeps fractions above ~2%). */
async function bgWeights(polygon: number[][]): Promise<Record<string, number>> {
  const bgs = await fetchBGGeometries(polygon);
  const weights: Record<string, number> = {};
  for (const bg of bgs) {
    const f = areaFraction(bg.outer, polygon);
    if (f > 0.02) weights[bg.geoid] = Math.min(1, f);
  }
  return weights;
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export async function getTradeArea(
  lat: number,
  lng: number,
  opts: { minutes?: number; radiusMi?: number } = {},
): Promise<TradeArea> {
  const key = process.env.ORS_API_KEY;
  const minutes = opts.minutes ?? DEFAULT_DRIVE_MINUTES;

  if (key) {
    const ring = await getIsochrone(lat, lng, minutes, key);
    if (ring) {
      const weights = await bgWeights(ring);
      if (Object.keys(weights).length > 0) {
        return { weights, areaSqMi: ringAreaSqMi(ring), mode: "drivetime", minutes };
      }
    }
  }

  const radiusMi = opts.radiusMi ?? FALLBACK_RADIUS_MI;
  const circle = circlePolygon(lat, lng, radiusMi);
  const weights = await bgWeights(circle);
  return { weights, areaSqMi: Math.PI * radiusMi * radiusMi, mode: "ring", radiusMi };
}

// ---------------------------------------------------------------------------
// 20K-population ring radius — Hutton's competition trade area. The radius is
// sized so the Census population inside ≈ the target, so it shrinks in dense
// markets and grows in rural ones (matching the "20K Pop Ring" methodology).
// ---------------------------------------------------------------------------

const FALLBACK_RING_M = 1.44 * 1609.34;

async function bgCentroidsWithin(
  lat: number,
  lng: number,
  meters: number,
): Promise<{ geoid: string; lat: number; lng: number }[]> {
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
    return (data.features ?? [])
      .map((f: { attributes?: { GEOID?: string; CENTLAT?: string; CENTLON?: string } }) => {
        const a = f.attributes ?? {};
        const la = Number(a.CENTLAT);
        const lo = Number(a.CENTLON);
        if (!a.GEOID || !Number.isFinite(la) || !Number.isFinite(lo)) return null;
        return { geoid: a.GEOID, lat: la, lng: lo };
      })
      .filter(Boolean) as { geoid: string; lat: number; lng: number }[];
  } catch {
    return [];
  }
}

async function countyPop(state: string, county: string, key: string): Promise<Map<string, number>> {
  const url =
    `https://api.census.gov/data/2023/acs/acs5?get=B01003_001E` +
    `&for=block%20group:*&in=state:${state}%20county:${county}&key=${key}`;
  const map = new Map<string, number>();
  try {
    const res = await fetch(url);
    if (!res.ok) return map;
    const rows: string[][] = await res.json();
    const h = rows[0];
    const ip = h.indexOf("B01003_001E");
    const is = h.indexOf("state");
    const ic = h.indexOf("county");
    const it = h.indexOf("tract");
    const ib = h.indexOf("block group");
    for (let i = 1; i < rows.length; i++) {
      const p = Number(rows[i][ip]);
      if (p > 0) map.set(`${rows[i][is]}${rows[i][ic]}${rows[i][it]}${rows[i][ib]}`, p);
    }
  } catch {
    /* leave empty */
  }
  return map;
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

/** Radius (meters) of the ring whose Census population ≈ target (default 20,000). */
export async function popRingRadiusMeters(
  lat: number,
  lng: number,
  target = 20000,
): Promise<number> {
  const key = process.env.CENSUS_API_KEY;
  if (!key) return FALLBACK_RING_M;
  const cents = await bgCentroidsWithin(lat, lng, 14000);
  if (cents.length === 0) return FALLBACK_RING_M;

  const counties = new Map<string, { s: string; co: string }>();
  for (const c of cents) {
    counties.set(c.geoid.slice(0, 5), { s: c.geoid.slice(0, 2), co: c.geoid.slice(2, 5) });
  }
  const maps = await Promise.all([...counties.values()].map((c) => countyPop(c.s, c.co, key)));
  const pop = new Map<string, number>();
  for (const m of maps) for (const [g, p] of m) pop.set(g, p);

  const byDist = cents
    .map((c) => ({ d: haversineM(lat, lng, c.lat, c.lng), p: pop.get(c.geoid) ?? 0 }))
    .sort((a, b) => a.d - b.d);

  let cum = 0;
  let r = FALLBACK_RING_M;
  for (const c of byDist) {
    cum += c.p;
    if (cum >= target) {
      r = c.d || FALLBACK_RING_M;
      break;
    }
    r = Math.max(r, c.d);
  }
  return Math.min(14000, Math.max(800, r));
}
