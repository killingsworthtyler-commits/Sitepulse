import type { StageId } from "./types";

/** The three teams that move a project through its lifecycle, in handoff order. */
export type TeamId = "real_estate" | "development" | "construction";

export interface TeamMeta {
  id: TeamId;
  label: string;
  /** The lifecycle stages this team owns, in order. */
  stages: StageId[];
  /** What the team is responsible for — shown as a subtitle. */
  responsibility: string;
  /** Tailwind tokens for consistent team color theming across the UI. */
  color: {
    /** Soft badge: bg + text + ring. */
    badge: string;
    /** Solid dot / accent. */
    dot: string;
    /** Bar gradient. */
    bar: string;
    /** Top accent border. */
    border: string;
    /** Header text. */
    text: string;
  };
}

export const TEAMS: TeamMeta[] = [
  {
    id: "real_estate",
    label: "Real Estate",
    stages: ["site_selection", "due_diligence"],
    responsibility: "Site sourcing & acquisition",
    color: {
      badge: "bg-sky-50 text-sky-700 ring-sky-600/20",
      dot: "bg-brand-blue",
      bar: "bg-brand-blue",
      border: "border-brand-blue",
      text: "text-sky-700",
    },
  },
  {
    id: "development",
    label: "Development",
    stages: ["entitlements", "design", "permitting", "pre_construction"],
    responsibility: "Entitlements, design & preconstruction",
    color: {
      badge: "bg-violet-50 text-violet-700 ring-violet-600/20",
      dot: "bg-brand-purple",
      bar: "bg-brand-purple",
      border: "border-brand-purple",
      text: "text-violet-700",
    },
  },
  {
    id: "construction",
    label: "Construction",
    stages: ["construction", "closeout"],
    responsibility: "Vertical build & closeout",
    color: {
      badge: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-600/20",
      dot: "bg-brand-magenta",
      bar: "bg-brand-magenta",
      border: "border-brand-magenta",
      text: "text-fuchsia-700",
    },
  },
];

export const TEAM_MAP: Record<TeamId, TeamMeta> = Object.fromEntries(
  TEAMS.map((t) => [t.id, t]),
) as Record<TeamId, TeamMeta>;

const STAGE_TO_TEAM: Record<StageId, TeamId> = Object.fromEntries(
  TEAMS.flatMap((t) => t.stages.map((s) => [s, t.id])),
) as Record<StageId, TeamId>;

/** Which team currently owns a project at the given stage. */
export function teamForStage(stage: StageId): TeamMeta {
  return TEAM_MAP[STAGE_TO_TEAM[stage]];
}
