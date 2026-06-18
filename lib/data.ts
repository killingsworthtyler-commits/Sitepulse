import type { Project } from "./types";

// Seed data layer. This is intentionally a single source of truth behind simple
// accessor functions so we can swap the in-memory array for a DB later without
// changing any UI code. Demo projects were cleared until real project tracking
// is built — add real projects here (or wire a DB) to populate the dashboard.
const PROJECTS: Project[] = [];

/** Returns all projects. Async so the call site already matches a future DB. */
export async function getProjects(): Promise<Project[]> {
  return PROJECTS;
}

export async function getProject(id: string): Promise<Project | undefined> {
  return PROJECTS.find((p) => p.id === id);
}
