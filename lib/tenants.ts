import { getProjects } from "./data";
import type { Project } from "./types";

export interface Tenant {
  id: string;
  name: string;
  category: string;
  /** True if Hutton owns the brand (ModWash). Still treated as a tenant. */
  owned: boolean;
  /** Whether this tenant has a site-selection scorecard model wired up. */
  hasScorecard: boolean;
  blurb: string;
  /** Must match Project.tenant so we can count active projects. */
  projectKey: string;
}

const TENANTS: Tenant[] = [
  {
    id: "modwash",
    name: "ModWash",
    category: "Express Car Wash",
    owned: true,
    hasScorecard: true,
    blurb:
      "Hutton-owned express car wash brand. Site selection runs on a weighted scorecard scored across traffic, competition, demographics, and site quality.",
    projectKey: "ModWash",
  },
];

export async function getTenants(): Promise<Tenant[]> {
  return TENANTS;
}

export async function getTenant(id: string): Promise<Tenant | undefined> {
  return TENANTS.find((t) => t.id === id);
}

/** Active projects for a tenant (matched by projectKey). */
export async function getTenantProjects(tenant: Tenant): Promise<Project[]> {
  const projects = await getProjects();
  return projects.filter((p) => p.tenant === tenant.projectKey);
}
