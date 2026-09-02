# ThermalWatch AI

ThermalWatch AI is an explainable geospatial intelligence platform for distinguishing industrial thermal anomalies, persistent industrial heat, vegetation fires, agricultural burning, and uncertain sources.

The current implementation is a web-first command center backed by an attributed NASA FIRMS snapshot and OpenStreetMap industrial context. It automatically falls back to an explicitly labeled deterministic simulation when the API is unavailable.

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
- `GET /api/v1/clusters` and `/clusters/{cluster_id}` — recurrence and anomaly candidate summaries;
- `GET /api/v1/analytics/summary` — snapshot statistics;
- `GET /api/v1/analytics/dashboard` — temporal activity and persistence analytics;
- `POST /api/v1/ingestion/firms/refresh` and `/osm/refresh` — refresh local caches;
- `POST /api/v1/ingestion/persist` — upsert the current snapshot into PostGIS.

## Current capabilities

- interactive national thermal-intelligence map;
- API-first NASA FIRMS snapshot mode with a deterministic simulation fallback;
- normalized NOAA-20, NOAA-21, and S-NPP VIIRS data with raw fields preserved server-side;
- OpenStreetMap proximity context for refineries, flares, power plants, steelmaking sites, and quarries;
- conservative evidence-backed triage and one review alert per approximate 1 km grid cell;
- seven-day active-day recurrence, spatial stability, multi-sensor support, and median/MAD anomaly features;
- category and text filtering;
- navigable overview, alert triage, evidence-source, and temporal-analytics workspaces;
- event selection, temporal evidence drill-down, and downloadable Markdown evidence briefs;
- FRP, confidence, co-observation, and facility evidence;
- visible source attribution and safety labeling;
- responsive intelligence drawer on smaller screens;
- Alembic/PostGIS schema and batched snapshot persistence.

The checked-in source snapshots make the full judging flow deterministic. Set `FIRMS_MAP_KEY` only for authenticated Area API refreshes; never commit it.

See `PROJECT_LOG.md` for implementation history and `RESEARCH_REFERENCE_GLOSSARY.md` for sources, assumptions, and terminology.
