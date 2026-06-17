import type { Project } from "./types";

// Seed data layer. This is intentionally a single source of truth behind simple
// accessor functions so we can swap the in-memory array for Supabase/Postgres
// later without changing any UI code. ModWash projects only — the pipeline
// mirrors ModWash site-selection and development work.
const PROJECTS: Project[] = [
  {
    id: "mw-wpb",
    name: "ModWash — West Palm Beach",
    tenant: "ModWash",
    city: "West Palm Beach",
    state: "FL",
    stage: "site_selection",
    health: "on_track",
    progress: 8,
    owner: "Tyler Killingsworth",
    value: 4_600_000,
    nextMilestone: { label: "LOI execution", date: "2026-06-20" },
    updatedAt: "2026-06-12",
  },
  {
    id: "mw-carlisle",
    name: "ModWash — Carlisle (Trindle Rd)",
    tenant: "ModWash",
    city: "Carlisle",
    state: "PA",
    stage: "due_diligence",
    health: "on_track",
    progress: 22,
    owner: "Sarah Chen",
    value: 4_900_000,
    nextMilestone: { label: "Phase I ESA back", date: "2026-06-25" },
    updatedAt: "2026-06-13",
  },
  {
    id: "mw-inman",
    name: "ModWash — Inman",
    tenant: "ModWash",
    city: "Inman",
    state: "SC",
    stage: "site_selection",
    health: "at_risk",
    progress: 6,
    owner: "Tyler Killingsworth",
    value: 4_300_000,
    nextMilestone: { label: "Re-score vs. competition", date: "2026-06-18" },
    updatedAt: "2026-06-11",
  },
  {
    id: "mw-deptford",
    name: "ModWash — Deptford",
    tenant: "ModWash",
    city: "Deptford",
    state: "NJ",
    stage: "entitlements",
    health: "on_track",
    progress: 38,
    owner: "Marcus Webb",
    value: 5_100_000,
    nextMilestone: { label: "Zoning board hearing", date: "2026-07-08" },
    updatedAt: "2026-06-10",
  },
  {
    id: "mw-ladylake",
    name: "ModWash — Lady Lake",
    tenant: "ModWash",
    city: "Fruitland Park",
    state: "FL",
    stage: "site_selection",
    health: "blocked",
    progress: 4,
    owner: "Sarah Chen",
    value: 4_200_000,
    nextMilestone: { label: "Sourcing alternate parcel", date: "2026-06-30" },
    updatedAt: "2026-06-09",
  },
  {
    id: "mw-rockymount",
    name: "ModWash — Rocky Mount",
    tenant: "ModWash",
    city: "Rocky Mount",
    state: "NC",
    stage: "pre_construction",
    health: "on_track",
    progress: 71,
    owner: "Sarah Chen",
    value: 4_500_000,
    nextMilestone: { label: "GMP finalized w/ GC", date: "2026-07-01" },
    updatedAt: "2026-06-12",
  },
  {
    id: "mw-smithfield",
    name: "ModWash — Smithfield",
    tenant: "ModWash",
    city: "Smithfield",
    state: "NC",
    stage: "construction",
    health: "at_risk",
    progress: 79,
    owner: "Tyler Killingsworth",
    value: 4_400_000,
    nextMilestone: { label: "Tunnel equipment install", date: "2026-06-23" },
    updatedAt: "2026-06-13",
  },
  {
    id: "mw-jax",
    name: "ModWash — Jacksonville (University)",
    tenant: "ModWash",
    city: "Jacksonville",
    state: "FL",
    stage: "due_diligence",
    health: "blocked",
    progress: 18,
    owner: "Marcus Webb",
    value: 4_700_000,
    nextMilestone: { label: "Resolve access easement", date: "2026-06-28" },
    updatedAt: "2026-06-08",
  },
];

/** Returns all projects. Async so the call site already matches a future DB. */
export async function getProjects(): Promise<Project[]> {
  return PROJECTS;
}

export async function getProject(id: string): Promise<Project | undefined> {
  return PROJECTS.find((p) => p.id === id);
}
