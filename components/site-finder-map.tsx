"use client";

import { useEffect, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  Marker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { searchAreaAction } from "@/app/prospect/actions";
import type { Candidate, SearchAreaResult } from "@/lib/prospect/types";
import type { HeatPoint } from "@/lib/prospect/heatmap";
import type { MappedSite } from "@/lib/prospect/sites";
import { GradeBadge } from "@/components/badges";

const GRADE_COLOR: Record<string, string> = {
  A: "#10b981",
  B: "#f59e0b",
  C: "#f43f5e",
};

/** A teardrop pin as an SVG data-URI, so we don't depend on `google` at render. */
function pinUri(fill: string, label: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">` +
    `<path d="M16 0C7.2 0 0 7.2 0 16c0 11.5 16 26 16 26s16-14.5 16-26C32 7.2 24.8 0 16 0z" fill="${fill}" stroke="white" stroke-width="2"/>` +
    `<text x="16" y="21" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="bold" fill="white">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function SiteFinderMap({
  sites,
  center,
}: {
  sites: MappedSite[];
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
  sites: MappedSite[];
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

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      {/* ---------------- Map ---------------- */}
      <div className="relative h-[640px] overflow-hidden rounded-lg border border-slate-200">
        <Map
          id="finder"
          defaultCenter={center}
          defaultZoom={11}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapTypeControl
          clickableIcons={false}
          style={{ width: "100%", height: "100%" }}
        >
          {sites.map((s) => (
            <Marker
              key={s.id}
              position={{ lat: s.lat, lng: s.lng }}
              icon={pinUri("#14161b", s.grade)}
              title={`${s.name} — existing site (${s.grade}, ${Math.round(s.percent * 100)}%)`}
              zIndex={50}
            />
          ))}
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
          <Heatmap points={result?.heatmap ?? []} />
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

// Minimal shape of google.maps.visualization.HeatmapLayer — the bundled types
// for the visualization library are incomplete, so we describe what we use.
interface HeatLayer {
  setMap(map: google.maps.Map | null): void;
  setData(data: { location: google.maps.LatLng; weight: number }[]): void;
}
interface VisualizationLib {
  HeatmapLayer: new (opts: { radius?: number; opacity?: number }) => HeatLayer;
}

/** Google Maps heatmap layer, driven by the population points. */
function Heatmap({ points }: { points: HeatPoint[] }) {
  const map = useMap("finder");
  const vis = useMapsLibrary("visualization") as unknown as VisualizationLib | null;
  const layerRef = useRef<HeatLayer | null>(null);

  useEffect(() => {
    if (!map || !vis) return;
    if (!layerRef.current) {
      layerRef.current = new vis.HeatmapLayer({ radius: 30, opacity: 0.55 });
      layerRef.current.setMap(map);
    }
    layerRef.current.setData(
      points.map((p) => ({
        location: new google.maps.LatLng(p.lat, p.lng),
        weight: p.weight,
      })),
    );
  }, [map, vis, points]);

  useEffect(
    () => () => {
      layerRef.current?.setMap(null);
      layerRef.current = null;
    },
    [],
  );

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
