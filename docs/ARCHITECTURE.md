# Architecture

## Overview
SITE PULSE is a single Next.js 16 app (App Router, TypeScript, Tailwind v4). It's
organized around Hutton's commercial development lifecycle and the three teams
that own it.

## The development lifecycle (8 stages)
`Site Selection → Due Diligence → Entitlements → Design → Permitting → Pre-Construction → Construction → Closeout`
Defined in `lib/stages.ts`.

## Teams (the primary lens)
Three teams own ranges of the lifecycle (`lib/teams.ts`):
- **Real Estate** — Site Selection, Due Diligence (brand blue)
- **Development** — Entitlements, Design, Permitting, Pre-Construction (brand purple)
- **Construction** — Construction, Closeout (brand magenta)

Team is **derived from a project's stage** via `teamForStage(stage)` — never stored
on the project. The dashboard pipeline renders as a RE → Development → Construction
handoff; the projects table has a team filter.

## Health signals
`on_track` / `at_risk` / `blocked` (`lib/health.ts`) — kept as semantic colors
(emerald / amber / rose), distinct from the brand team colors.

## Data layer
`lib/data.ts` holds projects as an in-memory array behind **async accessors**
(`getProjects`, `getProject`). `lib/tenants.ts` holds tenants similarly. Async
signatures are intentional: swapping the array for Supabase/Postgres later won't
change any call sites or UI. Seed data uses real ModWash prospect sites plus
representative Hutton projects (CFA, RaceTrac, Tennova, retail).

## Routing (App Router)
- `/` — Development Pulse dashboard (KPIs, team pipeline, projects table).
- `/tenants` — tenant list.
- `/tenants/[id]` — tenant detail; for ModWash shows the scorecard model + scored sites.
- `/tenants/[id]/scorecard` — interactive Score-a-Site tool.

Next.js 16 notes (see `AGENTS.md`): `params`/`searchParams` are **Promises** (await
them); `fetch` is **uncached by default**; Server Components by default, `"use client"`
for interactivity. Server Actions live in `app/.../actions.ts` (`"use server"`).

## UI components (`components/`)
- `sidebar.tsx` — client; brand mark, nav, path-aware active state.
- `badges.tsx` — HealthBadge, StageBadge, TeamBadge, GradeBadge.
- `stat-card.tsx`, `stage-pipeline.tsx` — dashboard pieces.
- `projects-view.tsx` — client; searchable/filterable projects table (search + health + team + stage).
- `scorecard-tool.tsx` — client; the interactive scorecard, driven by the declarative model.

## Conventions
- Keep new code in the style of its neighbors.
- Verify: `npm run build` for types; run the dev server + screenshot for UI changes.
- Don't store derived data (e.g., team) — derive it.
