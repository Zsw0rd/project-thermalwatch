# FIRMS sample snapshots

These CSV files are official NASA FIRMS South Asia snapshots retained as deterministic offline source data for ingestion, normalization, temporal analysis, and testing. The 24-hour files were downloaded on **2026-09-01**; the seven-day files were downloaded on **2026-09-02**.

| File | Sensor | Official source |
|---|---|---|
| `J1_VIIRS_C2_South_Asia_24h.csv` | VIIRS NOAA-20 | `https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_Asia_24h.csv` |
| `J2_VIIRS_C2_South_Asia_24h.csv` | VIIRS NOAA-21 | `https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_South_Asia_24h.csv` |
| `SUOMI_VIIRS_C2_South_Asia_24h.csv` | VIIRS S-NPP | `https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_Asia_24h.csv` |
| `J1_VIIRS_C2_South_Asia_7d.csv` | VIIRS NOAA-20 | `https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_Asia_7d.csv` |
| `J2_VIIRS_C2_South_Asia_7d.csv` | VIIRS NOAA-21 | `https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_South_Asia_7d.csv` |
| `SUOMI_VIIRS_C2_South_Asia_7d.csv` | VIIRS S-NPP | `https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_Asia_7d.csv` |

The retained seven-day regional files contain 3,978 NOAA-20, 3,271 NOAA-21, and 3,717 S-NPP source rows. A rolling seven-day product can touch eight UTC calendar dates because its first and last dates are partial days; the API reports its exact observed start, end, and inclusive calendar-date count.

The backend filters this regional source to the configured India bounding box. Bounding-box inclusion is not the same as a precise country-boundary spatial join; that limitation is surfaced by the API.

These are active-fire/thermal-anomaly observations, not confirmed incidents and not model ground truth.

## Development model benchmark

`model_benchmark_report.json` is a reproducible report generated from the pinned offline evidence using `ml/train_tabular.py`. It records the dataset fingerprint, 41-feature contract, complete spatial-block train/test split, candidate metrics, local compute inventory, library versions, artifact hashes, and limitations.

Its current labels come from the existing deterministic classification rules, not analysts or confirmed incidents. Therefore every reported score measures weak-label agreement only. The report is safe for pipeline and UI development but is not evidence of real-world model accuracy, does not satisfy the reviewed-label gate, and cannot change the operational model automatically. Binary model files are reproducible local outputs and remain ignored under `ml/models/`.

## OpenStreetMap context snapshot

`osm_india_industrial_context.json` is a bounded Overpass snapshot retrieved on **2026-09-01** from OpenStreetMap. It contains mapped refineries, flares, power plants, steelmaking sites, and quarries whose representative point or geometry center falls within the configured bounding box.

The snapshot is licensed under the [Open Database License](https://www.openstreetmap.org/copyright). Map and evidence views must retain OpenStreetMap attribution. Geometry-center proximity is an MVP approximation: it is not the same as point-in-polygon containment and incomplete OSM mapping does not prove that a facility is absent.
