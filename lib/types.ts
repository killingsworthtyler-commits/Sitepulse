// Core domain model for SITE PULSE — the commercial development operations platform.

/** The commercial development lifecycle, in order. */
export type StageId =
  | "site_selection"
  | "due_diligence"
  | "entitlements"
  | "design"
  | "permitting"
  | "pre_construction"
  | "construction"
  | "closeout";

/** A project's current momentum / risk signal — the "pulse." */
export type Health = "on_track" | "at_risk" | "blocked";

export interface Milestone {
  label: string;
  /** ISO date string (yyyy-mm-dd). */
  date: string;
}

export interface Project {
  id: string;
  /** Display name, e.g. "ModWash — West Palm Beach". */
  name: string;
  /** The tenant / end user the site is being developed for. */
  tenant: string;
  city: string;
  state: string;
  stage: StageId;
  health: Health;
  /** Overall completion across the full lifecycle, 0–100. */
  progress: number;
  /** Internal owner responsible for moving it forward. */
  owner: string;
  /** Estimated total project value, USD. */
  value: number;
  nextMilestone: Milestone;
  /** ISO date the project was last touched. */
  updatedAt: string;
}
