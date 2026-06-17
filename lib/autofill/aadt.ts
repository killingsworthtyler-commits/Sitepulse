// Traffic counts (AADT) from FHWA's national Highway Performance Monitoring
// System, published as a public ArcGIS feature layer (no key, no billing).
//
// A car wash scores on the traffic of the road it fronts, so we take the highest
// AADT among the road segments within a small buffer of the site — that's the
// frontage road — and return it with the route name + survey year so it can be
// sanity-checked. Counts are the latest national HPMS release (~2-3 yr lag).

const HPMS_QUERY =
  "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/hpms_v2_view/FeatureServer/0/query";

export interface AadtResult {
  aadt: number;
  /** Road the count is on, when HPMS names it (e.g. "US-29"). */
  routeName: string | null;
  /** HPMS survey year. */
  year: number | null;
}

interface HpmsAttrs {
  AADT?: number;
  ROUTE_NAME?: string | null;
  ROUTE_NUMBER?: string | number | null;
  Year_Record?: number | null;
}

/** Highest AADT on a road within `meters` of the point (the frontage road).
    Returns null on failure or when no nearby segment carries a count. Free, no key. */
export async function nearestAadt(
  lat: number,
  lng: number,
  meters = 250,
): Promise<AadtResult | null> {
  const geometry = JSON.stringify({
    x: lng,
    y: lat,
    spatialReference: { wkid: 4326 },
  });
  const params = new URLSearchParams({
    geometry,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    distance: String(meters),
    units: "esriSRUnit_Meter",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "AADT,ROUTE_NAME,ROUTE_NUMBER,Year_Record",
    orderByFields: "AADT DESC",
    returnGeometry: "false",
    resultRecordCount: "12",
    f: "json",
  });

  try {
    const res = await fetch(`${HPMS_QUERY}?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();

    // Pick the max-AADT segment ourselves, so we don't depend on the service
    // honoring orderByFields.
    let best: HpmsAttrs | null = null;
    for (const f of data?.features ?? []) {
      const a: HpmsAttrs = f?.attributes ?? {};
      if ((a.AADT ?? 0) > 0 && (!best || a.AADT! > best.AADT!)) best = a;
    }
    if (!best) return null;

    const routeName =
      best.ROUTE_NAME ??
      (best.ROUTE_NUMBER ? `Route ${best.ROUTE_NUMBER}` : null);

    return {
      aadt: Math.round(best.AADT!),
      routeName,
      year: best.Year_Record ?? null,
    };
  } catch {
    return null;
  }
}
