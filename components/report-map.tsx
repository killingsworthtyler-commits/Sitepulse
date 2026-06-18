"use client";

import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";
import type { Competitor } from "@/lib/autofill/places";

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

const SITE_PIN = pin("#ff008c", "★", 48);
const COMP_PIN = pin("#ef4444", "", 32);

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
      <div className="flex h-[440px] items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
        Map key not set (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).
      </div>
    );
  }
  return (
    <div className="h-[440px] overflow-hidden rounded-lg border border-slate-200">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={{ lat: site.lat, lng: site.lng }}
          defaultZoom={13}
          gestureHandling="cooperative"
          clickableIcons={false}
          mapTypeControl
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
        </Map>
      </APIProvider>
    </div>
  );
}
