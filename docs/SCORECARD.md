# Site Scorecards

Scorecards live under **Tenants** — each tenant can have its own site-selection
model. The first is **ModWash** (express car wash; a Hutton-owned brand, treated
as a tenant). Source: 10 completed Excel scorecards from Hutton.

## The ModWash model (`lib/scorecard/modwash.ts`)
A deterministic weighted rubric reverse-engineered from the spreadsheets. Each
criterion scores **A=3 / B=2 / C=1 / D=0**, times its weight. Score = earned ÷
possible. Grade: **A >85%, B 75–85%, C <75%**.

Weights: Competition 5 · Total Population per Car Wash 5 · Traffic Count 3 ·
Market 3 · Quality of Competition 2 · Visibility 2 · Ingress/Egress 2 ·
Site Layout 1 · Snow Days 1.

Composites (a sub-score that rolls up children, then maps to a rating band):
- **Market** = median income + daytime pop + projected growth + traffic-driver quality
- **Visibility** = traffic speed + sight line + off-block
- **Ingress/Egress** = direct access + site type
- **Site Layout** = pay stations + vacuum slots + member lane

Two variants: **Northern** (includes Snow Days, 72 pts possible) vs **Southern**
(no Snow Days, 69 pts). Auto-selected by latitude.

**Total Population per Car Wash** = trade-area population ÷ (1 + competition).

The model is **declarative** — the same structure powers `scoreSite()` and renders
the input form (`components/scorecard-tool.tsx`). Keep them unified.

## Validation
`lib/scorecard/modwash-sites.ts` stores real site inputs and recomputes them with
the engine. It reproduces the spreadsheets exactly: West Palm 100% A, Inman 91% A,
Carlisle 81% B, Jacksonville 55% C, Rocky Mount 42% C, Lady Lake 41% C. Treat this
as a regression check — if a model change breaks these, the change is wrong.

## Address auto-fill (`lib/autofill/`)
Enter an address → `autofillSite()` populates what it can, with a provenance tag
per field (`data` / `estimate` / `mock`). Server action: `app/scorecard/actions.ts`.

| Field | Source | Status |
|---|---|---|
| Coordinates, FIPS, matched address, N/S variant | Census geocoder (free) + latitude | ✅ |
| Population, median income | Census ACS, 3-mi **block-group** ring (household-weighted income) | ✅ needs `CENSUS_API_KEY` |
| Daytime population | ACS + **LODES** jobs (`lodes.ts`, cached per state) | ✅ estimate |
| Projected growth | ACS county 5-yr annualized trend | ✅ estimate |
| Snow days | latitude heuristic | ✅ estimate |
| Competition count, quality, traffic-driver | Google Places API New (`places.ts`) | ✅ needs `GOOGLE_MAPS_API_KEY` |
| Traffic count (AADT) | FHWA **HPMS** national ArcGIS layer (`aadt.ts`) — max within ~250m | ✅ estimate, no key |
| Visibility, ingress, layout | manual / site visit | ⬜ |

### Accuracy caveat (important)
Concentric ACS rings read **~20–30% higher** than Experian's *custom* trade-area
polygons (Inman: ring pop ~27k vs scorecard 24.5k; ring income ~$81k vs $62k).
Population is robust (lands in the same ×5 bin); income/daytime can shift a Market
sub-bin. No concentric ring matches a hand-drawn trade area — that's the free-data
ceiling. For exact parity: a paid provider (Experian/Esri/Placer) or areal
apportionment (clip geographies to the circle). Fields are tagged + noted to review.

### TIGERweb / Census specifics (so you don't re-discover them)
- Geocoder is free (no key); ACS data API **requires** the free key.
- TIGERweb `tigerWMS_Current` MapServer: layer **8 = Census Tracts**, **10 = Block Groups**.
- A **3-mile block-group ring** best matches the trade-area magnitude.
- LODES WAC files: `lehd.ces.census.gov/data/lodes/LODES8/<st>/wac/<st>_wac_S000_JT00_<year>.csv.gz` (~small; `w_geocode` = 15-digit block, `C000` = total jobs). Daytime pop = residents + jobs-in-ring − employed residents.

## Next on automation
1. ✅ **Google Places** — real competition (count + classify chains as National Express) and traffic-driver grade (anchors → A/B/C/D). Done; needs `GOOGLE_MAPS_API_KEY`.
2. ✅ **Traffic counts (AADT)** — FHWA HPMS national layer (`aadt.ts`), highest count within ~250m as the frontage road. Done; no key. HPMS `SPEED_LIMIT` is also available to seed the Visibility traffic-speed field later.
3. Default Site Layout to the ModWash prototype (3+/18+/Yes).
4. Save scored sites (needs a DB).
5. Other tenants' scorecard models.
