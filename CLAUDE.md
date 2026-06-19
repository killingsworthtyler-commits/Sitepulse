# SITE PULSE

Operations platform for **Hutton**, a commercial real-estate development company.
Goal: make development projects flow faster and simpler — track every project
through its lifecycle, give a real-time "pulse," and add tooling at each stage.

> New to this repo? This file + the `docs/` folder are the source of truth for
> how and why things are built. Read `docs/ROADMAP.md` for current status.

## Stack
- **Next.js 16** (App Router) + **React 19** + **TypeScript** — ⚠️ see `AGENTS.md`; v16 has breaking changes (async `params`/`searchParams`, `fetch` uncached by default).
- **Tailwind v4** (`@theme` tokens in `app/globals.css`).
- Data: in-memory seed behind async accessors in `lib/` — built to swap for a real DB (Supabase/Postgres) later without touching UI.
- External data (auto-fill): US Census (geocode + ACS + LODES); Google Places (planned).

## Run it
```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (also the deploy build)
npm start        # serve the production build (honors $PORT — used by Render)
```
Node 20+ (CI/deploy pinned to 22 via `.node-version` / `render.yaml`).

## Environment variables (`.env.local`, git-ignored — never commit keys)
- `CENSUS_API_KEY` — free key (api.census.gov/data/key_signup.html). Unlocks scorecard demographics auto-fill. Degrades gracefully if absent.
- `GOOGLE_MAPS_API_KEY` — Places API (New). Unlocks real competition/traffic-driver. Currently mocked if absent.
- `ANTHROPIC_API_KEY` — Claude (Anthropic API). Unlocks the "AI Analyst Read" narrative on the site report. Section is omitted if absent. Optional `ANTHROPIC_MODEL` overrides the model (default `claude-opus-4-8`).

### Auth — Microsoft SSO, invite-only (`lib/auth/`)
Auth stays **OFF** until `SESSION_SECRET` is set (app is fully usable without it). When on, every page outside `/login` requires a signed-in, invited user. Stateless HMAC-signed cookie sessions (no auth library); the invite list lives in the Neon `app_users` table and is managed from the **Account** tab by admins.
- `SESSION_SECRET` — master switch + cookie HMAC key. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
- `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` / `AZURE_TENANT_ID` — from an Azure App Registration (Entra ID). Redirect URI = `<app-url>/api/auth/callback`.
- `ADMIN_EMAILS` — comma-separated emails seeded as admins on first run (so the first people can sign in + invite others).

On Render these are set in the dashboard (the repo `render.yaml` declares them `sync:false`).

## Repo map
- `app/` — routes. `/` dashboard · `/scorecard` (model + Score-a-Site tool) · `/prospect` (Site Finder map).
- `components/` — UI (sidebar, badges, stat-card, stage-pipeline, projects-view, scorecard-tool).
- `lib/` — domain model + data: `types`, `stages`, `teams`, `health`, `format`, `data` (projects).
- `lib/scorecard/` — ModWash scoring engine (`modwash.ts`) + validated sample sites.
- `lib/autofill/` — address → inputs pipeline (`census.ts`, `lodes.ts`, `climate.ts`, `places.ts`, `index.ts`).

## Key conventions
- **Teams derive from stage** (`lib/teams.ts` → `teamForStage`) — Real Estate / Development / Construction. Don't store team on projects.
- **Scorecard model is declarative** (`lib/scorecard/modwash.ts`) and drives BOTH scoring and the input form — keep them in one source of truth.
- **Brand tokens**: brand colors live in a NON-inline `@theme {}` block so custom classes (`.brand-gradient`) can read the CSS vars. See `docs/BRAND.md`.
- Match the surrounding code's style. Verify changes by building and (for UI) running the dev server.

## Deep docs
- `docs/ARCHITECTURE.md` — structure, data layer, routing, conventions.
- `docs/SCORECARD.md` — the ModWash model, the engine, auto-fill, data sources & accuracy.
- `docs/BRAND.md` — Hutton brand system (colors, fonts, Tailwind v4 gotcha).
- `docs/ROADMAP.md` — what's done, what's next, deploy notes.

@AGENTS.md
