/** Compact currency, e.g. $4.2M, $850K. */
export function money(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value}`;
}

/** Short date, e.g. "Jun 14". Parsed as local to avoid TZ drift on yyyy-mm-dd. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Relative day count vs a reference "today" (default 2026-06-14). */
export function daysUntil(iso: string, today = "2026-06-14"): number {
  const a = Date.parse(iso);
  const b = Date.parse(today);
  return Math.round((a - b) / 86_400_000);
}
