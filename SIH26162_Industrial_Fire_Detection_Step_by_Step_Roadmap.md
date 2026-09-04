# SIH 2026 — SIH26162
# AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources Using NASA FIRMS, OSM & Satellite Data

**Organization:** National Technical Research Organisation (NTRO)  
**Category:** Software  
**Problem Statement:** SIH26162  
**Goal:** Build an AI-enabled geospatial system that detects, classifies, visualizes, and monitors industrial fires and persistent thermal sources using NASA FIRMS, OpenStreetMap (OSM), land-cover/context data, and satellite imagery.

---

## 0. What You Are Actually Building

NASA FIRMS already tells you:

> "A satellite detected a thermal anomaly / hotspot at this latitude and longitude."

Your SIH solution must answer the harder questions:

> **What is this hotspot?**  
> Is it an industrial fire, a persistent industrial heat source such as a gas flare, a forest fire, agricultural burning, mining activity, or something else?

Then your system must:

1. Collect thermal detections from **NASA FIRMS**.
2. Enrich every detection with **OpenStreetMap industrial context**.
3. Add **land-cover / surrounding-area context**.
4. Analyze the **history of detections at the same place**.
5. Optionally analyze **satellite image chips** around the hotspot.
6. Use AI/ML to classify the thermal source.
7. Show the results as a **GIS/map overlay**.
8. Allow users to inspect evidence behind the classification.
9. Track recurring/persistent thermal sources.
10. Highlight potentially abnormal or newly emerging industrial fires.

---

# 1. Problem Statement Requirements → Technical Deliverables

The problem statement can be converted into the following engineering requirements.

| SIH Requirement | What You Should Build |
|---|---|
| Integrate NASA FIRMS | Automated FIRMS API ingestion |
| Integrate OSM | Pull nearby industries/facilities through OSM/Overpass |
| Use satellite data | Fetch/display contextual satellite imagery; optionally extract image features |
| Detect industrial fires | Binary/multi-class classifier |
| Distinguish industrial vs natural fires | Land-use + facility proximity + ML |
| Identify persistent thermal sources | Temporal recurrence/persistence engine |
| GIS-based solution | Interactive Leaflet/MapLibre map |
| Data storage | PostgreSQL + PostGIS recommended |
| Visualization | Heatmap, markers, facility layers, history charts |
| AI-enabled | Explainable classification model, not only hard-coded rules |
| Monitoring | Recurring ingestion + alert generation |

---

# 2. Recommended Final Product

Give the project a product identity instead of presenting it as a loose collection of scripts.

Example name:

## **AegisFire**

**One-line pitch:**

> An AI-powered satellite intelligence platform that combines NASA FIRMS, OpenStreetMap, temporal behavior, and satellite context to distinguish industrial thermal anomalies from natural fires and monitor persistent heat sources.

### Main screens

1. **National / Regional Fire Intelligence Map**
2. **Thermal Event Details**
3. **Industrial Facility Monitor**
4. **Persistent Heat Source Dashboard**
5. **Alert / Anomaly Dashboard**
6. **Analytics & Trends**
7. **Model Evidence / Explainability View**

---

# 3. Recommended Technology Stack

For your team, do not make the stack unnecessarily complicated.

## Frontend

- **Next.js / React**
- TypeScript
- Tailwind CSS
- **MapLibre GL JS** or **Leaflet**
- Recharts / Plotly for graphs

## Backend

Recommended:

- **FastAPI**
- Python 3.11/3.12
- Pydantic
- SQLAlchemy

Why FastAPI?

Most of the geospatial and machine-learning work will already be in Python.

## Database

Recommended:

- **PostgreSQL**
- **PostGIS**

PostGIS makes queries such as:

> "Find all refineries within 5 km of this thermal hotspot"

easy and efficient.

For the very first prototype you can use SQLite, but move to PostGIS before the serious demo.

## Machine Learning

Start with:

- Pandas
- GeoPandas
- Scikit-learn
- XGBoost or LightGBM
- SHAP

Optional later:

- PyTorch
- Rasterio
- TorchGeo
- ONNX Runtime

## DevOps

- Docker
- Docker Compose
- GitHub
- GitHub Actions
- Vercel for frontend if desired
- Render/Railway/Fly.io/Azure/AWS for API
- Supabase PostgreSQL can also work, but verify PostGIS availability/configuration

---

# 4. High-Level Architecture

```text
                         ┌────────────────────────┐
                         │      NASA FIRMS        │
                         │ VIIRS / MODIS / Landsat│
                         └───────────┬────────────┘
                                     │
                                     ▼
                         ┌────────────────────────┐
                         │ FIRMS Ingestion Worker │
                         └───────────┬────────────┘
                                     │
                                     ▼
┌─────────────────┐       ┌────────────────────────┐
│ OpenStreetMap   │──────▶│ Geospatial Enrichment  │
│ / Overpass API  │       │      Pipeline          │
└─────────────────┘       └───────────┬────────────┘
                                     │
┌─────────────────┐                  │
│ Land-cover /    │──────────────────┤
│ Satellite Data  │                  │
└─────────────────┘                  ▼
                         ┌────────────────────────┐
                         │ PostgreSQL + PostGIS   │
                         │ Events / Facilities /  │
                         │ Features / Predictions │
                         └───────────┬────────────┘
                                     │
                      ┌──────────────┴──────────────┐
                      ▼                             ▼
             ┌────────────────┐          ┌──────────────────┐
             │ Persistence &  │          │ ML Classification│
             │ Change Engine  │          │ + Explainability │
             └────────┬───────┘          └────────┬─────────┘
                      └──────────────┬─────────────┘
                                     ▼
                         ┌────────────────────────┐
                         │      FastAPI API       │
                         └───────────┬────────────┘
                                     ▼
                         ┌────────────────────────┐
                         │ React GIS Dashboard    │
                         │ Map / Alerts / Trends  │
                         └────────────────────────┘
```

---

# 5. STEP-BY-STEP DEVELOPMENT ROADMAP

---

# PHASE 1 — Understand NASA FIRMS

Do this before writing the classifier.

## Step 1.1 — Complete the relevant FIRMS Academy modules

Start here:

- https://firms.modaps.eosdis.nasa.gov/academy

Priority modules:

1. FIRMS introduction
2. Data ingest/manipulation
3. FIRMS API in Python
4. Data visualization/mapping
5. Understanding active-fire attributes

Do not try to finish every NASA tutorial before development.

Your objective is to understand:

- what one FIRMS record represents,
- which sensors are available,
- what FRP means,
- what confidence means,
- what brightness-temperature attributes mean,
- what near-real-time data means,
- how to query an area,
- how timestamps work.

---

## Step 1.2 — Obtain a FIRMS MAP_KEY

NASA FIRMS API requires a free MAP_KEY.

Get it from:

- https://firms.modaps.eosdis.nasa.gov/api/map_key/

Store it in:

```env
FIRMS_MAP_KEY=your_key_here
```

Never commit it directly to GitHub.

Use:

```gitignore
.env
.env.local
```

---

## Step 1.3 — Understand the FIRMS Area API

The Academy demonstrates an endpoint conceptually similar to:

```text
/api/area/csv/{MAP_KEY}/{SOURCE}/{AREA}/{DAY_RANGE}
```

You will normally request:

- a sensor/source,
- a bounding box,
- a number of days.

For development, **do not query the entire world repeatedly**.

Start with:

- one city,
- one industrial corridor,
- one state,
- or a carefully selected bounding box.

NASA notes that global VIIRS requests can contain tens of thousands of detections per day, so limit your initial area.

---

# 6. FIRMS DATA YOU NEED TO STORE

A VIIRS FIRMS record commonly includes fields such as:

```text
latitude
longitude
bright_ti4
scan
track
acq_date
acq_time
satellite
instrument
confidence
version
bright_ti5
frp
daynight
```

Create a normalized internal record.

Example:

```json
{
  "source": "VIIRS_NOAA20_NRT",
  "latitude": 22.1234,
  "longitude": 72.4567,
  "acquired_at": "2026-08-24T09:52:00Z",
  "brightness_i4": 345.2,
  "brightness_i5": 301.1,
  "frp_mw": 8.4,
  "confidence": "nominal",
  "day_night": "D"
}
```

### Important features

## `latitude`, `longitude`

Location of thermal detection.

## `bright_ti4`

Mid-infrared brightness temperature.

Useful as a measure of thermal intensity.

## `bright_ti5`

Long-wave infrared brightness temperature.

Use together with I4.

Create an engineered feature:

```text
brightness_delta = bright_ti4 - bright_ti5
```

## `frp`

**Fire Radiative Power**, normally expressed in MW.

It gives a measure related to radiative energy emitted by the active fire/thermal anomaly.

Do not classify solely using FRP.

A refinery flare may repeatedly produce strong thermal detections.

## `confidence`

VIIRS FIRMS commonly represents confidence as:

- low
- nominal
- high

Keep this as a feature.

Do not automatically discard every low-confidence detection.

## `daynight`

- D = daytime
- N = nighttime

Some classes may exhibit different day/night behavior.

---

# 7. Choose Sensors

For your first working prototype:

## Primary sensor

### VIIRS 375 m

Use one of:

- VIIRS S-NPP
- VIIRS NOAA-20
- VIIRS NOAA-21

Why VIIRS first?

Because its ~375 m active-fire product provides substantially finer hotspot localization than MODIS ~1 km.

## Secondary sensor

Add MODIS later.

It can help with:

- historical coverage,
- multi-sensor agreement,
- long-term persistence analysis.

## Landsat

Use Landsat as an optional high-resolution contextual source when useful.

Do not make the MVP depend on every sensor working simultaneously.

---

# PHASE 2 — Build FIRMS Ingestion

# Step 2.1 — Create the ingestion script

Create:

```text
backend/app/ingestion/firms.py
```

Responsibilities:

1. Read `FIRMS_MAP_KEY`.
2. Query selected geographic area.
3. Download CSV.
4. Validate columns.
5. Normalize timestamps.
6. Remove exact duplicates.
7. Add source metadata.
8. Insert records into database.

Pseudo-flow:

```python
def ingest_firms(area, source, days):
    raw = download_firms(area, source, days)
    clean = normalize(raw)
    clean = remove_duplicates(clean)
    save(clean)
```

---

# Step 2.2 — Create a unique event identifier

Prevent duplicates when the ingestion worker runs again.

Possible event fingerprint:

```text
source
+ satellite
+ acquisition datetime
+ rounded latitude
+ rounded longitude
```

Hash these values.

Example:

```text
SHA256(
    satellite +
    acquired_at +
    latitude +
    longitude
)
```

Use a database `UNIQUE` constraint.

---

# Step 2.3 — Store raw data AND processed data

Never throw away the original FIRMS attributes.

Recommended:

```text
thermal_events
├── id
├── source
├── geom
├── acquired_at
├── raw_payload JSONB
├── frp
├── brightness_i4
├── brightness_i5
├── confidence
├── daynight
├── created_at
└── processing_status
```

`raw_payload` is useful for:

- debugging,
- reproducibility,
- new feature engineering,
- model audits.

---

# PHASE 3 — Add OpenStreetMap Industrial Context

This is one of the most important parts of the SIH problem.

FIRMS tells you:

> "hotspot here"

OSM helps tell you:

> "this hotspot is 260 m from an oil refinery"

That is extremely valuable.

---

# Step 3.1 — Learn only the OSM tags you need

Useful OSM tags include:

```text
landuse=industrial
industrial=refinery
power=plant
man_made=works
man_made=flare
man_made=storage_tank
man_made=pipeline
plant:source=coal
plant:source=gas
plant:source=oil
```

Additional categories to investigate:

- steel plants
- mines
- quarries
- petroleum facilities
- LNG terminals
- chemical plants
- petrochemical facilities

---

# Step 3.2 — Query OSM using Overpass

Create:

```text
backend/app/ingestion/osm.py
```

The pipeline should obtain:

- industrial polygons,
- facility points,
- refinery areas,
- power plants,
- mining areas,
- flare locations where mapped,
- relevant industrial names/operators.

Store them in PostGIS.

Suggested table:

```text
industrial_facilities
├── id
├── osm_id
├── name
├── facility_type
├── tags JSONB
├── geom GEOMETRY
├── source
├── last_updated_at
└── confidence
```

---

# Step 3.3 — Compute distance from every hotspot to industrial infrastructure

For every thermal event calculate:

```text
nearest_industry_distance_m
nearest_refinery_distance_m
nearest_power_plant_distance_m
nearest_mine_distance_m
inside_industrial_polygon
inside_power_plant_polygon
inside_refinery_polygon
```

Example:

```text
Hotspot A

Nearest refinery: 180 m
Inside industrial zone: YES
Power plant nearby: NO
Mine nearby: NO
```

These become excellent ML features.

---

# PHASE 4 — Add Non-Industrial Geographic Context

The classifier must also know what surrounds the hotspot.

For example:

```text
HOTSPOT A
Inside refinery             → likely industrial

HOTSPOT B
Inside dense forest
No industry within 20 km    → likely wildfire

HOTSPOT C
Inside cropland
Appears once after harvest  → likely agricultural burn
```

---

# Step 4.1 — Add land-cover information

Possible land-cover classes:

- forest
- shrubland
- grassland
- cropland
- built-up
- bare land
- water
- industrial
- mining

Possible data sources include:

- ESA WorldCover
- Dynamic World
- other open land-cover datasets
- OSM land-use tags

For an MVP, OSM plus one raster land-cover source is enough.

Create features:

```text
landcover_class
forest_fraction_1km
cropland_fraction_1km
builtup_fraction_1km
water_fraction_1km
industrial_fraction_1km
```

---

# PHASE 5 — Build the Temporal Persistence Engine

This is where your project can become much more interesting than a generic hotspot map.

The problem explicitly mentions **persistent thermal sources**.

A gas flare or industrial furnace may produce repeated detections at almost the same location.

A wildfire generally moves or disappears.

---

# Step 5.1 — Cluster detections spatially

Start with:

### DBSCAN

Features:

```text
latitude
longitude
```

But do not directly run Euclidean distance on raw lat/lon unless handled correctly.

Options:

- project coordinates to a metric CRS,
- use Haversine distance,
- or use PostGIS spatial clustering.

A starting clustering radius could represent a few hundred metres to around a kilometre depending on sensor resolution.

Tune this experimentally.

---

# Step 5.2 — Give each recurring hotspot a Thermal Source Cluster ID

Example:

```text
cluster_id = TS-000812
```

Every new thermal detection should be linked to an existing cluster if spatially close enough.

---

# Step 5.3 — Calculate temporal behavior

For each cluster compute:

```text
detections_last_7d
detections_last_30d
detections_last_90d
active_days_last_30d
active_days_last_90d
night_detection_ratio
day_detection_ratio
mean_frp
median_frp
max_frp
frp_variance
mean_temperature_delta
first_seen
last_seen
days_since_first_seen
```

---

# Step 5.4 — Create a persistence score

Example concept:

```text
Persistence Score =

40% recurrence frequency
30% number of active days
20% spatial stability
10% day/night consistency
```

Do not present this exact weighting as scientific truth.

It is an engineering starting point.

Make the weighting configurable.

---

# Step 5.5 — Detect abnormal changes in a persistent source

This is a powerful SIH differentiator.

Suppose a refinery flare normally produces:

```text
FRP ≈ 4–8 MW
```

but suddenly:

```text
FRP = 47 MW
```

Your system should say:

> Persistent industrial source detected, but today's thermal intensity is abnormal relative to its historical baseline.

Features:

```text
frp_z_score
frp_percentile_vs_history
brightness_change
event_count_spike
new_cluster_flag
```

Possible model:

- Isolation Forest
- rolling z-score
- robust MAD anomaly detection

---

# PHASE 6 — Decide Your Classification Taxonomy

Do not begin with too many classes.

## MVP classification

Start with:

```text
1. Industrial Thermal Event
2. Natural / Vegetation Fire
3. Other / Uncertain
```

Once the pipeline works, expand.

## Recommended SIH final classification

```text
1. Abnormal Industrial Fire
2. Persistent Industrial Thermal Source / Gas Flare
3. Forest / Wildfire
4. Agricultural Burning
5. Mining / Other Industrial Heat
6. Unknown / Insufficient Evidence
```

Why include `Unknown`?

Because forcing the model to make a confident prediction for every event is bad engineering.

---

# PHASE 7 — Create a Training Dataset

This will be one of the hardest parts.

Your model needs examples.

You cannot simply take every FIRMS point near an industrial facility and call it an industrial fire.

That would create weak labels.

Use a staged labeling strategy.

---

# Step 7.1 — Weak labeling using geospatial rules

Create initial pseudo-labels.

Example:

### Candidate persistent industrial source

```text
inside industrial/refinery/power polygon
AND repeated hotspot at same location
AND recurrence > threshold
```

### Candidate vegetation fire

```text
forest/vegetation land cover
AND no major industrial site nearby
AND temporary event
```

### Candidate agricultural burn

```text
cropland
AND no industrial facility nearby
AND temporary/seasonal pattern
```

These labels are not perfect.

Call them:

```text
weak_label
```

not `ground_truth`.

---

# Step 7.2 — Manually review a subset

Build an internal annotation interface.

For each hotspot show:

- map location,
- nearby OSM facility,
- satellite image,
- FIRMS attributes,
- historical detections,
- Google/OSM context if allowed,
- proposed weak label.

Reviewer selects:

```text
Confirmed Industrial
Likely Industrial
Confirmed Natural
Likely Natural
Agricultural
Unknown
```

This creates a higher-quality validation set.

---

# Step 7.3 — Use known facilities as targeted examples

Select known:

- oil refineries,
- thermal power stations,
- steel plants,
- LNG facilities,
- industrial zones.

Download historical FIRMS detections around them.

This gives your team a focused industrial dataset.

---

# Step 7.4 — Build balanced data

Do not train on:

```text
95% natural fire
5% industrial
```

without addressing imbalance.

Options:

- class weighting,
- undersampling,
- oversampling,
- stratified validation.

Focus especially on:

```text
Industrial recall
Industrial precision
```

---

# PHASE 8 — Feature Engineering

Your ML model should not receive only latitude and longitude.

Recommended feature groups:

---

## A. FIRMS thermal features

```text
frp
bright_ti4
bright_ti5
brightness_delta
confidence
daynight
scan
track
sensor
satellite
```

---

## B. Industrial proximity features

```text
inside_industrial_polygon
nearest_industrial_distance
nearest_refinery_distance
nearest_powerplant_distance
nearest_mine_distance
nearest_flare_distance
facility_type
number_industrial_sites_2km
number_industrial_sites_5km
```

---

## C. Land-cover features

```text
landcover_class
forest_fraction
cropland_fraction
urban_fraction
water_fraction
bareland_fraction
```

---

## D. Temporal features

```text
detections_7d
detections_30d
detections_90d
active_days_30d
active_days_90d
night_ratio
mean_frp_history
frp_variance_history
persistence_score
cluster_age
```

---

## E. Calendar features

```text
month
season
hour
day_of_year
```

These can help separate seasonal burning from persistent sources.

---

## F. Satellite-image features

Add later:

```text
image_embedding
vegetation_index
builtup_score
smoke_score
industrial_structure_score
```

---

# PHASE 9 — Build the First Baseline Before AI

Always create a baseline.

Example rules:

```text
IF inside_refinery AND persistence_score > 0.8:
    predicted = persistent_industrial_source

ELIF forest_fraction > 0.7 AND nearest_industry > 5000:
    predicted = vegetation_fire

ELIF cropland_fraction > 0.7 AND persistence_score < 0.2:
    predicted = agricultural_burn

ELSE:
    predicted = unknown
```

Why?

Because later you can prove:

```text
Rule Baseline F1: 0.71
ML Model F1:      0.87
```

That is much more convincing than saying:

> "We used AI."

---

# PHASE 10 — Train the First ML Model

For this problem, start with tabular ML.

## Recommended first models

Train and compare:

1. Logistic Regression
2. Random Forest
3. XGBoost / LightGBM

Do not begin with a giant neural network.

The data is mostly:

- tabular,
- geospatial,
- temporal.

Tree-based models are well suited.

---

# Step 10.1 — Dataset split

Avoid random leakage.

If records from the same physical hotspot appear in both train and test sets, your test score may be misleadingly high.

Prefer:

### Grouped split by thermal cluster/facility

```text
Train clusters: 70%
Validation clusters: 15%
Test clusters: 15%
```

Even better:

Use geographically separated test areas.

Example:

```text
Train: industrial sites from Regions A/B/C
Test: industrial sites from Region D
```

---

# Step 10.2 — Evaluate

Metrics:

```text
Accuracy
Precision
Recall
F1
Confusion Matrix
ROC-AUC
PR-AUC
```

But emphasize:

```text
Industrial Fire Recall
Industrial Fire Precision
False Positive Rate
```

Example:

> Of 100 real industrial-fire examples, how many did the system identify?

---

# Step 10.3 — Add confidence scores

Output:

```json
{
  "classification": "persistent_industrial_source",
  "confidence": 0.92
}
```

If confidence is low:

```text
UNKNOWN / NEEDS REVIEW
```

---

# PHASE 11 — Explainable AI

NTRO/judges should not see only:

> AI says industrial fire.

Show WHY.

Use:

- SHAP for tree models,
- feature contributions,
- rules/evidence panel.

Example UI:

```text
Prediction
──────────
Persistent Industrial Source
Confidence: 94%

Evidence
──────────
+ Inside refinery boundary
+ 71 detections in previous 90 days
+ Nearest industrial feature: 85 m
+ High nighttime recurrence
+ Stable hotspot location
- Current FRP not unusually high
```

For a wildfire:

```text
Prediction
──────────
Vegetation Fire
Confidence: 88%

Evidence
──────────
+ Forest coverage within 1 km: 82%
+ No mapped industry within 12.3 km
+ Cluster first appeared yesterday
+ Hotspots moving spatially over time
```

This is a major judging advantage.

---

# PHASE 12 — Satellite Imagery

The problem statement explicitly mentions satellite data.

However:

## DO NOT block your entire project on image AI.

Your MVP can be excellent using:

```text
FIRMS + OSM + land cover + temporal ML
```

Then add imagery as an enrichment layer.

---

# Step 12.1 — Fetch an image chip around the hotspot

For every selected event:

```text
center = hotspot lat/lon
window = e.g. 1 km × 1 km or 2 km × 2 km
```

Retrieve a recent cloud-free image where possible.

Possible sources:

- Sentinel-2
- Landsat 8/9
- NASA/USGS imagery
- another openly licensed satellite source

Store metadata:

```text
image_source
image_date
cloud_cover
bbox
resolution
```

---

# Step 12.2 — Display imagery in the evidence panel

Even without image classification, this provides valuable context.

Judges can visually see:

```text
hotspot
      ↓
refinery
storage tanks
industrial structures
```

---

# Step 12.3 — Optional image ML

Only after the tabular/geospatial system works.

Possible model task:

```text
Image chip
    ↓
CNN / Vision Encoder
    ↓
Industrial / Forest / Agricultural / Built-up
```

Then combine that with the tabular model.

---

# PHASE 13 — Multi-Modal Fusion

The stronger final version combines multiple evidence channels.

```text
                    FIRMS Features
                          │
                          ▼
                    Tabular Model
                          │
                          │
OSM Features ─────────────┤
                          │
Land Cover ────────────────┤
                          │
Temporal History ──────────┤
                          │
Satellite Image ──▶ Image Encoder
                          │
                          ▼
                    Fusion Layer
                          │
                          ▼
                    Final Prediction
```

Do not make the first version overly complex.

A practical fusion strategy:

```text
structured_probability = XGBoost(...)
image_probability = vision_model(...)

final_probability =
    0.8 * structured_probability +
    0.2 * image_probability
```

Later optimize/calibrate the weights.

---

# PHASE 14 — PostGIS Data Model

Recommended simplified schema.

## `thermal_events`

```text
id UUID
external_event_hash TEXT UNIQUE
source TEXT
geom GEOGRAPHY(Point,4326)
acquired_at TIMESTAMP
frp FLOAT
brightness_i4 FLOAT
brightness_i5 FLOAT
confidence TEXT
daynight TEXT
raw_payload JSONB
cluster_id UUID
created_at TIMESTAMP
```

## `industrial_facilities`

```text
id UUID
osm_id TEXT
name TEXT
facility_type TEXT
geom GEOGRAPHY
tags JSONB
```

## `thermal_clusters`

```text
id UUID
centroid GEOGRAPHY
first_seen TIMESTAMP
last_seen TIMESTAMP
detection_count INTEGER
persistence_score FLOAT
baseline_frp FLOAT
```

## `event_features`

```text
event_id UUID
nearest_industry_m FLOAT
nearest_refinery_m FLOAT
nearest_powerplant_m FLOAT
inside_industrial BOOLEAN
landcover TEXT
forest_fraction FLOAT
cropland_fraction FLOAT
detections_30d INTEGER
persistence_score FLOAT
features JSONB
```

## `predictions`

```text
id UUID
event_id UUID
model_version TEXT
predicted_class TEXT
probability FLOAT
explanation JSONB
created_at TIMESTAMP
```

## `alerts`

```text
id UUID
event_id UUID
alert_type TEXT
severity TEXT
status TEXT
reason TEXT
created_at TIMESTAMP
acknowledged_at TIMESTAMP
```

---

# PHASE 15 — Backend API

Suggested API.

## Thermal Events

```text
GET /api/events
GET /api/events/{id}
GET /api/events/{id}/history
```

Filters:

```text
class
confidence
date_from
date_to
min_frp
facility_type
bbox
```

---

## Facilities

```text
GET /api/facilities
GET /api/facilities/{id}
GET /api/facilities/{id}/thermal-history
```

---

## Clusters

```text
GET /api/clusters
GET /api/clusters/{id}
```

---

## Alerts

```text
GET /api/alerts
PATCH /api/alerts/{id}
```

---

## Analytics

```text
GET /api/analytics/summary
GET /api/analytics/classes
GET /api/analytics/persistent-sources
GET /api/analytics/high-risk-facilities
```

---

# PHASE 16 — GIS Dashboard

This is one of the two explicit expected deliverables.

Do not treat the map as decoration.

It should be the central interface.

---

# Screen 1 — National / Regional Map

Layers:

```text
☑ FIRMS hotspots
☑ Industrial fires
☑ Persistent industrial heat
☑ Forest fires
☑ Agricultural burning
☑ Industrial facilities
☑ Refineries
☑ Power plants
☑ Mines
☑ Land cover
```

Marker colors/icons should distinguish classes.

Provide:

- timeline/date slider,
- sensor filter,
- confidence filter,
- predicted-class filter,
- FRP range,
- search,
- cluster layer.

---

# Screen 2 — Event Details

When user clicks a hotspot:

```text
THERMAL EVENT #XK92

Detected:
24 Aug 2026 09:52 UTC

NASA FIRMS:
FRP: 12.7 MW
Confidence: Nominal
Sensor: VIIRS NOAA-20

AI Classification:
Persistent Industrial Source
Probability: 94%

Nearest Facility:
ABC Petroleum Refinery
Distance: 137 m

Persistence:
67 detections / 90 days

Historical FRP:
[ chart ]

Model Evidence:
[ SHAP/evidence ]

Satellite Image:
[ image ]
```

---

# Screen 3 — Facility Monitor

Select a refinery/power plant.

Show:

```text
Facility name
Facility type
Operator
Current status
Number of hotspots
Historical detections
Baseline FRP
Current FRP
Anomaly status
Timeline
```

---

# Screen 4 — Persistent Thermal Sources

Leaderboard:

| Facility/Cluster | Type | Active Days | Mean FRP | Persistence | Current Status |
|---|---|---:|---:|---:|---|
| X | Refinery | 82 | 7.2 | 0.94 | Normal |
| Y | Steel Plant | 41 | 13.1 | 0.87 | Elevated |
| Z | Unknown | 75 | 5.4 | 0.91 | Investigate |

Unknown persistent hotspots are especially interesting.

---

# Screen 5 — Alert Dashboard

Alert types:

```text
NEW_INDUSTRIAL_THERMAL_SOURCE
ABNORMAL_FRP_SPIKE
INDUSTRIAL_FIRE_LIKELY
HIGH_CONFIDENCE_UNMAPPED_SOURCE
PERSISTENT_UNKNOWN_SOURCE
RAPID_CLUSTER_GROWTH
```

---

# PHASE 17 — Intelligent Alert Logic

Example:

## New industrial event

```text
IF
classification == industrial_fire
AND model_confidence >= 0.85
AND cluster_age < 2 days

THEN
generate HIGH alert
```

## Persistent source suddenly increases

```text
IF
persistent_source == TRUE
AND current_frp > historical_95th_percentile

THEN
generate anomaly alert
```

## Unknown persistent heat source

```text
IF
persistence_score > 0.85
AND mapped_industrial_facility == NONE

THEN
generate investigation alert
```

This last one can be a strong innovation point.

---

# PHASE 18 — Build a Historical Playback Feature

Excellent demo feature:

```text
[◀] 1 Aug ━━━━━━━━━━━●━━ 24 Aug [▶]
```

As the timeline moves, display:

- new hotspots,
- expanding wildfire areas,
- stationary industrial heat sources.

This visually demonstrates why temporal behavior matters.

---

# PHASE 19 — Testing

You need more than "the website works."

---

## Unit tests

Test:

- timestamp parsing,
- FIRMS schema validation,
- duplicate detection,
- distance calculation,
- persistence calculation,
- alert thresholds.

---

## API tests

Test:

```text
GET /events
GET /events/{id}
GET /facilities
GET /alerts
```

---

## Geospatial tests

Examples:

```text
A point inside refinery polygon returns inside_refinery=True.

A point 2 km away returns nearest_refinery_m ≈ 2000.
```

---

## ML tests

Validate:

- input columns,
- missing values,
- probability range,
- model version,
- deterministic preprocessing.

---

# PHASE 20 — Evaluation Framework

Create a proper evaluation page/report.

## Classification

Report:

```text
Precision
Recall
F1
Confusion matrix
Per-class metrics
```

Pay special attention to:

```text
industrial fire recall
industrial fire precision
```

---

## Persistence detection

Create manually verified persistent sources.

Measure:

```text
Precision of persistent-source identification
Recall of persistent-source identification
```

---

## False alarms

Judges care about operational usefulness.

Report:

```text
False industrial alerts / 100 detections
```

---

## Latency

Measure:

```text
FIRMS ingestion
→ feature generation
→ classification
→ map availability
```

---

# PHASE 21 — Model Versioning

Store:

```text
model_v1_rules
model_v2_random_forest
model_v3_xgboost
model_v4_multimodal
```

Every prediction should contain:

```text
model_version
prediction_time
feature_version
```

This makes the project look much more production-ready.

---

# PHASE 22 — Recommended Repository Structure

```text
aegisfire/
│
├── README.md
├── docker-compose.yml
├── .env.example
│
├── frontend/
│   ├── app/
│   ├── components/
│   │   ├── map/
│   │   ├── charts/
│   │   ├── events/
│   │   └── facilities/
│   ├── lib/
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── ingestion/
│   │   │   ├── firms.py
│   │   │   ├── osm.py
│   │   │   └── satellite.py
│   │   ├── geospatial/
│   │   │   ├── enrichment.py
│   │   │   ├── clustering.py
│   │   │   └── persistence.py
│   │   ├── ml/
│   │   │   ├── features.py
│   │   │   ├── predict.py
│   │   │   └── explain.py
│   │   └── alerts/
│   ├── tests/
│   └── requirements.txt
│
├── ml/
│   ├── notebooks/
│   │   ├── 01_firms_exploration.ipynb
│   │   ├── 02_osm_enrichment.ipynb
│   │   ├── 03_weak_labels.ipynb
│   │   ├── 04_baseline.ipynb
│   │   └── 05_model_training.ipynb
│   ├── models/
│   ├── datasets/
│   └── reports/
│
├── data/
│   ├── samples/
│   └── README.md
│
├── docs/
│   ├── architecture.md
│   ├── data-model.md
│   ├── ml-methodology.md
│   ├── evaluation.md
│   └── demo-script.md
│
└── scripts/
    ├── ingest_firms.py
    ├── ingest_osm.py
    ├── build_features.py
    └── train_model.py
```

Do not commit huge satellite datasets into Git.

---

# PHASE 23 — Development Order

Do **not** work on everything simultaneously.

Recommended order:

```text
1. FIRMS API
        ↓
2. FIRMS map
        ↓
3. OSM industrial facilities
        ↓
4. Spatial joins/distances
        ↓
5. Historical clustering
        ↓
6. Persistence engine
        ↓
7. Weak-labelled dataset
        ↓
8. Baseline rules
        ↓
9. ML classifier
        ↓
10. Explainability
        ↓
11. Alerts
        ↓
12. Satellite image enrichment
        ↓
13. Optional image AI
```

---

# 24. FOUR-WEEK SIH DEVELOPMENT PLAN

With the current SIH idea-submission deadline approaching, optimize for a strong demonstrable core rather than an enormous unfinished system.

---

## WEEK 1 — DATA + MAP

### Day 1

- [ ] Read full SIH26162 statement
- [ ] Complete FIRMS Academy API tutorial
- [ ] Request FIRMS MAP_KEY
- [ ] Create GitHub repository
- [ ] Set up Python/FastAPI project
- [ ] Set up React/Next.js project

### Day 2

- [ ] Download FIRMS sample data
- [ ] Explore fields in notebook
- [ ] Create area API client
- [ ] Normalize timestamps
- [ ] Store raw CSV locally

### Day 3

- [ ] Set up PostgreSQL + PostGIS
- [ ] Create `thermal_events`
- [ ] Insert FIRMS events
- [ ] Prevent duplicate ingestion

### Day 4

- [ ] Create map page
- [ ] Plot FIRMS markers
- [ ] Add date/confidence filters
- [ ] Build event popup

### Day 5

- [ ] Learn OSM/Overpass basics
- [ ] Pull industrial polygons
- [ ] Pull refineries
- [ ] Pull power plants
- [ ] Store OSM features

### Day 6

- [ ] Overlay industries on map
- [ ] Calculate nearest facility
- [ ] Add facility information to popup

### Day 7

- [ ] Clean Week-1 bugs
- [ ] Record 1-minute internal demo
- [ ] Document current architecture

### Week-1 success condition

You can click a FIRMS hotspot and see:

```text
FIRMS attributes
+
nearest industry
+
distance
+
map context
```

---

## WEEK 2 — PERSISTENCE + DATASET + BASELINE

### Day 8

- [ ] Download 30–90 days historical FIRMS samples
- [ ] Create spatial clusters

### Day 9

- [ ] Implement cluster history
- [ ] Add active-days metrics
- [ ] Add mean/max FRP

### Day 10

- [ ] Create persistence score
- [ ] Show persistent sources on map

### Day 11

- [ ] Add one land-cover source
- [ ] Attach land-cover class to events

### Day 12

- [ ] Create weak-labeling rules
- [ ] Generate first labelled dataset

### Day 13

- [ ] Manually inspect examples
- [ ] Correct obvious wrong labels
- [ ] Create validation subset

### Day 14

- [ ] Build rules baseline
- [ ] Generate first confusion matrix
- [ ] Document errors

### Week-2 success condition

The system can distinguish:

```text
persistent industrial-looking source
vs
temporary vegetation/natural-looking source
```

even before full ML.

---

## WEEK 3 — ML + EXPLAINABILITY + ALERTS

### Day 15

- [ ] Build feature pipeline
- [ ] Train Logistic Regression

### Day 16

- [ ] Train Random Forest
- [ ] Train XGBoost/LightGBM
- [ ] Compare models

### Day 17

- [ ] Improve class balance
- [ ] Create grouped train/test split
- [ ] Analyze false positives

### Day 18

- [ ] Add SHAP explanations
- [ ] Build evidence JSON

### Day 19

- [ ] Build explanation panel in UI
- [ ] Show prediction confidence

### Day 20

- [ ] Implement FRP anomaly logic
- [ ] Implement new-source alerts
- [ ] Implement unknown-persistent-source alerts

### Day 21

- [ ] Build alert dashboard
- [ ] Add alert severity
- [ ] Add acknowledgement/status

### Week-3 success condition

A clicked hotspot shows:

```text
AI classification
confidence
reasons
facility context
historical behavior
alert status
```

---

## WEEK 4 — SATELLITE ENRICHMENT + POLISH

### Day 22

- [ ] Integrate contextual satellite image source
- [ ] Display image chip

### Day 23

- [ ] Add historical playback/timeline
- [ ] Improve cluster visualization

### Day 24

- [ ] Add analytics dashboard
- [ ] Add class distribution
- [ ] Add top persistent sources

### Day 25

- [ ] Run full test dataset
- [ ] Save evaluation metrics
- [ ] Fix major false positives

### Day 26

- [ ] Improve UI
- [ ] Improve loading states
- [ ] Add source attribution
- [ ] Add architecture diagram

### Day 27

- [ ] Final demo rehearsal
- [ ] Prepare SIH idea deck
- [ ] Prepare architecture explanation
- [ ] Prepare ML methodology explanation
- [ ] Prepare 2-minute backup video

---

# 25. Team Division for 6 Members

If your SIH team has six members:

## Member 1 — Backend / Team Integration

Responsibilities:

- FastAPI
- database
- API design
- Docker
- integration

## Member 2 — FIRMS + Data Engineering

Responsibilities:

- FIRMS API
- historical datasets
- ETL
- sensor normalization
- scheduled ingestion

## Member 3 — GIS / OSM

Responsibilities:

- OSM
- Overpass
- PostGIS
- spatial joins
- land-cover enrichment

## Member 4 — Machine Learning

Responsibilities:

- feature engineering
- training
- evaluation
- SHAP
- persistence/anomaly models

## Member 5 — Frontend / GIS Dashboard

Responsibilities:

- map
- filters
- event detail
- facility page
- analytics

## Member 6 — Research / QA / Satellite / Presentation

Responsibilities:

- domain research
- manual labels
- satellite-image enrichment
- test cases
- documentation
- SIH deck/demo

Do not isolate members completely.

At least two people should understand each major subsystem.

---

# 26. MVP vs FINAL VERSION

## Minimum Viable Product

Must contain:

- [ ] FIRMS API ingestion
- [ ] VIIRS data
- [ ] Interactive map
- [ ] OSM industrial facility overlay
- [ ] Distance-to-industry enrichment
- [ ] Simple temporal clustering
- [ ] Persistent source detection
- [ ] Basic industrial vs natural classifier
- [ ] Prediction confidence
- [ ] Event detail panel

If this works reliably, you already have a valid core solution.

---

## Strong SIH Submission

Add:

- [ ] Multi-class classification
- [ ] PostGIS
- [ ] land-cover context
- [ ] XGBoost/LightGBM
- [ ] SHAP explanations
- [ ] facility monitoring
- [ ] persistent-source ranking
- [ ] anomaly detection
- [ ] alerts
- [ ] evaluation dashboard
- [ ] satellite imagery

---

## Grand-Finale-Level Version

Add:

- [ ] multiple FIRMS sensors
- [ ] multi-modal satellite image model
- [ ] near-real-time ingestion worker
- [ ] historical playback
- [ ] alert acknowledgement workflow
- [ ] model monitoring
- [ ] role-based users
- [ ] downloadable incident report
- [ ] facility risk scoring
- [ ] cluster evolution analysis
- [ ] robust deployment
- [ ] documented performance benchmarks

---

# 27. What NOT To Do

Avoid these common mistakes.

## Mistake 1 — Build only a FIRMS map

NASA already has a map.

Your value is classification and intelligence.

---

## Mistake 2 — Call Gemini for each hotspot

This does not solve the core ML problem.

An LLM does not automatically understand geospatial thermal behavior.

Use proper structured/geospatial ML.

LLMs may help generate human-readable summaries later.

---

## Mistake 3 — Assume hotspot = fire

The exact motivation of the SIH challenge is that a thermal detection may represent different sources.

---

## Mistake 4 — Treat "near industrial area" as guaranteed industrial fire

A wildfire can occur near an industrial region.

Use multiple evidence sources.

---

## Mistake 5 — Ignore time

Persistence is one of your biggest advantages.

---

## Mistake 6 — Use only an image classifier

The best evidence comes from combining:

```text
thermal
+
geospatial
+
land-use
+
temporal
+
imagery
```

---

## Mistake 7 — Build an enormous deep-learning model immediately

Start with XGBoost/Random Forest.

Get measurable results first.

---

## Mistake 8 — Have no explainability

Operational users need to know why the model generated an alert.

---

## Mistake 9 — Randomly split repeated hotspot records

This creates data leakage.

Split by cluster/facility.

---

## Mistake 10 — Claim that your system identifies accidents with certainty

Phrase output as:

```text
Likely industrial fire
Persistent industrial heat source
Confidence: X%
Evidence: ...
```

not:

```text
Explosion confirmed.
```

unless confirmed by an authoritative source.

---

# 28. Recommended Innovation Features

If time is limited, prioritize the first three.

## Innovation 1 — Persistent Source Fingerprinting

Build a thermal "fingerprint" for each facility:

```text
typical FRP
typical time
frequency
night/day ratio
spatial spread
seasonality
```

Then detect deviations.

---

## Innovation 2 — Unknown Persistent Thermal Source Discovery

Find hotspots that:

- repeatedly appear,
- are spatially stable,
- are not mapped as expected heat sources.

This is valuable for intelligence/infrastructure discovery.

---

## Innovation 3 — Explainable Evidence Graph

Instead of only probability:

```text
Hotspot
  ├─ 90 m from refinery
  ├─ inside industrial polygon
  ├─ detected 61 days / 90
  ├─ stable location
  └─ FRP within facility baseline
      ↓
Persistent Industrial Heat
```

---

## Innovation 4 — Industrial Baseline Anomaly Detection

Learn "normal" thermal behavior for each known plant.

Flag deviations.

---

## Innovation 5 — Multi-Sensor Agreement

If multiple sensors detect thermal activity nearby within a valid time window, increase confidence.

---

## Innovation 6 — Change Detection

Compare older and newer satellite imagery near persistent hotspots.

---

## Innovation 7 — Human-in-the-loop Review

Allow analysts to correct classifications.

Store:

```text
AI label
analyst label
reason
timestamp
```

Use approved corrections for later retraining.

---

# 29. Example End-to-End Event

Imagine FIRMS returns:

```text
Location: 22.x, 72.x
FRP: 16 MW
Confidence: nominal
Day/Night: N
```

### Stage 1 — OSM

System finds:

```text
Inside industrial zone: YES
Nearest refinery: 120 m
Nearest power plant: 8.4 km
```

### Stage 2 — Land cover

```text
Built/industrial: 91%
Forest: 1%
Cropland: 3%
```

### Stage 3 — History

```text
Detected on 63 of previous 90 days
Centroid movement: 110 m
Mean historical FRP: 9 MW
```

### Stage 4 — ML

```text
Persistent Industrial Source: 96%
Industrial Fire: 3%
Natural Fire: 1%
```

### Stage 5 — Anomaly

Current FRP:

```text
16 MW
```

Historical baseline:

```text
9 ± 3 MW
```

Potential elevated condition.

### Final dashboard result

```text
Classification:
PERSISTENT INDUSTRIAL THERMAL SOURCE

Confidence:
96%

Status:
ELEVATED THERMAL OUTPUT

Evidence:
- hotspot inside refinery boundary
- 63/90 active days
- very stable spatial location
- low vegetation context
- current FRP above historical baseline
```

This is the kind of result your SIH demo should produce.

---

# 30. Second Example — Natural Fire

FIRMS:

```text
FRP: 36 MW
confidence: high
```

OSM:

```text
nearest industry: 18 km
```

Land cover:

```text
forest: 87%
```

History:

```text
cluster started 2 days ago
hotspots spreading northeast
```

Model:

```text
Forest/Wildfire: 94%
```

Final:

```text
NATURAL / VEGETATION FIRE
94% confidence

Evidence:
- dense forest
- no nearby industrial infrastructure
- rapidly changing fire perimeter
- recent rather than persistent thermal source
```

---

# 31. Third Example — Agricultural Burn

FIRMS:

```text
medium FRP
temporary detections
```

Context:

```text
cropland: 93%
industry nearby: none
```

History:

```text
similar seasonal burns in nearby fields
no stable hotspot
```

Prediction:

```text
Agricultural Burning: 89%
```

---

# 32. Fourth Example — Interesting Unknown Source

FIRMS history:

```text
72 active days / 90
location stable within 200 m
```

OSM:

```text
No refinery
No power plant
No known flare
No mapped industrial polygon
```

Land cover:

```text
built-up / bare industrial-looking terrain
```

Prediction:

```text
Persistent Unknown Thermal Source
Confidence: 91%
```

System generates:

```text
INVESTIGATION RECOMMENDED
```

This is a very strong demo scenario.

---

# 33. Pitch Structure

During your SIH presentation, explain the problem in this order.

## Slide 1 — Problem

> Satellite hotspot ≠ automatically a wildfire.

Show:

```text
Forest fire
Refinery flare
Steel plant
Agricultural burn
Mining activity

↓ can all create thermal detections ↓

NASA FIRMS hotspot
```

---

## Slide 2 — Gap

NASA FIRMS gives detection.

Your platform gives:

```text
Detection
+
Context
+
Classification
+
Persistence
+
Anomaly
+
Explanation
```

---

## Slide 3 — Architecture

Show the architecture diagram.

---

## Slide 4 — AI

Explain feature groups:

```text
FIRMS
OSM
Land cover
Temporal history
Satellite imagery
```

---

## Slide 5 — Live Demo

Click:

```text
wildfire
industrial flare
abnormal industrial event
```

Compare the evidence.

---

## Slide 6 — Accuracy

Show:

```text
confusion matrix
precision
recall
F1
false alarms
```

---

## Slide 7 — Impact

Explain:

- industrial monitoring,
- critical-infrastructure safety,
- emergency prioritization,
- remote monitoring,
- persistent source discovery,
- analyst decision support.

---

# 34. Final Demo Flow

Prepare a deterministic demo.

Do not rely entirely on live APIs during judging.

Keep a cached demo dataset.

### Demo sequence

1. Open national/regional map.
2. Show raw FIRMS hotspots.
3. Enable industrial facility layer.
4. Click a known persistent source.
5. Show historical recurrence.
6. Show model prediction.
7. Show evidence/SHAP.
8. Click a wildfire.
9. Compare differences.
10. Show abnormal industrial alert.
11. Show unknown persistent source.
12. Show analytics page.

Target:

**2–4 minutes for the core demo.**

---

# 35. Offline / Failure-Safe Demo Strategy

Keep:

```text
data/demo/
```

with:

- FIRMS sample events,
- selected OSM facilities,
- cached satellite images,
- precomputed predictions.

At startup allow:

```env
DEMO_MODE=true
```

If NASA/OSM APIs are temporarily unavailable during judging, your system still works.

---

# 36. Security and Reliability Basics

Even though this is primarily a geospatial intelligence prototype:

- never expose API keys in frontend code,
- use server-side API calls for keyed services,
- validate bounding boxes,
- rate-limit expensive endpoints,
- cache OSM/FIRMS results,
- preserve source attribution,
- log model versions,
- avoid silently changing historic predictions,
- maintain data-source timestamps.

---

# 37. Definition of Done

Before calling the project ready, verify all items.

## Data

- [ ] FIRMS API works.
- [ ] Raw attributes are preserved.
- [ ] Duplicate events are prevented.
- [ ] OSM facility ingestion works.
- [ ] Spatial enrichment works.
- [ ] Historical detections are available.

## Intelligence

- [ ] Events are clustered.
- [ ] Persistence score exists.
- [ ] Baseline classifier exists.
- [ ] ML classifier exists.
- [ ] Model has measurable validation results.
- [ ] Prediction confidence exists.
- [ ] Explanations exist.
- [ ] Unknown class exists.
- [ ] Abnormal persistent-source detection exists.

## GIS

- [ ] Hotspots shown.
- [ ] Industrial facilities shown.
- [ ] Predicted classes shown.
- [ ] Event history accessible.
- [ ] Filters work.
- [ ] Satellite/context imagery available.

## Product

- [ ] Alert dashboard.
- [ ] Analytics dashboard.
- [ ] Facility view.
- [ ] Mobile-friendly enough for demo.
- [ ] Cached demo mode.
- [ ] README.
- [ ] Architecture diagram.
- [ ] ML methodology.
- [ ] Evaluation report.

---

# 38. The Most Important Priority Order

If your team runs out of time, protect these features:

## Priority 1

```text
NASA FIRMS ingestion
```

## Priority 2

```text
OSM industrial geospatial enrichment
```

## Priority 3

```text
Temporal persistence engine
```

## Priority 4

```text
Industrial vs natural ML classifier
```

## Priority 5

```text
GIS dashboard
```

## Priority 6

```text
Explainability
```

## Priority 7

```text
Anomaly alerts
```

## Priority 8

```text
Satellite-image enrichment
```

## Priority 9

```text
Deep-learning image classifier
```

A polished Priority 1–7 project is better than an unfinished system attempting all nine.

---

# 39. Immediate Next Actions

Do these first.

### Today

- [ ] Create project repository.
- [ ] Request FIRMS MAP_KEY.
- [ ] Complete FIRMS Academy API tutorial.
- [ ] Download one VIIRS dataset.
- [ ] Load it with Pandas.
- [ ] Plot the points.
- [ ] Pick 3–5 known industrial facilities as test cases.

### Next

- [ ] Ingest OSM industrial data.
- [ ] Calculate hotspot-to-facility distances.
- [ ] Pull 30–90 day thermal history.
- [ ] Identify stable recurring hotspots.
- [ ] Build your first persistence score.

### Only after that

- [ ] Start model training.

---

# 40. Recommended Learning Path for a BCA Team

You do not need to become satellite scientists.

Learn exactly what the project needs.

## Level 1

- Python
- Pandas
- APIs
- CSV/JSON
- latitude/longitude

## Level 2

- GeoPandas
- PostGIS
- spatial joins
- distance calculations
- OSM/Overpass

## Level 3

- classification
- Random Forest
- XGBoost
- precision/recall/F1
- class imbalance

## Level 4

- DBSCAN
- time-series feature engineering
- anomaly detection
- SHAP

## Level 5

Optional:

- satellite raster processing
- CNNs
- image embeddings
- multi-modal ML

Do not learn Level 5 before Levels 1–4 are functioning.

---

# 41. Core Technical Hypothesis

The central hypothesis your team should test is:

> **Industrial and natural thermal events can be separated more reliably when satellite thermal intensity is combined with industrial proximity, land-use context, spatial stability, and temporal persistence rather than treating each FIRMS detection independently.**

That sentence can become the technical backbone of your project.

---

# 42. Suggested Model Experiment Table

Maintain this during development.

| Experiment | FIRMS | OSM | Land Cover | Temporal | Image | F1 |
|---|---|---|---|---|---|---:|
| Baseline rules | ✓ | ✓ | | | | |
| RF v1 | ✓ | ✓ | | | | |
| XGB v1 | ✓ | ✓ | ✓ | | | |
| XGB v2 | ✓ | ✓ | ✓ | ✓ | | |
| Multi-modal | ✓ | ✓ | ✓ | ✓ | ✓ | |

This will help prove which data source actually improves classification.

---

# 43. Source Attribution

Always show the source of each evidence item.

Example:

```text
Thermal detection:
NASA FIRMS / VIIRS NOAA-20

Industrial boundary:
OpenStreetMap

Land cover:
ESA WorldCover

Satellite context:
Sentinel-2 / Landsat
```

This improves trust and reproducibility.

---

# 44. Sources and Documentation

## SIH 2026 Problem Statement

SIH26162 — AI-Based Detection and Classification of Industrial Fires and Persistent Thermal Sources Using NASA FIRMS, OSM & Satellite Data.

Official SIH portal:

https://www.sih.gov.in/sih2026PS

---

## NASA FIRMS Academy

https://firms.modaps.eosdis.nasa.gov/academy

---

## NASA FIRMS API Tutorial

https://firms.modaps.eosdis.nasa.gov/content/academy/data_api/firms_api_use.html

---

## NASA FIRMS API

https://firms.modaps.eosdis.nasa.gov/api/

---

## FIRMS MAP_KEY

https://firms.modaps.eosdis.nasa.gov/api/map_key/

---

## FIRMS Active Fire Data

https://firms.modaps.eosdis.nasa.gov/active_fire

---

## FIRMS Archive Download

https://firms.modaps.eosdis.nasa.gov/download/

---

## VIIRS Active Fire / Hotspot Description

https://firms.modaps.eosdis.nasa.gov/content/descriptions/FIRMS_VIIRS_Firehotspots.html

---

## OpenStreetMap Industrial Land Use

https://wiki.openstreetmap.org/wiki/Tag:landuse%3Dindustrial

---

## OpenStreetMap Refinery Tag

https://wiki.openstreetmap.org/wiki/Tag:industrial%3Drefinery

---

## OpenStreetMap Power Plant Tag

https://wiki.openstreetmap.org/wiki/Tag:power%3Dplant

---

# 45. Final Recommendation

Build this project in **three intelligence layers**:

```text
LAYER 1
Where is the thermal anomaly?
→ NASA FIRMS

LAYER 2
What is around it and how has it behaved historically?
→ OSM + land cover + temporal persistence

LAYER 3
What does the evidence indicate?
→ ML classification + anomaly detection + explainability
```

The strongest version of this SIH project is **not a satellite-image classifier** and **not another fire map**.

It is a:

> **multi-source geospatial intelligence system that converts raw satellite thermal detections into explainable industrial-risk intelligence.**

That is the implementation target the team should work toward.
