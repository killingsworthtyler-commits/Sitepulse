// Trade area = the geography we aggregate demographics over. Two modes:
//  - DRIVE-TIME (accurate): an OpenRouteService isochrone (e.g. 7-min drive),
//    then the Census block groups whose CENTROID falls inside that polygon.
//    This matches how Experian/Placer define a custom trade area.
//  - RING (fallback): block groups whose centroid is within N miles — already
//    more accurate than counting every block group that *touches* a circle.
// Either way we return the block-group GEOIDs (+ centroids) so the demographic
// aggregation downstream is unchanged.

const TIGER_BG =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/10/query";
const ORS_ISO = "https://api.openrouteservice.org/v2/isochrones/driving-car";

export interface BGCentroid {
  geoid: string;
  lat: number;
  lng: number;
}

export interface TradeArea {
  geoids: string[];
  centroids: BGCentroid[];
  areaSqMi: number;
  mode: "drivetime" | "ring";
  /** Drive minutes (drivetime mode). */
  minutes?: number;
  /** Radius miles (ring mode). */
  radiusMi?: number;
}

// ---------------------------------------------------------------------------
// Geometry helpers
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
  const miPerDegLat = 69.17;
  const miPerDegLng = 69.17 * Math.cos((latC * Math.PI) / 180);
  let area = 0; // shoelace in degrees
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  area = Math.abs(area) / 2;
  return area * miPerDegLat * miPerDegLng;
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

interface TigerFeature {
  attributes?: { GEOID?: string; CENTLAT?: string; CENTLON?: string };
}

function parseBGs(features: TigerFeature[]): BGCentroid[] {
  return features
    .map((f) => {
      const a = f.attributes ?? {};
      const lat = Number(a.CENTLAT);
      const lng = Number(a.CENTLON);
      if (!a.GEOID || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { geoid: a.GEOID, lat, lng };
    })
    .filter(Boolean) as BGCentroid[];
}

/** Block groups whose centroid is inside the isochrone polygon. */
async function bgsInPolygon(ring: number[][]): Promise<BGCentroid[]> {
  const params = new URLSearchParams({
    geometry: JSON.stringify({ rings: [ring], spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryPolygon",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "GEOID,CENTLAT,CENTLON",
    returnGeometry: "false",
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
    const all = parseBGs(data.features ?? []);
    // Apportion: keep block groups whose centroid is inside the drive-time area.
    return all.filter((bg) => pointInPolygon([bg.lng, bg.lat], ring));
  } catch {
    return [];
  }
}

/** Block groups whose centroid is within `meters` of the point. */
async function bgsInRadius(lat: number, lng: number, meters: number): Promise<BGCentroid[]> {
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
    const all = parseBGs(data.features ?? []);
    const R = 6371000;
    return all.filter((bg) => {
      const dLat = ((bg.lat - lat) * Math.PI) / 180;
      const dLng = ((bg.lng - lng) * Math.PI) / 180;
      const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat * Math.PI) / 180) *
          Math.cos((bg.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(s)) <= meters;
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export const DEFAULT_DRIVE_MINUTES = 7;
const FALLBACK_RADIUS_MI = 3;

/** Resolve the trade area for a point: drive-time if an ORS key is set and the
    isochrone succeeds, else a centroid radius ring. */
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
      const centroids = await bgsInPolygon(ring);
      if (centroids.length > 0) {
        return {
          geoids: centroids.map((c) => c.geoid),
          centroids,
          areaSqMi: ringAreaSqMi(ring),
          mode: "drivetime",
          minutes,
        };
      }
    }
  }

  const radiusMi = opts.radiusMi ?? FALLBACK_RADIUS_MI;
  const centroids = await bgsInRadius(lat, lng, radiusMi * 1609.34);
  return {
    geoids: centroids.map((c) => c.geoid),
    centroids,
    areaSqMi: Math.PI * radiusMi * radiusMi,
    mode: "ring",
    radiusMi,
  };
}
