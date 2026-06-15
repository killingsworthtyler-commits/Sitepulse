import type { StageId } from "./types";

export interface StageMeta {
  id: StageId;
  label: string;
  /** Short label for tight UI (pipeline columns). */
  short: string;
  order: number;
}

/** The 8 stages of Hutton's commercial development lifecycle, in order. */
export const STAGES: StageMeta[] = [
  { id: "site_selection", label: "Site Selection", short: "Site", order: 1 },
  { id: "due_diligence", label: "Due Diligence", short: "Diligence", order: 2 },
  { id: "entitlements", label: "Entitlements", short: "Entitle", order: 3 },
  { id: "design", label: "Design", short: "Design", order: 4 },
  { id: "permitting", label: "Permitting", short: "Permit", order: 5 },
  { id: "pre_construction", label: "Pre-Construction", short: "Pre-Con", order: 6 },
  { id: "construction", label: "Construction", short: "Build", order: 7 },
  { id: "closeout", label: "Closeout", short: "Closeout", order: 8 },
];

export const STAGE_MAP: Record<StageId, StageMeta> = Object.fromEntries(
  STAGES.map((s) => [s.id, s]),
) as Record<StageId, StageMeta>;
