import type { Health } from "./types";

export interface HealthMeta {
  id: Health;
  label: string;
  /** Tailwind classes for a soft badge (bg + text + ring). */
  badge: string;
  /** Tailwind solid dot color. */
  dot: string;
}

export const HEALTH_MAP: Record<Health, HealthMeta> = {
  on_track: {
    id: "on_track",
    label: "On Track",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    dot: "bg-emerald-500",
  },
  at_risk: {
    id: "at_risk",
    label: "At Risk",
    badge: "bg-amber-50 text-amber-700 ring-amber-600/20",
    dot: "bg-amber-500",
  },
  blocked: {
    id: "blocked",
    label: "Blocked",
    badge: "bg-rose-50 text-rose-700 ring-rose-600/20",
    dot: "bg-rose-500",
  },
};

export const HEALTH_ORDER: Health[] = ["on_track", "at_risk", "blocked"];
