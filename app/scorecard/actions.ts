"use server";

import { autofillSite, type AutofillResult } from "@/lib/autofill";

/** Server action: geocode an address and auto-fill what we can, over a
    drive-time trade area of `minutes` (default 7). */
export async function autofillAction(
  address: string,
  minutes?: number,
): Promise<AutofillResult> {
  const trimmed = address.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: "Enter an address first.",
      fields: {},
      warnings: [],
    };
  }
  return autofillSite(trimmed, minutes);
}
