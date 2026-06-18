"use client";

import { useEffect } from "react";
import { APIProvider, Map, Marker, useMap } from "@vis.gl/react-google-maps";

const CTA_COLOR = "#eab308"; // amber, like the reference CTA shapes

function pin(fill: string, label: string, w: number): string {
  const h = Math.round((w * 44) / 34);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 34 44">` +
    `<path d="M17 0C7.6 0 0 7.6 0 17c0 12.5 17 27 17 27s17-14.5 17-27C34 7.6 26.4 0 17 0z" fill="${fill}" stroke="white" stroke-width="2.5"/>` +
    `<text x="17" y="22" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="white">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
const SITE_PIN = pin("#ff008c", "★", 42);
const ANCHOR_PIN = pin("#1d4ed8", "A", 34);

/** Draws the trade-area (CTA) polygon and frames it. */
function PolygonLayer({ polygon }: { polygon: number[][] }) {
  const map = useMap("cta");
  useEffect(() => {
    if (!map || polygon.length < 3) return;
    const path = polygon.map(([lng, lat]) => ({ lat, lng }));
    const poly = new google.maps.Polygon({
      map,
      paths: path,
      strokeColor: CTA_COLOR,
      strokeOpacity: 1,
      strokeWeight: 3,
      fillColor: CTA_COLOR,
      fillOpacity: 0.12,
      clickable: false,
    });
    const b = new google.maps.LatLngBounds();
    path.forEach((p) => b.extend(p));
    map.fitBounds(b, 30);
    return () => poly.setMap(null);
  }, [map, polygon]);
  return null;
}

export function CtaMap({
  polygon,
  site,
  anchor,
}: {
  polygon: number[][];
  site: { lat: number; lng: number };
  anchor?: { lat: number; lng: number; brand: string } | null;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return (
      <div className="flex h-[380px] items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
        Map key not set (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).
      </div>
    );
  }
  return (
    <div className="h-[380px] overflow-hidden rounded-lg border border-slate-200">
      <APIProvider apiKey={apiKey}>
        <Map
          id="cta"
          defaultCenter={{ lat: site.lat, lng: site.lng }}
          defaultZoom={11}
          gestureHandling="cooperative"
          clickableIcons={false}
          mapTypeControl={false}
          style={{ width: "100%", height: "100%" }}
        >
          {anchor && (
            <Marker
              position={{ lat: anchor.lat, lng: anchor.lng }}
              icon={ANCHOR_PIN}
              title={`Anchor: ${anchor.brand}`}
              zIndex={50}
            />
          )}
          <Marker
            position={{ lat: site.lat, lng: site.lng }}
            icon={SITE_PIN}
            title="Proposed site"
            zIndex={100}
          />
          <PolygonLayer polygon={polygon} />
        </Map>
      </APIProvider>
    </div>
  );
}
