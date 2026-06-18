"use server";

import {
  fetchDemographicsReport,
  type DemographicsReport,
} from "@/lib/demographics/report";

/** Server action: build a Census demographic summary for an address over a
    drive-time (minutes) or ring trade area. */
export async function demographicsAction(
  address: string,
  minutes?: number,
): Promise<DemographicsReport> {
  const trimmed = address.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter an address first." };
  }
  return fetchDemographicsReport(trimmed, minutes);
}
