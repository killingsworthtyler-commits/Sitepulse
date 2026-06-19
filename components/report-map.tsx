"use client";

import { useEffect } from "react";
import { APIProvider, Map, Marker, useMap } from "@vis.gl/react-google-maps";

const SITE_COLOR = "#ff008c";
const COMP_COLOR = "#ef4444";
const TA_COLOR = "#6366f1"; // indigo trade-area blob, like GrowthFactor's

export interface RingedComp {
  name: string;
  lat: number;
  lng: number;
  n: number;
}
export interface StorePoint {
  name: string;
  lat: number;
  lng: number;
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
const STORE_PIN = pin("#0284c7", "M", 30); // existing ModWash store
const OTHER_DOT =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">` +
      `<circle cx="8" cy="8" r="5.5" fill="#f87171" stroke="white" stroke-width="2"/></svg>`,
  );

/** Draws the filled trade-area polygon and frames the map around everything. */
function TradeAreaLayer({
  site,
  polygon,
  points,
}: {
  site: { lat: number; lng: number };
  polygon?: number[][];
  points: { lat: number; lng: number }[];
}) {
  const map = useMap("report");
  useEffect(() => {
    if (!map) return;
    let poly: google.maps.Polygon | null = null;
    if (polygon && polygon.length >= 3) {
      poly = new google.maps.Polygon({
        map,
        paths: polygon.map(([lng, lat]) => ({ lat, lng })),
        strokeColor: TA_COLOR,
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: TA_COLOR,
        fillOpacity: 0.12,
        clickable: false,
        zIndex: 1,
      });
    }
    const bounds = new google.maps.LatLngBounds();
    (polygon ?? []).forEach(([lng, lat]) => bounds.extend({ lat, lng }));
    bounds.extend(site);
    points.forEach((p) => bounds.extend(p));
    if (!bounds.isEmpty()) map.fitBounds(bounds, 40);
    return () => {
      if (poly) poly.setMap(null);
    };
  }, [map, polygon, site, points]);
  return null;
}

export function ReportMap({
  site,
  ringed,
  others,
  stores = [],
  tradeAreaPolygon,
}: {
  site: { lat: number; lng: number; label: string };
  ringed: RingedComp[];
  others: { name: string; lat: number; lng: number }[];
  /** Existing ModWash stores near the site (the "M" markers). */
  stores?: StorePoint[];
  /** The trade-area boundary [[lng,lat], …] to fill. */
  tradeAreaPolygon?: number[][];
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return (
      <div className="flex h-[460px] items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
        Map key not set (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).
      </div>
    );
  }
  const points = [...ringed, ...others, ...stores].map((p) => ({ lat: p.lat, lng: p.lng }));
  return (
    <div className="h-[460px] overflow-hidden rounded-lg border border-slate-200">
      <APIProvider apiKey={apiKey}>
        <Map
          id="report"
          defaultCenter={{ lat: site.lat, lng: site.lng }}
          defaultZoom={11}
          gestureHandling="cooperative"
          clickableIcons={false}
          mapTypeControl={false}
          style={{ width: "100%", height: "100%" }}
        >
          {stores.map((s, i) => (
            <Marker
              key={`s-${s.lat}-${s.lng}-${i}`}
              position={{ lat: s.lat, lng: s.lng }}
              icon={STORE_PIN}
              title={`ModWash: ${s.name}`}
              zIndex={20}
            />
          ))}
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
          <TradeAreaLayer site={site} polygon={tradeAreaPolygon} points={points} />
        </Map>
      </APIProvider>
    </div>
  );
}
