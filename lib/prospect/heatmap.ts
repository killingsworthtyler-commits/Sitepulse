// Market-strength heatmap data. A full per-point scorecard heatmap would mean a
// billed Google Places call per cell, so instead we build a population-density
// surface from free Census block-group data: each block group becomes a weighted
// point at its centroid. That's the "where are the rooftops" market signal, at
// near-zero cost. Candidate pins (scored in full) layer on top of this.

export interface HeatPoint {
  lat: number;
  lng: number;
  /** Block-group population — the heat weight. */
  weight: number;
}

interface BgCentroid {
  geoid: string;
  lat: number;
  lng: number;
}

const TIGER_BG =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/10/query";

/** Block-group GEOIDs + centroids within `meters` of the point. Free, no key. */
async function ringCentroids(
  lat: number,
  lng: number,
  meters: number,
): Promise<BgCentroid[]> {
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
        const plat = Number(a.CENTLAT);
        const plng = Number(a.CENTLON);
        if (!a.GEOID || !Number.isFinite(plat) || !Number.isFinite(plng)) return null;
        return { geoid: a.GEOID, lat: plat, lng: plng };
      })
      .filter(Boolean) as BgCentroid[];
  } catch {
    return [];
  }
}

/** Population per block group across a whole county. One ACS call. Needs key. */
async function countyPopulation(
  state: string,
  county: string,
  key: string,
  year = 2023,
): Promise<Map<string, number>> {
  const url =
    `https://api.census.gov/data/${year}/acs/acs5` +
    `?get=B01003_001E&for=block%20group:*&in=state:${state}%20county:${county}&key=${key}`;
  const map = new Map<string, number>();
  try {
    const res = await fetch(url);
    if (!res.ok) return map;
    const rows: string[][] = await res.json();
    const h = rows[0];
    const iPop = h.indexOf("B01003_001E");
    const iSt = h.indexOf("state");
    const iCo = h.indexOf("county");
    const iTr = h.indexOf("tract");
    const iBg = h.indexOf("block group");
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const pop = Number(r[iPop]);
      if (pop > 0) map.set(`${r[iSt]}${r[iCo]}${r[iTr]}${r[iBg]}`, pop);
    }
  } catch {
    /* leave map empty */
  }
  return map;
}

/** Weighted points (block-group population) within `meters` of the center. */
export async function marketHeatmap(
  lat: number,
  lng: number,
  meters: number,
  key: string | undefined,
): Promise<HeatPoint[]> {
  if (!key) return [];
  const bgs = await ringCentroids(lat, lng, meters);
  if (bgs.length === 0) return [];

  // One ACS call per county the ring touches.
  const counties = new Map<string, { state: string; county: string }>();
  for (const bg of bgs) {
    const state = bg.geoid.slice(0, 2);
    const county = bg.geoid.slice(2, 5);
    counties.set(`${state}${county}`, { state, county });
  }
  const maps = await Promise.all(
    [...counties.values()].map((c) => countyPopulation(c.state, c.county, key)),
  );
  const popByGeoid = new Map<string, number>();
  for (const m of maps) for (const [g, p] of m) popByGeoid.set(g, p);

  return bgs
    .map((bg) => ({ lat: bg.lat, lng: bg.lng, weight: popByGeoid.get(bg.geoid) ?? 0 }))
    .filter((p) => p.weight > 0);
}
