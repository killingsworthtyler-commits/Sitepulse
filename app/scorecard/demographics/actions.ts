"use server";

import {
  fetchDemographicsForPoint,
  type DemographicsResult,
} from "@/lib/demographics/report";
import { geocodeRobust } from "@/lib/autofill/census";
import { findCtaAnchors } from "@/lib/autofill/places";
import { DEFAULT_TRADE_AREA, type TradeAreaSpec } from "@/lib/autofill/tradearea";

/** Build a demographic summary over an address's trade area, OR over a chosen
    anchor's trade area (the CTA). Also returns nearby anchors for the picker. */
export async function demographicsAction(
  address: string,
  minutes?: number,
  anchor?: { lat: number; lng: number; label: string },
): Promise<DemographicsResult> {
  const trimmed = address.trim();
  if (!trimmed) {
    return { report: { ok: false, error: "Enter an address first." }, anchors: [], site: null };
  }

  const loc = await geocodeRobust(trimmed);
  if (!loc || !loc.state || !loc.county) {
    return {
      report: { ok: false, error: "Couldn't find that address. Check the spelling and try again." },
      anchors: [],
      site: null,
    };
  }

  const gKey = process.env.GOOGLE_MAPS_API_KEY;
  const anchors = gKey ? await findCtaAnchors(loc.lat, loc.lng, gKey) : [];

  const center = anchor ?? { lat: loc.lat, lng: loc.lng, label: loc.matchedAddress };
  const spec: TradeAreaSpec = minutes ? { mode: "drivetime", value: minutes } : DEFAULT_TRADE_AREA;
  const report = await fetchDemographicsForPoint(center.lat, center.lng, center.label, spec);

  return {
    report,
    anchors,
    site: { lat: loc.lat, lng: loc.lng, matchedAddress: loc.matchedAddress },
  };
}
