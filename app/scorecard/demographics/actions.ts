"use server";

import {
  fetchDemographicsReport,
  type DemographicsReport,
} from "@/lib/demographics/report";

/** Server action: build a Census demographic summary for an address. */
export async function demographicsAction(address: string): Promise<DemographicsReport> {
  const trimmed = address.trim();
  if (!trimmed) {
    return { ok: false, error: "Enter an address first." };
  }
  return fetchDemographicsReport(trimmed);
}
