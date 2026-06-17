"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { APIProvider, Map, Marker, useMap } from "@vis.gl/react-google-maps";
import { searchAreaAction } from "@/app/prospect/actions";
import type { Candidate, SearchAreaResult } from "@/lib/prospect/types";
import type { HeatPoint } from "@/lib/prospect/heatmap";
import type { OperationalSite } from "@/lib/prospect/locations";
import { GradeBadge } from "@/components/badges";

const GRADE_COLOR: Record<string, string> = {
  A: "#10b981",
  B: "#f59e0b",
  C: "#f43f5e",
};

/** A lettered teardrop pin (candidates), as an SVG data-URI. */
function pinUri(fill: string, label: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">` +
    `<path d="M16 0C7.2 0 0 7.2 0 16c0 11.5 16 26 16 26s16-14.5 16-26C32 7.2 24.8 0 16 0z" fill="${fill}" stroke="white" stroke-width="2"/>` +
    `<text x="16" y="21" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="white">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** A small solid dot (operational sites) — distinct from the lettered candidate pins. */
const SITE_DOT =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">` +
      `<circle cx="8" cy="8" r="6" fill="#14161b" stroke="white" stroke-width="2"/></svg>`,
  );

const fmt = (n: number) => n.toLocaleString("en-US");

export function SiteFinderMap({
  sites,
  center,
}: {
  sites: OperationalSite[];
  center: { lat: number; lng: number };
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        <p className="font-semibold">Map key not set</p>
        <p className="mt-1">
          Add <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
          (a browser key with the Maps JavaScript API enabled) to{" "}
          <code className="rounded bg-amber-100 px-1">.env.local</code> and restart
          the dev server.
        </p>
      </div>
    );
  }
  return (
    <APIProvider apiKey={apiKey}>
      <Finder sites={sites} center={center} />
    </APIProvider>
  );
}

function Finder({
  sites,
  center,
}: {
  sites: OperationalSite[];
  center: { lat: number; lng: number };
}) {
  const map = useMap("finder");
  const [result, setResult] = useState<SearchAreaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const candidates = result?.candidates ?? [];

  async function search() {
    if (!map || loading) return;
    const c = map.getCenter();
    if (!c) return;
    setLoading(true);
    setSelected(null);
    try {
      setResult(await searchAreaAction(c.lat(), c.lng()));
    } finally {
      setLoading(false);
    }
  }

  function focus(c: Candidate) {
    setSelected(c.id);
    map?.panTo({ lat: c.lat, lng: c.lng });
    if ((map?.getZoom() ?? 0) < 13) map?.setZoom(14);
  }

  const pickSite = useCallback(
    (s: OperationalSite) => {
      map?.panTo({ lat: s.lat, lng: s.lng });
      if ((map?.getZoom() ?? 0) < 12) map?.setZoom(13);
    },
    [map],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* ---------------- Map ---------------- */}
      <div className="relative h-[640px] overflow-hidden rounded-lg border border-slate-200">
        <Map
          id="finder"
          defaultCenter={center}
          defaultZoom={6}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapTypeControl
          clickableIcons={false}
          style={{ width: "100%", height: "100%" }}
        >
          <ClusteredSites sites={sites} onPick={pickSite} />
          {candidates.map((c) => (
            <Marker
              key={c.id}
              position={{ lat: c.lat, lng: c.lng }}
              icon={pinUri(GRADE_COLOR[c.grade] ?? GRADE_COLOR.C, c.grade)}
              title={`${c.name} — candidate (${c.grade}, ${Math.round(c.percent * 100)}%)`}
              onClick={() => focus(c)}
              zIndex={selected === c.id ? 100 : 40}
            />
          ))}
          <DensityLayer points={result?.heatmap ?? []} />
        </Map>

        <button
          onClick={search}
          disabled={loading}
          className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-lg ring-1 ring-black/10 transition hover:bg-ink-soft disabled:opacity-60"
        >
          {loading ? "Scanning area…" : "⌖ Search this area"}
        </button>

        <Legend hasHeat={(result?.heatmap?.length ?? 0) > 0} />
      </div>

      {/* ---------------- Side panel ---------------- */}
      <aside className="flex h-[640px] flex-col rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-4">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-ink">
            Candidates
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {result
              ? `${candidates.length} scored near this view`
              : "Pan to a market, then “Search this area.”"}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {result && !result.ok && (
            <p className="p-4 text-sm text-amber-700">{result.error}</p>
          )}
          {result?.ok && candidates.length === 0 && (
            <p className="p-4 text-sm text-slate-500">
              No retail anchors found in this view — try a more built-up area.
            </p>
          )}
          <ul className="divide-y divide-slate-100">
            {candidates.map((c, i) => (
              <li key={c.id}>
                <button
                  onClick={() => focus(c)}
                  className={`flex w-full items-start gap-3 p-3 text-left transition hover:bg-slate-50 ${
                    selected === c.id ? "bg-slate-50" : ""
                  }`}
                >
                  <span className="mt-0.5 w-4 shrink-0 text-xs font-semibold text-slate-400">
                    {i + 1}
                  </span>
                  <GradeBadge grade={c.grade} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-slate-800">
                        {c.name}
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-ink">
                        {Math.round(c.percent * 100)}%
                      </span>
                    </span>
                    <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">
                      {fmt(c.trafficCount)} vpd · {c.competition} wash
                      {c.competition === 1 ? "" : "es"} · {fmt(c.population)} pop ·
                      driver {c.trafficDriver}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <p className="border-t border-slate-100 p-3 text-[10px] leading-relaxed text-slate-400">
          Desktop score — traffic, competition & market only. Visibility,
          ingress/egress and layout need a site visit. Black pins are existing
          sites.
        </p>
      </aside>
    </div>
  );
}

/** A cluster bubble icon (count rendered via the marker label). */
function clusterIcon(count: number): google.maps.Icon {
  const r = count < 10 ? 17 : count < 50 ? 21 : 25;
  const size = r * 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<circle cx="${r}" cy="${r}" r="${r - 3}" fill="#00b3ff" fill-opacity="0.92" stroke="white" stroke-width="2.5"/>` +
    `</svg>`;
  return {
    url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(r, r),
    labelOrigin: new google.maps.Point(r, r),
  };
}

const SITE_ICON = (): google.maps.Icon => ({
  url: SITE_DOT,
  scaledSize: new google.maps.Size(14, 14),
  anchor: new google.maps.Point(7, 7),
});

/** Dependency-free marker clustering for the operational sites. Re-clusters on
    every map idle by grouping points within a pixel radius at the current zoom. */
function ClusteredSites({
  sites,
  onPick,
}: {
  sites: OperationalSite[];
  onPick?: (s: OperationalSite) => void;
}) {
  const map = useMap("finder");
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    if (!map) return;
    let raf = 0;

    const clear = () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };

    const render = () => {
      const proj = map.getProjection();
      const zoom = map.getZoom();
      if (!proj || zoom == null) return;
      clear();
      const scale = Math.pow(2, zoom);
      const RADIUS = 54; // px — merge sites closer than this on screen
      const pts = sites.map((s) => {
        const wp = proj.fromLatLngToPoint(new google.maps.LatLng(s.lat, s.lng));
        return { s, px: (wp?.x ?? 0) * scale, py: (wp?.y ?? 0) * scale, used: false };
      });

      for (let i = 0; i < pts.length; i++) {
        if (pts[i].used) continue;
        const group = [pts[i]];
        pts[i].used = true;
        for (let j = i + 1; j < pts.length; j++) {
          if (pts[j].used) continue;
          const dx = pts[i].px - pts[j].px;
          const dy = pts[i].py - pts[j].py;
          if (dx * dx + dy * dy <= RADIUS * RADIUS) {
            group.push(pts[j]);
            pts[j].used = true;
          }
        }

        if (group.length === 1) {
          const s = group[0].s;
          const m = new google.maps.Marker({
            position: { lat: s.lat, lng: s.lng },
            map,
            icon: SITE_ICON(),
            title: `${s.name} (${s.code}) — ${s.city}, ${s.state}`,
            zIndex: 20,
          });
          if (onPick) m.addListener("click", () => onPick(s));
          markersRef.current.push(m);
        } else {
          const lat = group.reduce((a, g) => a + g.s.lat, 0) / group.length;
          const lng = group.reduce((a, g) => a + g.s.lng, 0) / group.length;
          const count = group.length;
          const m = new google.maps.Marker({
            position: { lat, lng },
            map,
            icon: clusterIcon(count),
            label: { text: String(count), color: "white", fontSize: "12px", fontWeight: "700" },
            title: `${count} sites`,
            zIndex: 30,
          });
          m.addListener("click", () => {
            map.panTo({ lat, lng });
            map.setZoom(Math.min(zoom + 2, 16));
          });
          markersRef.current.push(m);
        }
      }
    };

    const onIdle = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(render);
    };
    const listener = map.addListener("idle", onIdle);
    render();
    return () => {
      listener.remove();
      cancelAnimationFrame(raf);
      clear();
    };
  }, [map, sites, onPick]);

  return null;
}

// Population-density layer. Google removed the visualization HeatmapLayer in
// Maps JS v3.65, so we build the "market strength" surface from core
// google.maps.Circle: one translucent, weight-colored circle per block group.
// Overlapping circles read as a density field — and nothing is deprecated.
function DensityLayer({ points }: { points: HeatPoint[] }) {
  const map = useMap("finder");
  const circlesRef = useRef<google.maps.Circle[]>([]);

  useEffect(() => {
    if (!map) return;
    circlesRef.current.forEach((c) => c.setMap(null));
    circlesRef.current = [];
    if (points.length === 0) return;

    // Cap for performance; the densest block groups carry the signal.
    const top = [...points].sort((a, b) => b.weight - a.weight).slice(0, 300);
    const max = Math.max(...top.map((p) => p.weight)) || 1;

    for (const p of top) {
      const t = Math.min(1, p.weight / max); // 0..1
      const color = t > 0.66 ? "#ef4444" : t > 0.33 ? "#f59e0b" : "#3b82f6";
      circlesRef.current.push(
        new google.maps.Circle({
          map,
          center: { lat: p.lat, lng: p.lng },
          radius: 700 + t * 1000,
          strokeWeight: 0,
          fillColor: color,
          fillOpacity: 0.16 + t * 0.22,
          clickable: false,
          zIndex: 1,
        }),
      );
    }

    return () => {
      circlesRef.current.forEach((c) => c.setMap(null));
      circlesRef.current = [];
    };
  }, [map, points]);

  return null;
}

function Legend({ hasHeat }: { hasHeat: boolean }) {
  return (
    <div className="absolute bottom-3 left-3 rounded-lg bg-white/90 px-3 py-2 text-[11px] shadow ring-1 ring-black/5 backdrop-blur">
      <div className="flex items-center gap-1.5">
        <Dot color="#14161b" /> Existing site
      </div>
      <div className="mt-1 flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <Dot color="#10b981" /> A
        </span>
        <span className="flex items-center gap-1.5">
          <Dot color="#f59e0b" /> B
        </span>
        <span className="flex items-center gap-1.5">
          <Dot color="#f43f5e" /> C
        </span>
      </div>
      {hasHeat && (
        <div className="mt-1 text-slate-500">Heat = population density</div>
      )}
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-white"
      style={{ backgroundColor: color }}
    />
  );
}
