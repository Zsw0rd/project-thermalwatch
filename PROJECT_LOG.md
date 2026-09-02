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

## 2026-09-02 — Operational map layout, clustering, and NASA imagery

### Objective

Repair the broken map workspace, move the interface toward a dense operations-software aesthetic, add an enabled geographic grid and satellite imagery, and make point behavior accurate and understandable across zoom levels.

### Areas touched

- `frontend/src/components/thermal-map.tsx`
- `frontend/src/components/command-center.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/app/globals.css`
- project log and research/reference glossary

### Decisions and implementation details

- Root cause of the broken map was layout propagation: the 350-row event queue expanded the CSS Grid row to roughly 22,000 px, forcing the WebGL canvas against its 4,096 px rendering limit and producing a blank or gray surface.
- Bounded the desktop workspace to a viewport-aware 620–800 px height and gave the event queue, map, and evidence inspector independent overflow behavior.
- Kept the three-panel event/map/evidence workspace visible from 1,120 px upward and repaired the clipped filter controls.
- Replaced hundreds of HTML map markers with one clustered MapLibre GeoJSON source. Low zoom uses count-bearing clusters; clicking a cluster zooms to its expansion level; zoom 9+ shows exact original FIRMS coordinates with category styling.
- Removed the unintended automatic fly-to that occurred when the application switched from simulation fallback to operational data. The initial view now remains at the India extent; only explicit event selection changes the camera.
- Increased the operational request limit from 350 to 2,000 so the map can render the complete snapshot. The independently scrolling queue remains capped at 350 rows for predictable UI performance.
- Added a visible, enabled-by-default 5-degree latitude/longitude grid with labels and a grid toggle. This display grid is separate from the backend's approximate 1 km co-observation heuristic.
- Added enabled-by-default NASA GIBS satellite context: dated S-NPP VIIRS corrected-reflectance imagery over a Blue Marble fallback, plus a terrain/satellite toggle and explicit GIBS attribution.
- Added a live zoom/cursor coordinate readout and retained exact `[longitude, latitude]` order throughout the API adapter and GeoJSON source.
- Shifted the visual system toward dense operational software—graphite surfaces, squared panels, compact controls, persistent evidence inspector, stronger map framing, and reduced decorative spacing—without copying proprietary product assets or branding.

### Verification

- `npm run lint` — passed after the final map and source-label changes.
- `npm run build` — passed with TypeScript and static generation after the MapLibre rewrite.
- Local smoke check — web HTTP 200 and the API returned the complete 1,432-event `min_frp=1` snapshot to the map.
- NASA GIBS Blue Marble India tile — HTTP 200, JPEG.
- NASA GIBS S-NPP VIIRS true-color tile for 2026-09-01 — HTTP 200, JPEG.
- The earlier layout reproduction measured a 22,071 px map shell and a 4,096 px-limited canvas; the bounding fix removed that unbounded sizing path.

### Known limitations / next concrete task

- Automated browser re-entry was blocked by the in-app browser's localhost URL policy after the local services restarted. Build validation and direct tile checks passed; final hands-on pan/zoom inspection should be performed in the already open local preview.
- GIBS corrected-reflectance imagery is date-specific visual context and may include cloud cover or seams. It is not yet an analytical evidence channel.
- Point clusters are intentionally visual aggregations at low zoom. Individual FIRMS coordinates become selectable after expansion or zoom 9; they should not be interpreted from a cluster centroid.

## 2026-09-02 — Visible hotspot/grid rendering follow-up

### Objective

Resolve the live-browser failure where the redesigned command-center shell and map basemap appeared, but neither the geographic grid nor thermal hotspot symbols were visible.

### Areas touched

- `frontend/src/components/thermal-map.tsx`
- `frontend/src/components/command-center.tsx`
- `frontend/src/app/globals.css`
- this project log and the research/reference glossary

### Decisions and implementation details

- Superseded the prior browser-QA limitation: the existing local tab was successfully claimed and the missing-overlay state was reproduced directly.
- Confirmed that all 1,432 filtered FIRMS records reached the map component while the MapLibre GeoJSON source reported zero loaded/rendered features in this browser, despite the raster basemap loading normally.
- Added an operational canvas overlay that projects every source `[longitude, latitude]` through the active MapLibre camera. The grid, facility context, exact selected-location ring, point blips, and clusters therefore share the same pan/zoom transform as the basemap.
- Implemented deterministic screen-space aggregation: low zoom groups nearby projected points into count-bearing clusters; clicking a cluster recenters on its geographic centroid and expands by two zoom levels; zoom 9.5+ draws individual observations at their exact source coordinates.
- Made the hotspot treatment deliberately unmistakable with high-contrast orange/red count clusters, category-colored point blips, glow halos, industrial-context outlines, and a white selected-event ring.
- Replaced the remote vector style dependency with a controlled grayscale OSM raster base below the optional NASA GIBS imagery stack. This keeps the visual hierarchy predictable while retaining attribution.
- Kept camera focus explicit. Filter changes only replace the displayed evidence set; they never move the map. Selecting a queue item remains the sole automatic fly-to action.

### Verification

- Live desktop QA — national view displayed the NASA imagery, cyan 5-degree grid and labels, facility context, and 27 visible hotspot clusters computed from all 1,432 loaded detections.
- Cluster interaction QA — clicking a hotspot cluster expanded the map from zoom 3.4 to zoom 6.0 and recomputed 11 visible groups in the new viewport.
- Filter stability QA — switching to the 91-event Industrial filter changed the displayed marker set to six visible groups while preserving the camera exactly at `Z 6.0 · 24.7388°N · 74.0723°E`.
- Live browser diagnostics — no console warnings/errors and no map error event after the final rendering change.
- `npm run lint` — passed with zero warnings.
- `npm run build` — passed with TypeScript and static generation.

### Known limitations / next concrete task

- Cluster centers are display centroids for navigation, not event locations or incident claims; individual observations remain the authoritative coordinates.
- The current imagery date is fixed to the bundled 2026-09-01 snapshot. A later iteration should bind GIBS imagery dates to the active evidence window and expose scene/cloud metadata.
- OSM raster tiles and GIBS imagery are live visual dependencies. The event dataset remains deterministic offline, but a packaged offline basemap is still needed for a fully network-independent judging flow.

## 2026-09-02 — Temporal intelligence, alert triage, and analyst workspaces

### Objective

Advance the web product beyond the map by adding multi-day history, explainable persistence/anomaly features, dedicated alert/source/analytics stages, and portable analyst evidence briefs.

### Areas touched

- official seven-day FIRMS fixtures and their source documentation under `backend/data/samples`
- temporal fields and collection schemas in `backend/app/schemas/events.py`
- FIRMS normalization, recurrence, anomaly, classification, alert, and refresh behavior in `backend/app/services/firms.py`
- cluster/analytics aggregation in `backend/app/services/temporal.py`
- event-history, cluster, and dashboard API surfaces in `backend/app/api/events.py`
- cluster baseline persistence in `backend/app/services/persistence.py`
- backend API tests
- frontend API contracts/adapters, command-center navigation, alert/source/analytics workspaces, evidence panel, and styling
- README, research/reference glossary, and this living log

### Decisions and important implementation details

- Added official NOAA-20, NOAA-21, and S-NPP seven-day South Asia feeds as pinned offline fixtures. The public refresh path now targets these three files, while exact event fingerprints deduplicate overlap with retained 24-hour files.
- Kept the map operationally focused on the latest 24 hours relative to the snapshot's newest acquisition, while alerts, clusters, history, and analytics use the full retained temporal window. Relative-to-data filtering keeps the demo deterministic after the wall clock advances.
- Continued the approximate two-decimal coordinate cell for temporal grouping, but replaced raw degree-distance calculations with Haversine metres for spatial stability.
- Added active days, first/last seen, median FRP, MAD, daily history, anomaly status/score, and explicit model/feature versions to normalized evidence.
- Defined the configurable persistence score as 45% active-day ratio, 20% density, 20% spatial stability, and 15% multi-sensor support. Persistent candidates require at least four active days, a five-day-or-longer observed window, and score >= 0.65.
- Added a robust deviation gate requiring at least five detections and MAD >= 0.1 MW; the elevated label requires robust z >= 3 and FRP at least 5 MW above the observed median.
- Added alert reasons for elevated industrial-context candidates and persistent unmapped candidates. Every alert and cluster response retains human-review and non-confirmation language.
- Added `/events/{event_id}/history`, `/clusters`, `/clusters/{cluster_id}`, and `/analytics/dashboard` APIs, plus persistence baseline writes.
- Made all four header stages functional: Overview, Events/alert triage, Sources/provenance, and Analytics/persistent-cluster ranking. Notification and Sources controls navigate to the corresponding stage.
- Added client-side Markdown evidence-brief download containing the selected candidate's coordinates, measurements, temporal context, evidence sources, model/feature versions, and interpretation boundary.

### Verification performed and result

- Official seven-day fixture audit — 3,978 NOAA-20, 3,271 NOAA-21, and 3,717 S-NPP source rows; retained file sizes 328,749, 270,586, and 300,071 bytes.
- Running API smoke check — latest-24-hour map total 759; full temporal snapshot 4,143 events in 2,435 cells; 31 persistent candidates, 212 recurring candidates, two elevated clusters, one unmapped persistent candidate, and 50 review alerts.
- Event-history smoke check — returned the expected representative record, observation window, temporal series, robust features, provenance context, and explicit non-confirmation evidence.
- `.venv\\Scripts\\python.exe -m ruff check app tests` — passed.
- `.venv\\Scripts\\python.exe -m pytest -q` — 12 tests passed; one upstream Starlette/httpx TestClient deprecation warning remains.
- `npm run lint` — passed.
- `npm run build` — passed with strict TypeScript and Next.js static generation.
- Live browser QA — Overview loaded the current 759-event map window with temporal evidence; Events rendered 50 alert records; Sources rendered four attributed evidence-channel cards and current limitations; Analytics rendered eight inclusive calendar-date activity rows and 12 ranked persistent candidates.
- Live browser diagnostics after navigating all new stages — no fresh warnings or errors.

### Known limitations / next concrete task

- The retained rolling seven-day feed touches eight UTC calendar dates because its edge dates are partial. API responses expose exact start/end values; it must not be presented as eight complete days of coverage.
- Seven-day median/MAD features are observed-window comparisons, not learned 30/90-day facility baselines. The next temporal stage is scheduled archival ingestion and season-aware baselines.
- The approximate coordinate cell is deterministic but can split one physical source or merge adjacent sources. Replace it with metric DBSCAN or HDBSCAN and evaluate against labeled sites before claiming source-level accuracy.
- Land-cover sampling, weather/lightning corroboration, administrative-boundary clipping, alert acknowledgement state, and analyst feedback storage remain unimplemented.
- Alert and classification metrics are rule outputs on unlabeled evidence, not measured model performance.

## 2026-09-02 — Facility monitoring, historical playback, and alert lifecycle

### Objective

Complete three additional roadmap stages as functional web workflows: facility-centric thermal monitoring, historical observation playback, and analyst-controlled alert status.

### Areas touched

- alert, playback, and facility-monitor response schemas
- deterministic alert workflow state service under `backend/app/services/alert_workflow.py`
- facility aggregation service under `backend/app/services/facility_monitor.py`
- cumulative playback aggregation in `backend/app/services/temporal.py`
- FastAPI facility-monitor, playback, and alert-update endpoints
- backend API tests
- frontend types, API adapter/mutation client, primary navigation, alert controls, Monitor workspace, Playback workspace, and responsive styling
- README, research/reference glossary, and this living log

### Decisions and important implementation details

- Added a durable local alert-state overlay in the ignored `backend/data/cache` directory so acknowledgement works in deterministic offline mode without requiring PostgreSQL. The existing PostGIS alert schema remains the production persistence target.
- Implemented the four-state review lifecycle `requires_analyst_review → acknowledged → investigating → closed`, with reopening back to required review. Reviewer identity, note, and UTC timestamp are stored, but workflow state never changes classification confidence or source evidence.
- Built facility monitors only from FIRMS events that already meet the conservative industrial-context rule. Each monitor preserves the exact OSM feature, daily FRP history, sensor/cluster counts, active days, median/maximum/latest FRP, persistence score, review-alert count, and an explicit association caveat.
- Created stable opaque monitor IDs from OSM identifiers so facility detail routes do not expose slash-containing OSM keys as path segments.
- Added daily playback frames with event IDs, detection/cell/new-cell counts, high-FRP counts, daily mean FRP, and cumulative as-of-date persistent-cell counts. Persistence in playback is calculated only from dates observed up to the selected frame.
- Loaded the full retained event window separately from the 24-hour operational map window so playback can display each exact source observation while the default map remains focused on current evidence.
- Added `Monitor` and `Playback` to primary navigation. Facility selection updates the site chart/evidence in place; playback includes first/last, play/pause, and date-slider controls over the existing exact-coordinate map renderer.
- Upgraded alert rows with persistent Acknowledge, Investigate, Close, and Reopen actions plus live workflow counts.

### Verification performed and result

- Running API smoke check — eight UTC calendar-date playback frames over 4,143 events and 185 facility monitors; the first ranked monitor was an elevated-observed-FRP candidate in the retained evidence.
- `.venv\\Scripts\\python.exe -m ruff check app tests` — passed.
- `.venv\\Scripts\\python.exe -m pytest -q` — 15 tests passed, including alert state round-trip/reset, playback chronology/totals, and facility detail/caveat validation; one upstream Starlette/httpx warning remains.
- `npm run lint` — passed.
- `npm run build` — passed with strict TypeScript and Next.js static generation.
- Live browser facility QA — 100 ranked monitors loaded; selecting a different facility updated its name, status, four evidence metrics, and two-series FRP chart.
- Live browser playback QA — the latest frame displayed 568 detections, 323 newly observed cells, 42 persistent cells as-of-date, and 31 high-FRP signals; play advanced from frame one to frame two.
- Live browser alert QA — acknowledgement changed the first item to `acknowledged`, updated counts from 50/0 to 49/1, and exposed `Investigate` as the next action; the QA item was then reset to its original state.
- Browser diagnostics — no fresh warnings or errors across Monitor, Playback, and Events.

### Known limitations / next concrete task

- Local alert workflow storage is single-process file state. Production should persist reviews in PostGIS with authenticated user IDs, optimistic concurrency, and an audit history rather than overwriting the current state.
- Facility association still uses representative-point proximity, not facility polygon containment. A mapped nearby feature can be unrelated to an observation.
- The retained seven-day window supports demonstration playback, not seasonal analysis. Scheduled archival ingestion is required for 30/90-day playback and learned baselines.
- Playback is observation timing, not a fire-spread model. Cluster evolution metrics need validated spatial clustering before area-growth claims are introduced.
- Role-based access, analyst notes UI, notification delivery, land-cover enrichment, and measured model evaluation remain future stages.
