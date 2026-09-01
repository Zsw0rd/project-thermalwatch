# FIRMS sample snapshot

These CSV files are an official NASA FIRMS 24-hour South Asia snapshot downloaded on **2026-09-01**. They are retained as deterministic offline source data for ingestion and normalization testing.

| File | Sensor | Official source |
|---|---|---|
| `J1_VIIRS_C2_South_Asia_24h.csv` | VIIRS NOAA-20 | `https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_Asia_24h.csv` |
| `J2_VIIRS_C2_South_Asia_24h.csv` | VIIRS NOAA-21 | `https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_South_Asia_24h.csv` |
| `SUOMI_VIIRS_C2_South_Asia_24h.csv` | VIIRS S-NPP | `https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_Asia_24h.csv` |

The backend filters this regional source to the configured India bounding box. Bounding-box inclusion is not the same as a precise country-boundary spatial join; that limitation is surfaced by the API.

These are active-fire/thermal-anomaly observations, not confirmed incidents and not model ground truth.

## OpenStreetMap context snapshot

`osm_india_industrial_context.json` is a bounded Overpass snapshot retrieved on **2026-09-01** from OpenStreetMap. It contains mapped refineries, flares, power plants, steelmaking sites, and quarries whose representative point or geometry center falls within the configured bounding box.

The snapshot is licensed under the [Open Database License](https://www.openstreetmap.org/copyright). Map and evidence views must retain OpenStreetMap attribution. Geometry-center proximity is an MVP approximation: it is not the same as point-in-polygon containment and incomplete OSM mapping does not prove that a facility is absent.
