# AegisFire

AegisFire is an explainable geospatial intelligence platform for distinguishing industrial thermal anomalies, persistent industrial heat, vegetation fires, agricultural burning, and uncertain sources.

The current implementation is a web-first command center backed by attributed NASA FIRMS snapshots, OpenStreetMap industrial context, NASA MODIS IGBP annual land cover, and a pinned geoBoundaries India ADM0 polygon. It automatically falls back to an explicitly labeled deterministic simulation when the API is unavailable.

## Quick start — API and web

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
```

In another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The API documentation is at `http://localhost:8000/docs`.

## Full local stack

Copy `.env.example` to `.env`, add credentials only when live ingestion is required, and run:

```powershell
docker compose up --build
```

- Web: `http://localhost:3000`
- API documentation: `http://localhost:8000/docs`
- API health: `http://localhost:8000/api/v1/health`

To opt into repeated NASA FIRMS refresh/archive cycles, start the scheduler profile. It runs one audited cycle immediately, then repeats at `FIRMS_REFRESH_INTERVAL_MINUTES` (six hours by default):

```powershell
docker compose --profile live-ingestion up --build
```

The scheduler uses the authenticated Area API when `FIRMS_MAP_KEY` is configured and the official public FIRMS feeds otherwise. Its cache, immutable archive, and audit file are mounted locally; failures record only the exception type so credentials never enter the audit.

## Operational API surfaces

- `GET /api/v1/events` — normalized, filterable NASA FIRMS events;
- `GET /api/v1/events/{event_id}/history` — cluster-level temporal evidence for one event;
- `GET /api/v1/events.geojson` — map-ready point features;
- `GET /api/v1/facilities` — attributed OSM industrial context;
- `GET /api/v1/alerts` — deterministic analyst-review queue, never incident confirmation;
- `PATCH /api/v1/alerts/{alert_id}` — acknowledge, investigate, close, or reopen a review item;
- `GET /api/v1/clusters` and `/clusters/{cluster_id}` — recurrence and anomaly candidate summaries;
- `GET /api/v1/facility-monitors` and `/facility-monitors/{monitor_id}` — facility-centric observed thermal history;
- `GET /api/v1/analytics/summary` — snapshot statistics;
- `GET /api/v1/analytics/dashboard` — temporal activity and persistence analytics;
- `GET /api/v1/clustering/diagnostics` — DBSCAN density, noise, radius, and legacy-grid comparison;
- `GET /api/v1/clustering/sensitivity` — eight deterministic epsilon/minimum-density variants with explicit non-accuracy caveats;
- `GET /api/v1/validation/reviews` — append-only local analyst-label audit records;
- `POST /api/v1/clusters/{cluster_id}/reviews` — snapshot evidence and append an analyst context label;
- `GET /api/v1/models/readiness` — reviewed-label counts, class/spatial coverage, and explicit deployment blockers;
- `GET /api/v1/models/benchmark` — reproducible development benchmark metadata and metrics, never automatic deployment;
- `GET /api/v1/models/registry` — serving/development lifecycle, artifact integrity, promotion policy, and rollback target;
- `GET /api/v1/events/{event_id}/evidence-graph` — attributed observation/context/reasoning links with an explicit interpretation boundary;
- `GET /api/v1/source-fingerprints` — observed-window thermal profiles for every analytical cluster;
- `GET /api/v1/discoveries/unknown` — ranked unresolved-source candidates, never asserted source identities;
- `GET /api/v1/operations/health` — source-file freshness, observation lag, archive readiness, scheduler cadence, and current issues;
- `GET /api/v1/operations/ingestion-runs` — append-only refresh/archive execution history;
- `GET /api/v1/playback` — cumulative daily observation frames;
- `GET /api/v1/history/readiness` — honest 30/90-day archive coverage telemetry;
- `GET /api/v1/geography/india` — attributed map-ready India ADM0 boundary;
- `GET /api/v1/land-cover/source` — MODIS IGBP source metadata and limitations;
- `POST /api/v1/ingestion/firms/refresh`, `/osm/refresh`, and `/land-cover/refresh` — refresh local caches;
- `POST /api/v1/ingestion/firms/archive-current` — archive the current raw FIRMS files without a network request;
- `POST /api/v1/ingestion/persist` — upsert the current snapshot into PostGIS.

## Current capabilities

- interactive national thermal-intelligence map;
- API-first NASA FIRMS snapshot mode with a deterministic simulation fallback;
- normalized NOAA-20, NOAA-21, and S-NPP VIIRS data with raw fields preserved server-side;
- automatic content-addressed raw-FIRMS archival on every successful refresh, with overlap-safe event deduplication;
- opt-in scheduled FIRMS refreshes with cross-process-safe local audit records and explicit source freshness/lag telemetry;
- explicit 30/90-day readiness indicators that do not claim a learned baseline before the archive supports one;
- deterministic India ADM0 point-in-polygon containment for both FIRMS detections and OSM facility context;
- OpenStreetMap proximity context for refineries, flares, power plants, steelmaking sites, and quarries;
- 2024 MCD12Q1.061 MODIS IGBP context sampled for every retained thermal cell, with an attributed map overlay and deterministic offline fixture;
- deterministic 750 m Haversine DBSCAN source grouping with explicit core/border/noise roles, stable membership-derived IDs, and reviewable noise singletons;
- cluster-quality diagnostics covering density support, radius distribution, and comparison with the superseded rounded-degree grouping;
- non-blocking DBSCAN sensitivity evaluation across 500–1,500 m and two-/three-sample density settings, including noise, radius, largest-cluster, border-role, and co-membership stability diagnostics;
- conservative evidence-backed triage and one review alert per metric cluster;
- seven-day active-day recurrence, spatial stability, multi-sensor support, and median/MAD anomaly features;
- category and text filtering;
- navigable overview, alert triage, evidence-source, and temporal-analytics workspaces;
- unknown-source discovery workspace with a satellite/grid candidate map, stable evidence fingerprints, ranked review priority, timing/FRP/spatial bands, and explicit uncertainty;
- analyst validation workspace with satellite/grid context, a structured review packet, and append-only context labels that never confirm an incident;
- governed Models workspace with reviewed-label gates, spatial-holdout diagnostics, confusion matrix, feature signals, and captured GPU provenance;
- versioned model registry with one serving rules model, ignored offline artifacts, integrity digests, explicit promotion controls, rollback target, and downloadable governance brief;
- per-event explainable evidence graph connecting attributed FIRMS, temporal, spatial, OSM, and MODIS signals to the conservative candidate label and non-confirmation boundary;
- facility-monitor workspace with site selection, observed FRP history, evidence, and status;
- historical map playback with daily frames, newly observed cells, and cumulative recurrence;
- persisted local alert lifecycle for acknowledgement, investigation, closure, and reopening;
- event selection, temporal evidence drill-down, and downloadable Markdown evidence briefs;
- FRP, confidence, co-observation, and facility evidence;
- evidence-backed vegetation and agricultural candidates that retain the exact annual land-cover class and never claim incident confirmation;
- visible source attribution and safety labeling;
- responsive intelligence drawer and complete mobile workspace navigation;
- Alembic/PostGIS schema and batched snapshot persistence.

## Reproducible model benchmark

Model training is an optional development stage. Install the pinned ML extras and run from `backend` so the API settings and deterministic evidence snapshot resolve consistently:

```powershell
.\.venv\Scripts\python.exe -m pip install -e ".[dev,ml]"
.\.venv\Scripts\python.exe ..\ml\train_tabular.py --label-source weak --device auto
```

`--device auto` uses an available NVIDIA GPU for XGBoost and otherwise records a CPU fallback. `--device cuda` requires CUDA training to succeed. The script compares the current rules reference with logistic regression, random forest, and XGBoost, holds out complete two-degree spatial blocks, writes the inspectable report to `backend/data/samples/model_benchmark_report.json`, and keeps binary artifacts under ignored `ml/models/`.

The bundled report uses rule-derived weak labels because no eligible analyst reviews exist yet. Its metrics are **held-out weak-label agreement, not validation accuracy**. A 100% result can mean that a model learned to reproduce the existing rules. The operational classifier therefore remains `rules_temporal_metric_v3`; reviewed-model training is blocked until at least 60 eligible clusters, 10 per class, and coverage across three spatial blocks per class are collected. Once that gate is satisfied, run the same command with `--label-source reviewed` and review the resulting report before any separate deployment decision.

The checked-in source snapshots and India boundary make the full judging flow deterministic. Set `FIRMS_MAP_KEY` only for authenticated Area API refreshes; never commit it. Runtime archive files remain ignored by Git and can be mounted at `backend/data/archive`.

See `PROJECT_LOG.md` for implementation history and `RESEARCH_REFERENCE_GLOSSARY.md` for sources, assumptions, and terminology.
