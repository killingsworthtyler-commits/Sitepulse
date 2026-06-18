"use server";

import { autofillSite, type AutofillResult } from "@/lib/autofill";
import type { DealType } from "@/lib/deal";

/** Server action: geocode an address and auto-fill what we can, over a
    drive-time trade area of `minutes` (default 7). For an acquisition the
    on-site wash being bought is excluded from the competition count. */
export async function autofillAction(
  address: string,
  minutes?: number,
  dealType: DealType = "build",
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
  return autofillSite(trimmed, minutes, dealType);
}
