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
- `GET /api/v1/validation/reviews` — append-only local analyst-label audit records;
- `POST /api/v1/clusters/{cluster_id}/reviews` — snapshot evidence and append an analyst context label;
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
- explicit 30/90-day readiness indicators that do not claim a learned baseline before the archive supports one;
- deterministic India ADM0 point-in-polygon containment for both FIRMS detections and OSM facility context;
- OpenStreetMap proximity context for refineries, flares, power plants, steelmaking sites, and quarries;
- 2024 MCD12Q1.061 MODIS IGBP context sampled for every retained thermal cell, with an attributed map overlay and deterministic offline fixture;
- deterministic 750 m Haversine DBSCAN source grouping with explicit core/border/noise roles, stable membership-derived IDs, and reviewable noise singletons;
- cluster-quality diagnostics covering density support, radius distribution, and comparison with the superseded rounded-degree grouping;
- conservative evidence-backed triage and one review alert per metric cluster;
- seven-day active-day recurrence, spatial stability, multi-sensor support, and median/MAD anomaly features;
- category and text filtering;
- navigable overview, alert triage, evidence-source, and temporal-analytics workspaces;
- analyst validation workspace with satellite/grid context, a structured review packet, and append-only context labels that never confirm an incident;
- facility-monitor workspace with site selection, observed FRP history, evidence, and status;
- historical map playback with daily frames, newly observed cells, and cumulative recurrence;
- persisted local alert lifecycle for acknowledgement, investigation, closure, and reopening;
- event selection, temporal evidence drill-down, and downloadable Markdown evidence briefs;
- FRP, confidence, co-observation, and facility evidence;
- evidence-backed vegetation and agricultural candidates that retain the exact annual land-cover class and never claim incident confirmation;
- visible source attribution and safety labeling;
- responsive intelligence drawer on smaller screens;
- Alembic/PostGIS schema and batched snapshot persistence.

The checked-in source snapshots and India boundary make the full judging flow deterministic. Set `FIRMS_MAP_KEY` only for authenticated Area API refreshes; never commit it. Runtime archive files remain ignored by Git and can be mounted at `backend/data/archive`.

See `PROJECT_LOG.md` for implementation history and `RESEARCH_REFERENCE_GLOSSARY.md` for sources, assumptions, and terminology.
