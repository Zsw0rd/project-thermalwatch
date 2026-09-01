# ThermalWatch AI — Research, References, and Glossary

This file is the durable research notebook for the project. Verified facts, engineering assumptions, references, and difficult terms belong here.

## Research principles

- Put a source beside the claim it supports.
- Label tunable thresholds and heuristics as engineering assumptions, not scientific truth.
- Preserve source name and acquisition time on every displayed evidence item.
- Do not describe an industrial accident as confirmed without an authoritative confirming source.

## Primary references

### Problem and product context

- [Smart India Hackathon 2026 problem statements](https://www.sih.gov.in/sih2026PS) — source for SIH26162 and its expected industrial-fire/persistent-thermal-source outcome.

### Thermal detections

- [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/) — operational fire and thermal-anomaly information.
- [NASA FIRMS Academy](https://firms.modaps.eosdis.nasa.gov/academy) — learning material for interpretation, APIs, and visualization.
- [NASA FIRMS API](https://firms.modaps.eosdis.nasa.gov/api/) — live data access and MAP_KEY guidance.
- [VIIRS fire and thermal anomaly description](https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_VIIRS_Firehotspots.html) — meaning and limitations of the VIIRS hotspot product.
- [FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/) — verified API contract: a free MAP_KEY is required, the request uses a bounding box, and the supported day range is 1–5 days.
- [NOAA-20 South Asia 24-hour CSV](https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_Asia_24h.csv) — checked-in operational snapshot source.
- [NOAA-21 South Asia 24-hour CSV](https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_South_Asia_24h.csv) — checked-in operational snapshot source.
- [S-NPP South Asia 24-hour CSV](https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_Asia_24h.csv) — checked-in operational snapshot source.

### Industrial context

- [OpenStreetMap industrial land use](https://wiki.openstreetmap.org/wiki/Tag:landuse%3Dindustrial)
- [OpenStreetMap refinery tagging](https://wiki.openstreetmap.org/wiki/Tag:industrial%3Drefinery)
- [OpenStreetMap power plant tagging](https://wiki.openstreetmap.org/wiki/Tag:power%3Dplant)
- [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) — querying OSM objects by geometry and tags.
- [Public Overpass API instances](https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances) — verified endpoints used by the bounded refresh client with failover.
- [OpenStreetMap copyright and licence](https://www.openstreetmap.org/copyright) — OSM data attribution and Open Database License terms retained beside the snapshot and map context.

## 2026-09-01 verified source research and observed snapshot

- The official FIRMS Area API needs a free MAP_KEY and permits a 1–5 day request range. The implementation uses that path when a key is configured and otherwise uses NASA's official public 24-hour regional CSVs. [FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/)
- The three downloaded regional files produced 1,473 unique normalized observations inside the current India-oriented bounding box: 701 NOAA-20, 339 NOAA-21, and 433 S-NPP. This is an observed property of the retained 2026-09-01 snapshot, not a stable population estimate.
- The retained OSM Overpass result contains 23,375 supported features. Counts and coverage reflect mapping completeness and the exact query date; missing OSM evidence is not evidence that a facility is absent. [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)
- OSM ways and relations are currently represented by their Overpass-provided center for distance calculations. This is an engineering approximation and can differ substantially from distance to the real polygon boundary.
- 188 approximate grid cells contained multiple source observations in the snapshot. This is verified co-observation within a 24-hour regional feed, not verified recurrence across multiple days.
- 111 detections met the current conservative OSM proximity thresholds and are labeled industrial-context candidates. This is a likelihood cue only; facility proximity cannot confirm the cause of a thermal anomaly.

### Web and geospatial platform

- [Next.js App Router](https://nextjs.org/docs/app) — web application routing and rendering model.
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) — WebGL vector-map rendering and interactive layers.
- [OpenFreeMap](https://openfreemap.org/) — openly hosted vector map styles and tiles used by the current web MVP; visible map attribution remains enabled.
- [PostGIS documentation](https://postgis.net/documentation/) — spatial types, indexing, distance, containment, and clustering in PostgreSQL.
- [FastAPI documentation](https://fastapi.tiangolo.com/) — typed Python API service.

## Current engineering assumptions

These values are starting points and must be validated with real data:

- VIIRS 375 m is the primary MVP thermal source; MODIS is a later secondary source.
- Spatial recurrence will initially be evaluated within approximately 0.5–1.0 km, then tuned by sensor and validation region.
- The MVP taxonomy is `industrial`, `vegetation`, and `uncertain`; the UI can demonstrate more descriptive evidence-backed subtypes.
- Persistence combines recurrence, active days, spatial stability, and day/night consistency. Exact weights remain configurable.
- A deterministic cached dataset is part of the product, not temporary mock scaffolding, because it is required for a failure-safe demo.
- Current facility names and event outputs are fictionalized simulation scenarios. They validate product behavior but must never be cited as real detections or model performance.
- **Superseded for API-first mode:** operational event names are derived identifiers and facility names come from the attributed OSM snapshot. The earlier statement remains true only when the user switches to simulation fallback.
- Industrial-context thresholds are engineering assumptions: 3 km for refineries, flares, and steelmaking; 2 km for power plants and quarries. They are intentionally conservative starting values and require regional validation.
- Current alert thresholds are engineering assumptions: FRP >= 20 MW with industrial context or multi-source co-observation, otherwise FRP >= 50 MW. Alerts are triage items, not incident claims.

## Glossary

### Active fire / thermal anomaly

A satellite observation indicating unusually strong thermal radiation in a sensor pixel. It is evidence of heat, not automatic proof of a wildfire or industrial accident.

### Acquisition time

The time at which a satellite sensor captured an observation. FIRMS dates and times must be normalized into a single timezone, preferably UTC, before comparison.

### Bounding box (BBOX)

A rectangular geographic query area usually represented by west, south, east, and north coordinates.

### Candidate industrial-context anomaly

A thermal anomaly whose representative coordinate is within the configured distance of a supported mapped industrial feature. It describes proximity-based context, not causation and not a confirmed industrial fire.

### Co-observation

Multiple detections or sensor feeds associated with the same approximate grid cell in the current source window. Co-observation can corroborate that a thermal signal was recorded, but it is not the same as multi-day persistence.

### Brightness temperature

The temperature a perfect emitter would need to have to produce the measured radiance in a sensor band. It is derived from radiance and is not necessarily the physical surface temperature.

### CRS — Coordinate Reference System

The coordinate system used to locate geometries. Geographic latitude/longitude commonly uses EPSG:4326; metric distance calculations usually require geography operations or an appropriate projected CRS.

### DBSCAN

Density-Based Spatial Clustering of Applications with Noise. A clustering method that can group nearby detections without choosing the number of clusters in advance and can leave isolated observations as noise.

### Evidence graph

A human-readable explanation connecting a prediction to supporting facts such as facility proximity, land cover, recurrence, intensity, and spatial stability.

### FIRMS

NASA's Fire Information for Resource Management System. It distributes satellite-derived active-fire and thermal-anomaly observations.

### FRP — Fire Radiative Power

An estimate, commonly expressed in megawatts, of the rate of radiative energy emitted by an active fire or thermal source. FRP contributes evidence but cannot determine event type by itself.

### Geospatial enrichment

Adding contextual attributes to an observation through spatial relationships, such as whether it lies inside an industrial polygon or how far it is from a refinery.

### Ground truth

A high-confidence reference label used to evaluate a model. Rule-generated labels are weak labels and must not be presented as ground truth.

### Haversine distance

An approximate great-circle distance between two latitude/longitude positions on a sphere. It avoids applying ordinary flat Euclidean distance directly to raw degrees.

### Land cover

A description of the physical material at Earth's surface, such as forest, cropland, water, built-up area, or bare land.

### MAD — Median Absolute Deviation

A robust measure of variability that is less sensitive to extreme values than standard deviation. It can be used to flag unusual FRP relative to a facility's history.

### NRT — Near Real Time

Data delivered soon after observation but not necessarily immediately or with the same processing as archival science products.

### OSM / Overpass

OpenStreetMap is an open geographic database. Overpass is a query system used to retrieve selected OSM objects and tags for a region.

### Persistence score

A configurable score representing repeated, spatially stable thermal activity over time. It is an engineered indicator, not a universally standardized scientific measurement.

### Representative geometry center

A single point supplied or derived for an area feature such as a way or relation. It is computationally convenient for early proximity checks but does not represent the feature's complete boundary.

### Review alert

A deterministic prioritization record created when evidence crosses a configured threshold. In ThermalWatch, a review alert asks for analyst attention and never constitutes confirmation of a fire, accident, or responsible facility.

### Spatial grid index

A lookup structure that divides coordinates into fixed cells so nearby candidates can be searched without comparing every event to every facility. It improves runtime but does not itself create a scientific classification.

### PostGIS

A PostgreSQL extension that provides geometry/geography types, spatial indexes, and functions for distance, containment, intersection, and clustering.

### SHAP

SHapley Additive exPlanations. A method for estimating how individual input features contributed to a model prediction.

### Spatial leakage

Overly optimistic model evaluation caused when observations from the same physical source or nearby area occur in both training and test data.

### Simulation data

Representative, deliberately non-operational records created to exercise product behavior. Simulation data is suitable for UI and workflow testing but not for scientific validation, accuracy claims, or incident reporting.

### VIIRS

Visible Infrared Imaging Radiometer Suite. Its 375 m active-fire product is the planned primary FIRMS source for the MVP.

### Weak label

A provisional label produced by rules or indirect evidence, such as recurrence inside a refinery boundary. It is useful for bootstrapping but can contain errors.
