# Status & Roadmap

_Snapshot of where SITE PULSE stands and what's next. Update as work lands._

## Done
- **Foundation** — Next.js 16 + TS + Tailwind v4 app, scaffolded and building clean.
- **Dashboard** ("Development Pulse") — KPIs (active / on-track / at-risk / blocked),
  team pipeline (RE → Development → Construction handoff), searchable + filterable
  projects table (search / health / team / stage).
- **On-brand** — Hutton gradient, Barlow Condensed + Open Sans, charcoal base, crisp UI.
- **Tenants** — list + tenant detail pages; ModWash flagged Hutton-owned.
- **ModWash scorecard engine** — exact weighted model in code, validated against the
  real spreadsheets; interactive Score-a-Site tool (live score/grade/breakdown,
  N/S variant, auto-computed Population-per-Wash).
- **Address auto-fill** — Census geocode + ACS block-group ring (population, income),
  daytime pop (LODES), projected growth (ACS trend), snow days + variant; competition
  /traffic-driver are labeled mocks pending Google Places. Provenance tags per field.
- **Deploy** — GitHub repo + Render Blueprint (`render.yaml`), Node pinned to 22.

## Next (suggested order)
1. **Google Places integration** — turn the mock competition/quality/traffic-driver
   into real data. Biggest automation lever (incl. the ×5 Competition). Needs
   `GOOGLE_MAPS_API_KEY` (build behind the key, mock until present).
2. **Default Site Layout** to the ModWash prototype (3+/18+/Yes) — effectively auto.
3. **Save scored sites** — persist results to the tenant page. Brings in a database.
4. **Supabase/Postgres** — real cloud DB + team auth (multi-user was the original goal).
5. **Project detail pages** — per-project lifecycle, tasks, documents, dates.
6. **Team tooling** — RE critical dates; Development entitlement/permit tracking;
   Construction budget/schedule/RFIs.
7. Traffic counts (AADT) from state DOT; other tenants' scorecard models.

## Deploy notes
- Hosting: **Render** (web service from this repo via `render.yaml`). Build
  `npm install && npm run build`, start `npm start` (honors `$PORT`).
- Secrets set in Render dashboard: `CENSUS_API_KEY`, `GOOGLE_MAPS_API_KEY`.
- `autoDeploy: true` — every push to `main` redeploys.
- Free plan spins down when idle (~30–60s cold start); upgrade for always-on.

## Environment / machine notes
- Built on Windows 11 + PowerShell. Node installed via winget; app in this repo
  (the repo root IS the app — no subfolder).
- Local-only (not in repo): `.env.local` (keys), and the Claude Code memory at
  `~/.claude/projects/.../memory/`. This `docs/` folder is the portable version.
