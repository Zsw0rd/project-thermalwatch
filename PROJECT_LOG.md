# ThermalWatch AI — Project Log

This is the durable implementation record for ThermalWatch AI. It must be updated whenever the project is touched.

## Current status

- **Stage:** Operational snapshot MVP with NASA FIRMS + OSM context; land cover and historical baselines pending
- **Primary deliverable:** Explainable geospatial intelligence web dashboard
- **Data mode:** API-first attributed source snapshots with automatic deterministic simulation fallback
- **Architecture:** Next.js web client, FastAPI service, PostgreSQL/PostGIS, Python geospatial and tabular ML pipeline

## 2026-09-01 — Project initialization

### Objective

Turn the SIH26162 roadmap into a runnable, web-first ThermalWatch AI product and establish documentation that persists across future work.

### Areas touched

- Repository-wide working instructions
- Project work log
- Research, references, and glossary

### Decisions

- The web dashboard is the first implementation priority.
- The first usable slice will run with cached demo data and will expose the intended intelligence workflow before live ingestion is required.
- The approved stack is Next.js/TypeScript/Tailwind/MapLibre/Recharts on the web, FastAPI/Python on the service layer, and PostgreSQL/PostGIS for spatial persistence.
- Python 3.12 will be used in the containerized backend for broad geospatial and ML library compatibility.
- Every future implementation session must update this file and the research file when applicable. `AGENTS.md` enforces that convention.

### Verification

- Read the complete 3,246-line `SIH26162_Industrial_Fire_Detection_Step_by_Step_Roadmap.md`.
- Confirmed local availability of Node.js 22.14.0, npm 10.9.2, Docker 29.5.3, Git 2.53.0, and Python.

### Next

- Connect the web event repository to the FastAPI service without removing offline demo mode.
- Implement FIRMS ingestion and normalized event persistence.
- Add OSM facility ingestion and PostGIS spatial enrichment.

## 2026-09-01 — Web MVP and service foundation

### Objective

Deliver the first runnable ThermalWatch AI web experience and establish the backend/container structure required for live geospatial pipelines.

### Areas touched

- `frontend/src/components/command-center.tsx`
- `frontend/src/components/thermal-map.tsx`
- `frontend/src/lib/demo-data.ts`
- `frontend/src/lib/types.ts`
- frontend application shell, styling, package configuration, and container image
- FastAPI configuration and health surface
- Docker Compose services for the web client, API, and PostGIS
- root environment template, README, Git ignore rules, and repository initialization

### Implemented

- Built a responsive intelligence command center rather than a generic landing page.
- Added a MapLibre national map with selectable classified thermal markers and source attribution.
- Added industrial, vegetation, agricultural, and unknown persistent-source demo scenarios.
- Added working category filters, text search, event selection, confidence, severity, persistence, facility context, evidence sources, and seven-day FRP charts.
- Added a desktop evidence panel and a tested slide-in mobile intelligence drawer.
- Added visible safety copy stating that cached scenarios are simulated and not operational incident reports.
- Added FastAPI `/api/v1` and `/api/v1/health` endpoints with demo/live mode reporting.
- Added PostgreSQL/PostGIS, API, and web services through Docker Compose.
- Added root-level Git repository coverage. The generated frontend-only Git metadata was moved to `.scaffold-git-history` as a recoverable backup and is ignored by the new repository.

### Decisions

- MapLibre uses the OpenFreeMap Liberty style for worldwide coverage; the visual treatment is applied locally while preserving map attribution.
- Demo events use fictionalized facility names and are clearly labeled simulations to avoid implying real-world incidents.
- The map remains at national extent on initial load and flies to an event only after a user selection.
- A resize observer keeps the WebGL canvas aligned with responsive layout changes.
- The evidence chart is mounted only on the active desktop/mobile surface to avoid hidden-container sizing problems.

### Verification

- `npm run lint` — passed.
- `npm run build` — passed with TypeScript and static generation; `/` is prerendered.
- `python -m compileall app` — passed for all backend modules.
- `docker compose config --quiet` — passed.
- Browser QA at desktop width — map, five demo markers, event evidence, FRP chart, and provenance rendered; no console errors.
- Browser interaction QA — industrial filter returned 2/5 events and 2 map markers; conflicting search/filter produced the intended empty state; `U-17` search returned the unknown source.
- Browser QA at 390 × 844 — responsive metrics, horizontally scrollable queue, map, event selection, and mobile evidence drawer worked; final browser console contained no warnings or errors.
- Dependency installation audit reported zero known npm vulnerabilities.

### Known limitations / next concrete tasks

- Dashboard KPI totals are illustrative and must be computed from the API when live data lands.
- The main event repository still reads cached TypeScript fixtures; the FastAPI event endpoints and database models are the next integration task.
- FIRMS credentials are intentionally absent. Live ingestion will require a user-provided `FIRMS_MAP_KEY` in `.env`.
- OSM/Overpass ingestion, land-cover enrichment, clustering, persistence calculation, and ML predictions are not yet implemented server-side.
- Header navigation and secondary controls currently establish information architecture; their full routed views and workflows remain future slices.

## 2026-09-01 — Operational FIRMS/OSM intelligence pipeline

### Objective

Move the web-first MVP through ingestion, normalization, contextual enrichment, triage, API integration, geospatial persistence design, and offline-safe operation in one implementation pass.

### Areas touched

- NASA FIRMS and OpenStreetMap source snapshots under `backend/data/samples`
- FastAPI event, facility, analytics, alert, refresh, GeoJSON, and persistence endpoints
- typed normalization, deduplication, spatial grouping, OSM enrichment, alerting, and batched persistence services
- SQLAlchemy/PostGIS models and initial Alembic migration
- backend unit/API tests and container build
- frontend API adapter, operational/simulation switching, facility map layer, dynamic KPIs, evidence copy, and source-state labels
- root runtime configuration, Docker Compose, README, research notebook, and this log

### Decisions and implementation details

- Added official 24-hour South Asia CSV snapshots for NOAA-20 VIIRS, NOAA-21 VIIRS, and S-NPP VIIRS, then filtered them to the configured `68,6,98,38` bounding box.
- Preserved the complete source row as an excluded API field so raw evidence remains available for database persistence without leaking unnecessary payloads to the browser.
- Derived stable SHA-256 event IDs from source, satellite, acquisition timestamp, and coordinates; normalized all acquisition timestamps to UTC; and deduplicated identical fingerprints.
- Used a deterministic latitude/longitude grid rounded to two decimals as the current approximately 1 km co-observation grouping heuristic. It is explicitly not a learned persistence baseline or DBSCAN cluster.
- Added a 23,375-feature OSM snapshot covering supported refineries, flares, power plants, steelmaking sites, and quarries. A 0.25-degree spatial index reduced full snapshot enrichment from roughly 20 seconds to about 0.32 seconds on this machine.
- Applied conservative industrial-context promotion only within 3 km of a mapped refinery, flare, or steelmaking feature and within 2 km of a mapped power plant or quarry. Proximity never confirms an industrial incident.
- Added one deterministic analyst-review alert per approximate grid cell: industrial-context or multi-source cells require FRP >= 20 MW; other cells require FRP >= 50 MW. The API labels every result as requiring review.
- Made the web API-first while retaining the simulation dataset as a complete offline fallback. Facility markers can be toggled independently from thermal-event markers.
- Replaced the final stale demo-map label with a data-aware `attributed snapshot` / `simulation cache` label so provenance stays consistent throughout the active mode.
- Added PostGIS tables for events, facilities, clusters, predictions, and alerts plus GiST indexes and batched upsert logic. The API does not require the database to serve the deterministic source snapshot.
- The Sites workflow influenced this pass by keeping the first viewport centered on the working intelligence surface and by preserving the existing Next.js architecture instead of replacing the established application.

### Verification

- Downloaded and parsed all three official FIRMS feeds: 1,473 normalized records in the configured bounding box before the web's `min_frp=1` filter.
- Snapshot statistics: NOAA-20 701 records, NOAA-21 339, S-NPP 433; FIRMS confidence values 1,223 nominal, 234 low, and 16 high; mean FRP 6.33 MW and maximum FRP 179.92 MW.
- OSM enrichment loaded 23,375 facilities and marked 111 detections as industrial-context candidates under the conservative thresholds.
- `ruff check app tests alembic` — passed.
- `pytest -q` — 10 tests passed, including raw-field preservation/API exclusion and OSM attribution; one upstream Starlette TestClient deprecation warning remains.
- `npm run lint` — passed.
- `npm run build` — passed, including TypeScript checks and static generation.
- Alembic offline SQL generation — passed and produced PostGIS extension DDL, five tables, foreign keys, and GiST indexes.
- Running smoke check — API health `ok` in snapshot mode, 1,432 detections at `min_frp=1`, 23,375 facilities, 16 deduplicated review alerts, and web route HTTP 200.
- Browser operational QA — clean load selected NASA FIRMS snapshot mode; 1,432 total / 350 loaded, 15 industrial candidates in the loaded map slice, 16 review alerts, facility toggle, 15-row industrial filter, and evidence panel all rendered correctly; a fresh browser tab reported no console warnings or errors.

### Known limitations / next concrete task

- Docker Desktop did not start in this session, so the migration and batched upserts were validated through generated PostgreSQL SQL and unit/API checks but not executed against a running PostGIS container.
- Sites publishing was not attempted because the current validated product depends on a separate FastAPI service and PostgreSQL/PostGIS connection, while the Sites runtime does not support that raw-TCP database architecture. Publish only after selecting a compatible API/database host or adapting persistence to an HTTP/Workers-compatible service; the local operational preview remains running.
- The current snapshot measures 24-hour co-observation, not multi-day persistence. Historical ingestion and learned per-location FRP baselines are the next backend stage.
- Land-cover context is intentionally reported as pending. Add an attributed India land-cover source and point/polygon sampling before enabling vegetation or agricultural classifications for operational data.
- Bounding-box inclusion is not an India administrative-boundary join, and OSM representative-point proximity is not polygon containment.
- The production alert table exists, but the current `/alerts` response is computed deterministically from the snapshot; persisting alert lifecycle and acknowledgement state is the next alerting stage.
