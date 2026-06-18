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
