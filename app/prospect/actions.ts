"use server";

import { findAnchors } from "@/lib/autofill/places";
import { gatherSiteMetrics } from "@/lib/prospect/metrics";
import { desktopScore } from "@/lib/prospect/score";
import { marketHeatmap } from "@/lib/prospect/heatmap";
import type { Candidate, SearchAreaResult } from "@/lib/prospect/types";

const SEARCH_RADIUS = 8000; // ~5 mi — anchor discovery
const HEATMAP_RADIUS = 12000; // ~7.5 mi — population surface
const MAX_CANDIDATES = 12; // bound the billed Places + scoring work per search

const GRADE_RANK: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

function distM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Discover candidate sites near a point, score each on desktop data, and build
    a population heatmap for the area. */
export async function searchAreaAction(
  lat: number,
  lng: number,
): Promise<SearchAreaResult> {
  const gKey = process.env.GOOGLE_MAPS_API_KEY;
  const censusKey = process.env.CENSUS_API_KEY;
  const center = { lat, lng };

  if (!gKey) {
    return {
      ok: false,
      error:
        "Candidate discovery needs GOOGLE_MAPS_API_KEY (Places API). The heatmap still works without it.",
      center,
      candidates: [],
      heatmap: await marketHeatmap(lat, lng, HEATMAP_RADIUS, censusKey),
    };
  }

  // Heatmap (free Census) and anchor discovery (Places) run in parallel.
  const [anchors, heatmap] = await Promise.all([
    findAnchors(lat, lng, SEARCH_RADIUS, gKey),
    marketHeatmap(lat, lng, HEATMAP_RADIUS, censusKey),
  ]);

  // Dedupe anchors that sit within ~200m of an already-kept one, then prefer the
  // strongest traffic drivers and cap the count to bound scoring cost.
  const kept: typeof anchors = [];
  for (const a of anchors) {
    if (kept.some((k) => distM(a.lat, a.lng, k.lat, k.lng) < 200)) continue;
    kept.push(a);
  }
  kept.sort((a, b) => (GRADE_RANK[a.grade] ?? 9) - (GRADE_RANK[b.grade] ?? 9));
  const chosen = kept.slice(0, MAX_CANDIDATES);

  const candidates = (
    await Promise.all(
      chosen.map(async (a, i): Promise<Candidate | null> => {
        const m = await gatherSiteMetrics(a.lat, a.lng);
        if (m.dataPoints === 0) return null;
        const score = desktopScore(m);
        return {
          id: `cand-${i}`,
          name: `Near ${a.name}`,
          lat: a.lat,
          lng: a.lng,
          percent: score.percent,
          grade: score.grade,
          anchorGrade: a.grade,
          trafficCount: m.trafficCount,
          competition: m.competition,
          population: m.population,
          qualityOfCompetition: m.qualityOfCompetition,
          medianIncome: m.medianIncome,
          trafficDriver: m.trafficDriver,
          dataPoints: m.dataPoints,
        };
      }),
    )
  ).filter(Boolean) as Candidate[];

  candidates.sort((a, b) => b.percent - a.percent);

  return { ok: true, center, candidates, heatmap };
}
