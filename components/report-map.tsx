"use client";

import { useEffect } from "react";
import { APIProvider, Map, Marker, useMap } from "@vis.gl/react-google-maps";

const SITE_COLOR = "#ff008c";
const COMP_COLOR = "#ef4444";

export interface RingedComp {
  name: string;
  lat: number;
  lng: number;
  n: number;
}

/** Teardrop pin as an SVG data-URI. */
function pin(fill: string, label: string, w: number): string {
  const h = Math.round((w * 44) / 34);
  const fs = label.length > 1 ? 13 : 15;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 34 44">` +
    `<path d="M17 0C7.6 0 0 7.6 0 17c0 12.5 17 27 17 27s17-14.5 17-27C34 7.6 26.4 0 17 0z" fill="${fill}" stroke="white" stroke-width="2.5"/>` +
    `<text x="17" y="22" text-anchor="middle" font-family="Arial,sans-serif" font-size="${fs}" font-weight="bold" fill="white">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const SITE_PIN = pin(SITE_COLOR, "★", 46);
const OTHER_DOT =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">` +
      `<circle cx="8" cy="8" r="5.5" fill="#f87171" stroke="white" stroke-width="2"/></svg>`,
  );

/** Draws the 20K-pop rings: the site plus each direct (overlapping) competitor. */
function TradeRings({
  site,
  ringed,
  radius,
}: {
  site: { lat: number; lng: number };
  ringed: RingedComp[];
  radius: number;
}) {
  const map = useMap("report");
  useEffect(() => {
    if (!map) return;
    const circles: google.maps.Circle[] = [];
    for (const c of ringed) {
      circles.push(
        new google.maps.Circle({
          map,
          center: { lat: c.lat, lng: c.lng },
          radius,
          strokeColor: COMP_COLOR,
          strokeOpacity: 0.85,
          strokeWeight: 2,
          fillColor: COMP_COLOR,
          fillOpacity: 0.05,
          clickable: false,
          zIndex: 2,
        }),
      );
    }
    circles.push(
      new google.maps.Circle({
        map,
        center: site,
        radius,
        strokeColor: SITE_COLOR,
        strokeOpacity: 1,
        strokeWeight: 3.5,
        fillColor: SITE_COLOR,
        fillOpacity: 0.05,
        clickable: false,
        zIndex: 4,
      }),
    );

    const bounds = new google.maps.LatLngBounds();
    const dLat = radius / 111320;
    const ext = (lat: number, lng: number) => {
      const dLng = radius / (111320 * Math.cos((lat * Math.PI) / 180));
      bounds.extend({ lat: lat + dLat, lng: lng + dLng });
      bounds.extend({ lat: lat - dLat, lng: lng - dLng });
    };
    ext(site.lat, site.lng);
    ringed.forEach((c) => ext(c.lat, c.lng));
    map.fitBounds(bounds, 40);

    return () => circles.forEach((c) => c.setMap(null));
  }, [map, site, ringed, radius]);

  return null;
}

export function ReportMap({
  site,
  ringed,
  others,
  ringRadiusM,
}: {
  site: { lat: number; lng: number; label: string };
  ringed: RingedComp[];
  others: { name: string; lat: number; lng: number }[];
  ringRadiusM: number;
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
          {others.map((c, i) => (
            <Marker
              key={`o-${c.lat}-${c.lng}-${i}`}
              position={{ lat: c.lat, lng: c.lng }}
              icon={OTHER_DOT}
              title={`Other wash: ${c.name}`}
              zIndex={10}
            />
          ))}
          {ringed.map((c) => (
            <Marker
              key={`r-${c.n}`}
              position={{ lat: c.lat, lng: c.lng }}
              icon={pin(COMP_COLOR, String(c.n), 32)}
              title={`${c.n}. ${c.name}`}
              zIndex={30}
            />
          ))}
          <Marker
            position={{ lat: site.lat, lng: site.lng }}
            icon={SITE_PIN}
            title={site.label}
            zIndex={100}
          />
          <TradeRings site={site} ringed={ringed} radius={ringRadiusM} />
        </Map>
      </APIProvider>
    </div>
  );
}
