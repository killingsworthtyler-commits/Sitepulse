"use server";

import { autofillSite, type AutofillResult } from "@/lib/autofill";

/** Server action: geocode an address and auto-fill what we can. */
export async function autofillAction(address: string): Promise<AutofillResult> {
  const trimmed = address.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: "Enter an address first.",
      fields: {},
      warnings: [],
    };
  }
  return autofillSite(trimmed);
}
