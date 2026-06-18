"use client";

import { useEffect } from "react";
import { APIProvider, Map, Marker, useMap } from "@vis.gl/react-google-maps";
import type { Competitor } from "@/lib/autofill/places";

/** 1.44-mile "20K ring" radius (Hutton's competition trade area), in meters. */
const RING_M = 1.44 * 1609.34;
const SITE_COLOR = "#ff008c";
const COMP_COLOR = "#ef4444";

/** Teardrop pin as an SVG data-URI. */
function pin(fill: string, label: string, w: number): string {
  const h = Math.round((w * 44) / 34);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 34 44">` +
    `<path d="M17 0C7.6 0 0 7.6 0 17c0 12.5 17 27 17 27s17-14.5 17-27C34 7.6 26.4 0 17 0z" fill="${fill}" stroke="white" stroke-width="2.5"/>` +
    `<text x="17" y="23" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" font-weight="bold" fill="white">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const SITE_PIN = pin(SITE_COLOR, "★", 46);
const COMP_PIN = pin(COMP_COLOR, "", 28);

/** Draws the 1.44-mi trade-area rings: the site plus each competitor. Overlap
    between a competitor ring and the site ring = direct competition. */
function TradeRings({
  site,
  competitors,
}: {
  site: { lat: number; lng: number };
  competitors: Competitor[];
}) {
  const map = useMap("report");
  useEffect(() => {
    if (!map) return;
    const circles: google.maps.Circle[] = [];

    for (const c of competitors) {
      circles.push(
        new google.maps.Circle({
          map,
          center: { lat: c.lat, lng: c.lng },
          radius: RING_M,
          strokeColor: COMP_COLOR,
          strokeOpacity: 0.85,
          strokeWeight: 2,
          fillColor: COMP_COLOR,
          fillOpacity: 0.06,
          clickable: false,
          zIndex: 2,
        }),
      );
    }
    // Site ring on top, distinct color.
    circles.push(
      new google.maps.Circle({
        map,
        center: site,
        radius: RING_M,
        strokeColor: SITE_COLOR,
        strokeOpacity: 1,
        strokeWeight: 3.5,
        fillColor: SITE_COLOR,
        fillOpacity: 0.05,
        clickable: false,
        zIndex: 4,
      }),
    );

    // Frame all the rings.
    const bounds = new google.maps.LatLngBounds();
    const dLat = RING_M / 111320;
    const ext = (lat: number, lng: number) => {
      const dLng = RING_M / (111320 * Math.cos((lat * Math.PI) / 180));
      bounds.extend({ lat: lat + dLat, lng: lng + dLng });
      bounds.extend({ lat: lat - dLat, lng: lng - dLng });
    };
    ext(site.lat, site.lng);
    competitors.forEach((c) => ext(c.lat, c.lng));
    map.fitBounds(bounds, 40);

    return () => circles.forEach((c) => c.setMap(null));
  }, [map, site, competitors]);

  return null;
}

export function ReportMap({
  site,
  competitors,
}: {
  site: { lat: number; lng: number; label: string };
  competitors: Competitor[];
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return (
      <div className="flex h-[460px] items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
        Map key not set (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).
      </div>
    );
  }
  return (
    <div className="h-[460px] overflow-hidden rounded-lg border border-slate-200">
      <APIProvider apiKey={apiKey}>
        <Map
          id="report"
          defaultCenter={{ lat: site.lat, lng: site.lng }}
          defaultZoom={12}
          gestureHandling="cooperative"
          clickableIcons={false}
          mapTypeControl={false}
          style={{ width: "100%", height: "100%" }}
        >
          {competitors.map((c, i) => (
            <Marker
              key={`${c.lat}-${c.lng}-${i}`}
              position={{ lat: c.lat, lng: c.lng }}
              icon={COMP_PIN}
              title={`Competing wash: ${c.name}`}
              zIndex={20}
            />
          ))}
          <Marker
            position={{ lat: site.lat, lng: site.lng }}
            icon={SITE_PIN}
            title={site.label}
            zIndex={100}
          />
          <TradeRings site={site} competitors={competitors} />
        </Map>
      </APIProvider>
    </div>
  );
}
