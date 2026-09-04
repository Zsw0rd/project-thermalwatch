# AegisFire — Research, References, and Glossary

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
- [NASA FIRMS Area API use](https://firms.modaps.eosdis.nasa.gov/content/academy/data_api/firms_api_use.html) — official request format, historical-date parameter, and data-availability workflow.
- [VIIRS fire and thermal anomaly description](https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_VIIRS_Firehotspots.html) — meaning and limitations of the VIIRS hotspot product.
- [FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/) — verified API contract: a free MAP_KEY is required, the request uses a bounding box, and the supported day range is 1–5 days.
- [NOAA-20 South Asia 24-hour CSV](https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_Asia_24h.csv) — checked-in operational snapshot source.
- [NOAA-21 South Asia 24-hour CSV](https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_South_Asia_24h.csv) — checked-in operational snapshot source.
- [S-NPP South Asia 24-hour CSV](https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_Asia_24h.csv) — checked-in operational snapshot source.
- [NOAA-20 South Asia seven-day CSV](https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_Asia_7d.csv) — checked-in temporal snapshot source.
- [NOAA-21 South Asia seven-day CSV](https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_South_Asia_7d.csv) — checked-in temporal snapshot source.
- [S-NPP South Asia seven-day CSV](https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_Asia_7d.csv) — checked-in temporal snapshot source.
- [NASA GIBS WMTS dataset](https://data.nasa.gov/dataset/gibs-web-map-tile-service-wmts) — standards-based imagery tile service used for the optional satellite map context.
- [FIRMS GIBS integration guide](https://firms.modaps.eosdis.nasa.gov/content/tutorials/gibs/) — NASA guidance connecting FIRMS workflows with GIBS imagery and thermal-anomaly layers.
- [MCD12Q1.061 MODIS Terra+Aqua yearly land cover](https://data.nasa.gov/dataset/modis-terraaqua-land-cover-type-yearly-l3-global-500m-sin-grid-v061-fac3a) — official description of the yearly global 500 m land-cover product and its IGBP classification scheme.
- [NASA GIBS MODIS IGBP layer metadata](https://gibs.earthdata.nasa.gov/layer-metadata/v1.0/MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual.json) — machine-readable source metadata for the annual raster exposed in the web map and sampled by the enrichment service.
- [NASA GIBS MODIS IGBP color map](https://gibs.earthdata.nasa.gov/colormaps/v1.3/output/MODIS_IGBP_Land_Cover_Type.html) — authoritative categorical color-to-class legend used to interpret sampled raster pixels.

### Industrial context

- [OpenStreetMap industrial land use](https://wiki.openstreetmap.org/wiki/Tag:landuse%3Dindustrial)
- [OpenStreetMap refinery tagging](https://wiki.openstreetmap.org/wiki/Tag:industrial%3Drefinery)
- [OpenStreetMap power plant tagging](https://wiki.openstreetmap.org/wiki/Tag:power%3Dplant)
- [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) — querying OSM objects by geometry and tags.
- [Public Overpass API instances](https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances) — verified endpoints used by the bounded refresh client with failover.
- [OpenStreetMap copyright and licence](https://www.openstreetmap.org/copyright) — OSM data attribution and Open Database License terms retained beside the snapshot and map context.

### Administrative geography

- [geoBoundaries India ADM0 metadata](https://www.geoboundaries.org/api/current/gbOpen/IND/ADM0/) — verified metadata for the open India country-level boundary: boundary ID `IND-ADM0-67634026`, represented year 2014, and CC0 1.0 license.
- [Pinned geoBoundaries India ADM0 GeoJSON](https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IND/ADM0/geoBoundaries-IND-ADM0.geojson) — exact full-resolution MultiPolygon retained for deterministic offline containment and map rendering.

## 2026-09-01 verified source research and observed snapshot

- The official FIRMS Area API needs a free MAP_KEY and permits a 1–5 day request range. The implementation uses that path when a key is configured and otherwise uses NASA's official public 24-hour regional CSVs. [FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/)
- The three downloaded regional files produced 1,473 unique normalized observations inside the current India-oriented bounding box: 701 NOAA-20, 339 NOAA-21, and 433 S-NPP. This is an observed property of the retained 2026-09-01 snapshot, not a stable population estimate.
- The retained OSM Overpass result contains 23,375 supported features. Counts and coverage reflect mapping completeness and the exact query date; missing OSM evidence is not evidence that a facility is absent. [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)
- OSM ways and relations are currently represented by their Overpass-provided center for distance calculations. This is an engineering approximation and can differ substantially from distance to the real polygon boundary.
- 188 approximate grid cells contained multiple source observations in the snapshot. This is verified co-observation within a 24-hour regional feed, not verified recurrence across multiple days.
- 111 detections met the current conservative OSM proximity thresholds and are labeled industrial-context candidates. This is a likelihood cue only; facility proximity cannot confirm the cause of a thermal anomaly.

## 2026-09-02 map rendering and imagery research

- NASA GIBS exposes imagery through WMTS in Web Mercator as well as other projections. The map uses the keyless `BlueMarble_NextGeneration` layer as a visual fallback and the S-NPP VIIRS corrected-reflectance true-color layer dated 2026-09-01 above it. [NASA GIBS WMTS dataset](https://data.nasa.gov/dataset/gibs-web-map-tile-service-wmts)
- Direct tile checks for the India test tile returned HTTP 200 and `image/jpeg` from both GIBS layers on 2026-09-02.
- Satellite imagery is contextual basemap information only in the current release. It is not sampled into event features, does not change classification confidence, and must not be cited as corroborating an incident.
- Thermal points now remain in their original `[longitude, latitude]` GeoJSON coordinates. MapLibre clusters them in screen space only through zoom 8 and expands to individual source points at higher zoom; the underlying coordinates are never randomized or displaced.
- The 5-degree coordinate grid is a geographic GeoJSON layer above terrain or satellite imagery. It is for map reading and visual orientation, not the approximately 1 km analytical grid used for event co-observation.

## 2026-09-02 temporal-source research and observed window

- HTTP checks and downloads verified the three official public South Asia seven-day CSV endpoints for NOAA-20, NOAA-21, and S-NPP. The retained files contain 3,978, 3,271, and 3,717 regional source rows respectively. These are observed file properties on 2026-09-02, not stable expected volumes. [NOAA-20 seven-day CSV](https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_Asia_7d.csv), [NOAA-21 seven-day CSV](https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_South_Asia_7d.csv), [S-NPP seven-day CSV](https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_Asia_7d.csv)
- After bounding-box filtering and stable fingerprint deduplication, the current API snapshot contains 4,143 observations in 2,435 approximate one-kilometre cells. Thirty-one cells meet the current persistent-candidate rule, 212 meet the recurring-candidate rule, and two have an elevated robust FRP deviation. These counts are a reproducible property of the retained snapshot and current engineering rules, not validation metrics.
- The rolling source product spans parts of eight UTC calendar dates in this retrieval. The API therefore reports an eight-day inclusive calendar window while product copy retains the more precise description “seven-day feed.”
- A median/MAD deviation is only calculated for cells with at least five observations and MAD of at least 0.1 MW. “Elevated” currently means robust z-score of at least 3 plus at least 5 MW above the median. These are conservative engineering thresholds requiring empirical validation.
- The current baseline is an observed seven-day distribution, not a learned facility operating baseline. It is useful for candidate ranking, but cannot establish that behavior is abnormal in a seasonal or operational sense.

## 2026-09-02 MODIS land-cover source research and observed enrichment

- NASA describes MCD12Q1.061 as a yearly global 500 m product containing multiple land-cover schemes, including the International Geosphere-Biosphere Programme classification used here. [MCD12Q1.061 product record](https://data.nasa.gov/dataset/modis-terraaqua-land-cover-type-yearly-l3-global-500m-sin-grid-v061-fac3a)
- The official GIBS Web Mercator capabilities advertised `MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual` with 2024-01-01 as the default/latest complete date at verification time and `GoogleMapsCompatible_Level8` as its maximum named tile matrix. This is a verified service property on 2026-09-02, not a promise that 2024 will remain the latest date. [GIBS layer metadata](https://gibs.earthdata.nasa.gov/layer-metadata/v1.0/MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual.json)
- Direct pixel checks using standard Web Mercator addressing returned expected categorical colors: Mumbai and Delhi sampled as urban/built-up, a Western Ghats test coordinate as evergreen broadleaf forest, a Thar coordinate as open shrubland, and a Bengal coordinate as cropland. These checks validate addressing and color interpretation; they are not an accuracy assessment of MCD12Q1.
- The retained enrichment sampled 2,435 approximate thermal cells from 153 GIBS tiles. All 4,143 current FIRMS observations received a context because repeated observations share the same rounded two-decimal analytical cell.
- **Engineering assumption:** IGBP classes 1–11 are grouped as vegetation context, 12 and 14 as cropland, 13 as built-up, 15 as snow/ice, 16 as barren, and 0/17 as water. These groupings support candidate routing and must not be interpreted as physical source confirmation.
- **Engineering assumption:** land cover is applied only after conservative mapped-facility and high-recurrence rules. This precedence protects stronger evidence from being overwritten by an annual surface class.
- The MCD12Q1 product record cautions that training-sample changes affect post-2021 continuity. The 2024 categorical layer should therefore be treated as current context rather than a directly comparable long-run trend without additional validation. [MCD12Q1.061 product record](https://data.nasa.gov/dataset/modis-terraaqua-land-cover-type-yearly-l3-global-500m-sin-grid-v061-fac3a)

## 2026-09-03 archival and administrative-boundary research

- The FIRMS Area API path accepts an optional historical date after `DAY_RANGE`; `DAY_RANGE` is limited to 1–5, and a dated request covers the supplied date through date plus range minus one. AegisFire therefore accumulates immutable refresh snapshots rather than pretending one request supplies a 30/90-day history. [NASA FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/), [official FIRMS API tutorial](https://firms.modaps.eosdis.nasa.gov/content/academy/data_api/firms_api_use.html)
- **Engineering decision:** each successful raw CSV download is copied byte-for-byte to a UTC-date/content-hash path. Stable event fingerprints deduplicate overlapping rolling snapshots during normalization. This preserves source rows while avoiding double counting.
- **Engineering decision:** readiness is the number of distinct UTC acquisition dates present after deduplication, not the inclusive span alone. Thirty- and ninety-day progress are coverage indicators; neither establishes a trained or seasonally representative baseline.
- The pinned geoBoundaries feature is a one-feature `MultiPolygon` for India, with source metadata reporting represented year 2014 and CC0 1.0 licensing. It is used as an application containment boundary, not as a territorial claim. [geoBoundaries metadata](https://www.geoboundaries.org/api/current/gbOpen/IND/ADM0/)
- A deterministic ray-casting point-in-polygon test, including polygon holes and boundary segments, now clips both FIRMS points and OSM representative points after the broader source retrieval. Known checks retain New Delhi, Bengaluru, and Port Blair while excluding Lahore, Dhaka, and Colombo.
- After India ADM0 containment, the retained source window contains 1,566 unique FIRMS detections in 922 approximate cells and 14,543 supported OSM representative points. These are reproducible properties of the pinned 2026-09-02 snapshots and boundary, not stable national totals or completeness measures.

## 2026-09-03 metric clustering and analyst-validation research

- DBSCAN was introduced as a density-based method that discovers spatial clusters of arbitrary shape and distinguishes low-density noise without requiring the number of clusters in advance. Its two primary density parameters are a neighbourhood radius (`Eps`) and minimum neighbourhood cardinality (`MinPts`). [Ester, Kriegel, Sander, and Xu, “A Density-Based Algorithm for Discovering Clusters in Large Spatial Databases with Noise” (KDD-96)](https://file.biolab.si/papers/1996-DBSCAN-KDD.pdf)
- PostGIS exposes the same model through `ST_ClusterDBSCAN` as a two-dimensional window function. Its documentation defines core, border, and noise geometries, returns `NULL` for noise, and warns that ambiguous border assignment can vary unless window ordering is specified. This is the intended production-database equivalent of the current typed Python service. [PostGIS `ST_ClusterDBSCAN` documentation](https://postgis.net/docs/manual-3.3/ST_ClusterDBSCAN.html)
- **Engineering decision:** AegisFire operational grouping now uses deterministic ID ordering, exact Haversine neighbour checks, a 750 m epsilon, and `min_samples=2`. These values fall inside the roadmap’s initial 0.5–1.0 km range but are not scientifically validated thresholds.
- **Engineering decision:** DBSCAN noise is preserved as a singleton analytical cluster with the explicit role `noise`, rather than being discarded. This differs from PostGIS’s `NULL` noise return and ensures every raw FIRMS observation remains available to map, playback, and human review.
- **Engineering decision:** cluster IDs are hashes of sorted member event IDs. They are reproducible for identical evidence, but can change when later archive snapshots join, split, or extend a cluster. Review records therefore snapshot the evidence and feature/model versions visible at annotation time.
- Current pinned evidence produces 777 metric analytical clusters from 1,566 deduplicated detections: 256 multi-event density-supported clusters and 521 noise singletons. The superseded rounded-degree method produced 922 cells. These are reproducible engineering diagnostics for the current snapshot, not accuracy metrics or source-count truth.
- The analyst validation surface stores append-only context labels (`likely_industrial`, `likely_vegetation`, `likely_agricultural`, `likely_other`, `uncertain`, or `exclude_data_quality`) with evidence snapshots. Labels remain analyst assessments and explicitly never confirm a fire, accident, causation, or responsible facility.

### Web and geospatial platform

- [Next.js App Router](https://nextjs.org/docs/app) — web application routing and rendering model.
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) — WebGL vector-map rendering and interactive layers.
- [OpenFreeMap](https://openfreemap.org/) — openly hosted vector map styles and tiles used by the current web MVP; visible map attribution remains enabled.
- [PostGIS documentation](https://postgis.net/documentation/) — spatial types, indexing, distance, containment, and clustering in PostgreSQL.
- [FastAPI documentation](https://fastapi.tiangolo.com/) — typed Python API service.

## Current engineering assumptions

These values are starting points and must be validated with real data:

- VIIRS 375 m is the primary MVP thermal source; MODIS is a later secondary source.
- **Superseded for operational API mode:** spatial recurrence was planned within approximately 0.5–1.0 km. It is now implemented as 750 m Haversine DBSCAN with a two-point density threshold, pending tuning by sensor and reviewed region.
- The MVP taxonomy is `industrial`, `vegetation`, and `uncertain`; the UI can demonstrate more descriptive evidence-backed subtypes.
- **Superseded for operational API mode:** the operational taxonomy now includes `industrial`, `vegetation`, `agricultural`, and `unknown`. Vegetation/agricultural values remain weak candidate labels derived partly from annual MODIS IGBP context, not ground truth.
- Persistence combines recurrence, active days, spatial stability, and day/night consistency. Exact weights remain configurable.
- A deterministic cached dataset is part of the product, not temporary mock scaffolding, because it is required for a failure-safe demo.
- Current facility names and event outputs are fictionalized simulation scenarios. They validate product behavior but must never be cited as real detections or model performance.
- **Superseded for API-first mode:** operational event names are derived identifiers and facility names come from the attributed OSM snapshot. The earlier statement remains true only when the user switches to simulation fallback.
- Industrial-context thresholds are engineering assumptions: 3 km for refineries, flares, and steelmaking; 2 km for power plants and quarries. They are intentionally conservative starting values and require regional validation.
- Current alert thresholds are engineering assumptions: FRP >= 20 MW with industrial context or multi-source co-observation, otherwise FRP >= 50 MW. Alerts are triage items, not incident claims.
- Current persistence weights are engineering assumptions: 45% active-day ratio, 20% detection density, 20% spatial stability, and 15% multi-sensor support. A persistent candidate additionally requires at least four active days in a window of at least five days and score >= 0.65.
- Facility monitors include only observations already promoted by the conservative industrial-context proximity rule. Their status describes observed thermal evidence near an OSM feature; it is not a facility operating-state claim.
- **Superseded grouping detail:** playback's `active_persistent_cells` was originally calculated from rounded-degree cells. It is now calculated as-of each frame from metric DBSCAN clusters observed on at least four distinct dates; both the four-date threshold and clustering parameters remain engineering assumptions.
- Alert lifecycle state is analyst workflow metadata, not additional physical evidence. Acknowledging, investigating, or closing an item must never increase classification confidence.

## Glossary

### Active fire / thermal anomaly

A satellite observation indicating unusually strong thermal radiation in a sensor pixel. It is evidence of heat, not automatic proof of a wildfire or industrial accident.

### Acquisition time

The time at which a satellite sensor captured an observation. FIRMS dates and times must be normalized into a single timezone, preferably UTC, before comparison.

### Bounding box (BBOX)

A rectangular geographic query area usually represented by west, south, east, and north coordinates.

### Administrative containment

A point-in-polygon test that retains a record only when its coordinate lies inside a selected administrative boundary. AegisFire uses it after broad rectangular retrieval; it does not resolve political disputes or validate the source coordinate.

### Baseline readiness

Coverage telemetry showing how much distinct-date evidence has accumulated toward a proposed baseline window. It is not a claim that a statistical baseline has been trained, validated, or made seasonally representative.

### Content-addressed archive

An immutable storage layout whose path includes a digest of file contents. Identical refresh files resolve to the same snapshot path, while changed source bytes create a separate retained version.

### Candidate industrial-context anomaly

A thermal anomaly whose representative coordinate is within the configured distance of a supported mapped industrial feature. It describes proximity-based context, not causation and not a confirmed industrial fire.

### Co-observation

Multiple detections or sensor feeds associated with the same approximate grid cell in the current source window. Co-observation can corroborate that a thermal signal was recorded, but it is not the same as multi-day persistence.

**Superseded grouping detail (2026-09-03):** operational co-observation is now evaluated inside a 750 m Haversine DBSCAN analytical cluster rather than a rounded-degree cell. The evidentiary boundary is unchanged: co-observation supports sensor corroboration, not source identity or incident confirmation.

### Alert acknowledgement workflow

The human-review state attached to a generated alert: requires review, acknowledged, investigating, or closed. It records workflow progress only and does not validate the alert's interpretation.

### Brightness temperature

The temperature a perfect emitter would need to have to produce the measured radiance in a sensor band. It is derived from radiance and is not necessarily the physical surface temperature.

### CRS — Coordinate Reference System

The coordinate system used to locate geometries. Geographic latitude/longitude commonly uses EPSG:4326; metric distance calculations usually require geography operations or an appropriate projected CRS.

### DBSCAN

Density-Based Spatial Clustering of Applications with Noise. A clustering method that can group nearby detections without choosing the number of clusters in advance and can leave isolated observations as noise.

Implementation update (2026-09-03, engineering decision): AegisFire performs deterministic DBSCAN with Haversine distances, a 750 m epsilon, and two-point minimum density. It retains noise as labelled singletons so no source record disappears from review.

### Core point

In DBSCAN, an observation whose epsilon neighbourhood contains at least the configured minimum number of observations, including itself. Core points can expand a density-connected cluster.

### Border point

In DBSCAN, a non-core observation that falls within the epsilon neighbourhood of a core point. A border point belongs to a supported cluster but cannot expand it on its own.

### Epsilon (`eps`)

The maximum neighbour distance used by DBSCAN. AegisFire currently uses 750 m great-circle distance as an unvalidated engineering starting point.

### Minimum samples (`MinPts` / `min_samples`)

The number of observations, including the observation itself, required for a DBSCAN core point. AegisFire currently uses two so repeat co-locations become density-supported while isolated detections remain explicit noise.

### Noise observation

A DBSCAN observation that is not density-reachable from a core point. AegisFire retains it as a singleton analytical cluster with role `noise`; retention does not turn it into a supported physical source.

### Analyst validation label

A human assessment of the most supportable source-context category for a cluster based on the displayed evidence packet. It is useful for later evaluation or supervised learning, but it is not incident confirmation or causation evidence.

### Evidence snapshot

An immutable copy of the metrics, context, provenance, and model/feature versions visible when an analyst recorded a label. It keeps the audit interpretable even if future ingestion changes the live cluster membership or classification.

### Evidence graph

A human-readable explanation connecting a prediction to supporting facts such as facility proximity, land cover, recurrence, intensity, and spatial stability.

### FIRMS

NASA's Fire Information for Resource Management System. It distributes satellite-derived active-fire and thermal-anomaly observations.

### Facility monitor

A facility-centric aggregation of FIRMS observations that meet the configured proximity rule for one mapped OSM feature. The monitor summarizes evidence near that feature; it does not establish ownership, causation, or the facility's real operating condition.

### FRP — Fire Radiative Power

An estimate, commonly expressed in megawatts, of the rate of radiative energy emitted by an active fire or thermal source. FRP contributes evidence but cannot determine event type by itself.

### Geospatial enrichment

Adding contextual attributes to an observation through spatial relationships, such as whether it lies inside an industrial polygon or how far it is from a refinery.

### Point-in-polygon

A spatial test that determines whether a coordinate falls inside a polygon's exterior ring and outside any holes. It is used here for national-scope filtering, independent of the map's visual zoom or screen-space clustering.

### Ground truth

A high-confidence reference label used to evaluate a model. Rule-generated labels are weak labels and must not be presented as ground truth.

### Haversine distance

An approximate great-circle distance between two latitude/longitude positions on a sphere. It avoids applying ordinary flat Euclidean distance directly to raw degrees.

### Historical observation playback

A sequence of UTC-date frames showing when retained FIRMS observations were acquired. It supports temporal comparison but is not a reconstruction of confirmed fire spread or incident evolution.

### Land cover

A description of the physical material at Earth's surface, such as forest, cropland, water, built-up area, or bare land.

### Categorical raster

A pixel grid in which each stored value represents a named class rather than a continuously measured quantity. Interpolation is inappropriate for IGBP classes; AegisFire samples the nearest rendered category color at each event cell.

### GIBS — Global Imagery Browse Services

NASA EOSDIS services that expose many Earth-observation layers through tiled web-map interfaces such as WMTS. AegisFire uses GIBS for visual imagery and the annual MODIS IGBP context layer.

### IGBP land-cover classification

The International Geosphere-Biosphere Programme class scheme included in MCD12Q1, covering categories such as forests, shrublands, savannas, grasslands, wetlands, croplands, built-up land, snow/ice, barren land, and water.

### MCD12Q1

The combined Terra and Aqua MODIS yearly global land-cover product used for the current annual contextual classification. AegisFire currently samples the Version 6.1 IGBP layer dated 2024-01-01.

### Mixed pixel

A raster pixel whose footprint contains more than one real-world surface type. A single categorical class can simplify that mixture, especially near coasts, fields, settlements, and other boundaries.

### MAD — Median Absolute Deviation

A robust measure of variability that is less sensitive to extreme values than standard deviation. It can be used to flag unusual FRP relative to a facility's history.

### NRT — Near Real Time

Data delivered soon after observation but not necessarily immediately or with the same processing as archival science products.

### Observed baseline

A summary calculated only from the retained evidence window—for example, a seven-day median FRP and MAD. It is not a trained or seasonally representative facility baseline and must not be described as normal operating behavior.

### OSM / Overpass

OpenStreetMap is an open geographic database. Overpass is a query system used to retrieve selected OSM objects and tags for a region.

### Persistence score

A configurable score representing repeated, spatially stable thermal activity over time. It is an engineered indicator, not a universally standardized scientific measurement.

### Persistent-source candidate

An approximate spatial cell that crosses the configured active-day and persistence-score thresholds. It prioritizes repeated thermal activity for review; it does not prove that one physical source caused every observation or that an incident occurred.

Implementation update (2026-09-03): the “approximate spatial cell” in this definition is now a metric DBSCAN analytical cluster rather than a rounded latitude/longitude cell.

### Representative geometry center

A single point supplied or derived for an area feature such as a way or relation. It is computationally convenient for early proximity checks but does not represent the feature's complete boundary.

### Review alert

A deterministic prioritization record created when evidence crosses a configured threshold. In AegisFire, a review alert asks for analyst attention and never constitutes confirmation of a fire, accident, or responsible facility.

### Robust z-score

A standardized deviation estimated with the median and scaled MAD instead of the mean and standard deviation. It reduces sensitivity to extreme observations but still depends on sample size and the representativeness of the observed window.

### Spatial grid index

A lookup structure that divides coordinates into fixed cells so nearby candidates can be searched without comparing every event to every facility. It improves runtime but does not itself create a scientific classification.

### Screen-space clustering

A map-rendering technique that visually groups nearby point symbols based on their pixel distance at the current zoom. Expanding a cluster reveals the unchanged source coordinates; it does not alter, average, or relabel the underlying observations.

Implementation update (2026-09-02, engineering decision): AegisFire now derives display buckets from MapLibre's active Web Mercator projection on every pan/zoom and draws them in a synchronized canvas overlay. The cluster center is a navigation centroid only; the underlying FIRMS longitude/latitude values are preserved and individual records are drawn at exact source coordinates at close zoom. This is an application behavior verified in the local browser, not a scientific inference about the observations.

### Web Mercator

The projected coordinate system commonly used by interactive web maps. MapLibre projects source longitude/latitude coordinates into this display space while the application continues to retain the original EPSG:4326 coordinates as evidence.

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

## 2026-09-03 — Model evaluation and GPU training research

### Verified external facts

- XGBoost's official GPU examples configure histogram training with `tree_method="hist"` and `device="cuda"`. AegisFire follows that supported interface and records the resolved booster device rather than inferring GPU use from hardware presence alone. Source: [XGBoost GPU training example](https://xgboost.readthedocs.io/en/release_2.0.0/python/dask-examples/sklearn_gpu_training.html).
- Scikit-learn's `GroupShuffleSplit` separates data according to supplied groups, and its `test_size` refers to groups rather than individual samples. AegisFire supplies spatial-block IDs and checks that the resulting train/test group intersection is empty. Source: [scikit-learn GroupShuffleSplit documentation](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.GroupShuffleSplit.html).
- Balanced accuracy is the average recall obtained on each class, making it more informative than raw accuracy when classes are imbalanced. AegisFire reports it alongside macro F1 and industrial-class precision/recall. Source: [scikit-learn balanced accuracy documentation](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.balanced_accuracy_score.html).
- Local runtime observation: the development benchmark resolved XGBoost training to `cuda:0` on an NVIDIA GeForce RTX 3060 with 12,288 MiB reported memory and driver 595.79. This is reproducibility metadata for the local run, not a general system requirement or a performance guarantee.

### Engineering assumptions and current controls

- Two-degree latitude/longitude blocks are the current coarse geographic grouping for development evaluation. They eliminate direct block overlap under the current split but do not establish independence between nearby regions or seasonal generalization.
- The first reviewed-model readiness gate requires at least 60 eligible reviewed clusters, at least 10 in each of the four target classes, and at least three distinct spatial groups per class. These are conservative workflow thresholds, not statistically validated sample-size guarantees.
- Only the latest eligible analyst label per cluster is admitted to reviewed training. `uncertain` and `exclude_data_quality` remain in the audit history but are excluded from the training target.
- Raw latitude and longitude are intentionally absent from the 41-feature tabular contract to reduce direct geographic memorization. Spatial context still enters indirectly through land cover and mapped-facility evidence, so spatially separated evaluation remains required.
- The bundled benchmark uses deterministic rule outputs as weak labels. Its scores measure rule reproduction on held-out spatial groups and must never be described as real-world accuracy, ground-truth validation, or production readiness.
- Candidate selection in the current report is development metadata only. A trained binary is never loaded into operational inference automatically; the operational classifier remains `rules_temporal_metric_v3` until a separate reviewed evaluation and deployment decision occur.

### Grouped spatial holdout

An evaluation split that assigns complete geographic groups to either training or testing so the same group cannot occur in both. It reduces direct spatial leakage but does not by itself prove transfer to unseen climates, seasons, sensors, or facility types.

### Balanced accuracy

The arithmetic mean of recall across target classes. It gives small classes equal influence in the summary score, but it must still be interpreted with class-specific precision, recall, support, and the confusion matrix.

### Weak-label agreement

The fraction or class-balanced score with which a model reproduces labels generated by an existing heuristic or rule system. High agreement can demonstrate that the pipeline learns the rules, but it cannot reveal whether those rules match real-world truth.

### Model readiness gate

A deterministic set of data and review requirements that must be satisfied before a reviewed-model training run is allowed. Passing the gate permits evaluation; it does not automatically authorize deployment.

### Model artifact

A serialized trained estimator plus the metadata needed to identify its feature contract, training data, library versions, and integrity hash. AegisFire keeps development artifacts out of Git and exposes only an inspectable benchmark report to the web application.

### Confusion matrix

A table comparing reference labels by row with predicted labels by column. Diagonal cells are agreements and off-diagonal cells are disagreements; when the reference labels are weak, the matrix describes weak-label agreement rather than validated classification performance.

## 2026-09-03 — Explainability, clustering sensitivity, and registry controls

### Verified implementation observations

- The deterministic eight-variant sensitivity sweep covers epsilon values of 500, 750, 1,000, and 1,500 m at minimum-density values of two and three. It evaluates 1,566 retained detections and does not alter the operational grouping.
- The operational 750 m/two-sample control produces 777 analytical clusters, 256 multi-event clusters, 33.3% noise, no border points, a 725 m supported-cluster P95 radius, and a largest cluster of 84 observations.
- The 1,000 m/two-sample variant retains 97.8% pairwise co-membership Jaccard agreement with the control while producing 766 clusters and 32.5% noise. The 1,500 m/two-sample variant drops to 79.9% agreement and increases the largest cluster to 99 observations; this is diagnostic evidence of parameter sensitivity, not proof that either configuration is better.
- Three-sample variants expose border roles but leave approximately half the observations as DBSCAN noise in this short dataset. This demonstrates a meaningful density tradeoff but cannot determine the scientifically correct parameters without reviewed source examples.
- The event evidence graph currently connects FIRMS measurement, observed recurrence, metric grouping, OSM proximity/absence, and annual MODIS land-cover context to the deterministic candidate classification. A limitation node always constrains the interpretation.
- The registry reports exactly one serving model, `rules_temporal_metric_v3`. Benchmark entries are non-serving, and `rules_temporal_metric_v3` is also the explicit rollback target.

### Engineering assumptions and controls

- Pairwise co-membership Jaccard is calculated from pairs of non-noise observations assigned to the same cluster. It measures how similarly two configurations group observations relative to their union of grouped pairs; it is not a ground-truth clustering score.
- The parameter sweep runs independently from the primary dashboard request. Failure or delay in evaluation telemetry must not block the operational map or replace the deterministic control configuration.
- Evidence-graph edges use `supports`, `contextualizes`, or `limits`. They explain deterministic application logic and must not be interpreted as causal, physical, ownership, or incident relationships.
- Registry promotion is intentionally non-automatic. A benchmark winner cannot become serving without reviewed-label coverage, spatial and temporal evaluation, calibration and failure-mode review, artifact-integrity checks, a shadow deployment, and an explicit human decision.

### Evidence graph

A structured set of attributed evidence nodes and directed relationships leading to an application interpretation. In AegisFire it explains which measurements and contexts supported or limited a candidate label while preserving a mandatory non-confirmation boundary.

### Co-membership Jaccard

The size of the intersection of two configurations' same-cluster observation-pair sets divided by the size of their union. A value of one means identical supported pair membership relative to the control; it does not mean the clusters are correct.

### Parameter sensitivity sweep

A controlled comparison that changes clustering parameters and records how grouping diagnostics respond. It reveals fragile or stable behavior but cannot select scientifically valid parameters without external or reviewed reference labels.

### Model registry

A versioned inventory describing model family, lifecycle, serving state, label provenance, feature contract, device, artifact integrity, evaluation scope, and promotion state. Registry presence does not imply deployment approval.

### Shadow deployment

Running a candidate alongside the operational model without allowing it to drive user-facing classifications or actions. Its outputs can be compared safely before a separate promotion decision.

### Rollback target

The known operational version to which inference can return if a promoted model fails acceptance or monitoring criteria. AegisFire currently records the deterministic rules model as that target.

## 2026-09-03 — Ingestion operations and source-discovery assumptions

### Verified implementation observations

- The retained deterministic evidence currently contains 1,566 deduplicated India-contained observations across eight UTC acquisition dates and 777 metric clusters. The operational-health surface sees six bundled FIRMS CSV files and reports `demo_ready` until a refresh run is recorded.
- Twenty-seven current clusters have an unresolved application category. The highest-ranked unresolved cluster, `TS-38F2AAAE6C`, has 21 detections from three VIIRS feeds across six of eight observed dates, a 0.786 recurrence score, a 764 m observed radius, and a 0.694 discovery-priority score.
- One unresolved candidate crosses the current 0.65 priority threshold. This is an observed property of the pinned files and current engineering formula, not an external validation result or a stable expected count.
- Source-fingerprint IDs hash the fingerprint feature version and sorted source event IDs. Identical retained evidence produces identical IDs; adding evidence that changes cluster membership can intentionally create a new fingerprint ID.
- The operations panel reports file modification age and observation lag separately. A recently copied file can still contain older observations, while an older bundled fixture can remain a valid deterministic demo input.

### Engineering assumptions and controls

- `thermal_source_fingerprint_v1` summarizes the retained observation window using FRP distribution, acquisition-hour concentration, day/night share, active dates/gaps, sensor support, DBSCAN radius/stability, recurrence, OSM proximity, and annual MODIS IGBP context. It is a software evidence profile, not remote identification of a physical asset.
- Unknown-source discovery priority weights recurrence at 40%, active-day coverage at 20%, sensor support at 15%, engineered spatial stability at 15%, and bounded maximum FRP at 10%. The 0.65 priority cutoff is a tunable review-queue assumption and must not be displayed as a probability.
- Spatial stability is currently `1 - radius / 1,500 m`, clipped to zero through one. That scale is chosen for triage relative to the existing DBSCAN sweep; it is not a published sensor-physics threshold.
- Profile completeness combines observed-date coverage, sensor count, and detection count. It describes how much retained evidence contributes to the application profile, not data correctness or real-world source certainty.
- A cache file is considered stale after two configured refresh intervals. Bundled checked-in files are always labeled `bundled_snapshot`, avoiding a false freshness claim based only on their filesystem timestamp.
- The local ingestion audit uses an exclusive lock file and atomic replacement to coordinate the API and scheduler on one host. Distributed deployments need a transactional database/queue and should not treat this JSON file as a multi-host ledger.

### Thermal-source fingerprint

A versioned, deterministic summary of repeated thermal observations assigned to one analytical cluster. It makes timing, intensity, recurrence, sensor, spatial, and contextual evidence comparable while explicitly avoiding physical-source identification.

### Discovery priority

An engineered ordering score for unresolved candidates. Higher values place a candidate earlier in analyst review; the score is neither a calibrated probability nor confirmation that the observations come from one physical source or incident.

### Profile completeness

A bounded indicator of how much temporal, sensor, and detection support is available to populate a source fingerprint. Completeness does not imply truth, representativeness, or seasonal maturity.

### Observation lag

Elapsed wall-clock time since the newest retained satellite acquisition. This differs from file age and helps operators distinguish a recently processed old observation from a genuinely recent observation.

### Ingestion run audit

An append-only operational record of one refresh or archive attempt, including trigger, source mode, UTC timing, source/archive paths, normalized count, outcome, and sanitized failure type. It provides traceability but is not a cryptographically signed provenance ledger.

### Baseline maturity

A label describing the time coverage behind a fingerprint: snapshot-only, short-window, 30-day candidate, or seasonal candidate. It limits interpretation; crossing a maturity duration does not itself validate a model or establish normal facility behavior.
