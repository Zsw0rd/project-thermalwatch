import type {
  AnalyticsDashboard,
  DashboardDataset,
  EventClass,
  FacilityMonitor,
  IndustrialFacility,
  PlaybackFrame,
  ReviewAlert,
  ThermalEvent,
  ThermalClusterSummary,
} from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

type ApiEvidenceEvent = {
  id: string;
  source: string;
  latitude: number;
  longitude: number;
  acquired_at: string;
  satellite: string;
  confidence: "low" | "nominal" | "high" | "unknown";
  frp_mw: number;
  brightness_i4_k: number | null;
  brightness_i5_k: number | null;
  brightness_delta_k: number | null;
  day_night: "D" | "N" | "U";
  cluster_id: string;
  cluster_detection_count: number;
  cluster_sensor_count: number;
  recurrence_score: number;
  observation_window_days: number;
  active_days: number;
  first_seen: string;
  last_seen: string;
  baseline_frp_mw: number;
  frp_mad_mw: number;
  anomaly_score: number | null;
  anomaly_status: "elevated" | "within_observed_range" | "insufficient_baseline";
  temporal_history: Array<{
    date: string;
    detection_count: number;
    mean_frp_mw: number;
    max_frp_mw: number;
  }>;
  category: EventClass;
  classification: string;
  classification_confidence: number;
  severity: ThermalEvent["severity"];
  explanation: string[];
  context_status: string;
  nearest_facility: {
    osm_id: string;
    name: string;
    facility_type: string;
    distance_m: number;
    operator: string | null;
    source: "OpenStreetMap";
  } | null;
  land_cover: {
    provider: "NASA EOSDIS GIBS";
    product: "MCD12Q1.061 MODIS IGBP annual land cover";
    observation_date: string;
    igbp_values: number[];
    class_label: string;
    group: "vegetation" | "cropland" | "built_up" | "barren" | "water" | "snow_ice" | "unclassified";
    native_resolution_m: number;
    sampling_method: string;
    source_url: string;
  } | null;
  source_attribution: {
    provider: string;
    product: string;
    source_url: string;
    acquired_at: string;
    retrieved_at: string;
  };
  model_version: string;
  feature_version: string;
};

type ApiEventCollection = {
  mode: "operational";
  generated_at: string;
  source_updated_at: string;
  geographic_scope: string;
  scope_limitations: string[];
  total: number;
  returned: number;
  events: ApiEvidenceEvent[];
};

type ApiFacilityCollection = {
  total: number;
  facilities: Array<{
    osm_id: string;
    name: string;
    facility_type: string;
    latitude: number;
    longitude: number;
    operator: string | null;
  }>;
};

type ApiAlertCollection = {
  total: number;
  alerts: Array<{
    id: string;
    event_id: string;
    cluster_id: string;
    alert_type: string;
    severity: ThermalEvent["severity"];
    title: string;
    reason: string;
    acquired_at: string;
    frp_mw: number;
    evidence: string[];
    review_status: ReviewAlert["reviewStatus"];
    review_note: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
  }>;
};

type ApiPlaybackCollection = {
  frames: Array<{
    date: string;
    detection_count: number;
    cluster_count: number;
    new_cluster_count: number;
    active_persistent_cells: number;
    high_frp_count: number;
    mean_frp_mw: number;
    event_ids: string[];
  }>;
};

type ApiFacilityMonitorCollection = {
  monitors: Array<{
    monitor_id: string;
    facility: {
      osm_id: string;
      name: string;
      facility_type: string;
      latitude: number;
      longitude: number;
      operator: string | null;
    };
    representative_event_id: string;
    observed_detections: number;
    cluster_count: number;
    sensor_count: number;
    active_days: number;
    observation_window_days: number;
    first_seen: string;
    last_seen: string;
    median_frp_mw: number;
    maximum_frp_mw: number;
    latest_frp_mw: number;
    persistence_score: number;
    anomaly_status: FacilityMonitor["anomalyStatus"];
    operating_status: FacilityMonitor["operatingStatus"];
    alert_count: number;
    history: Array<{
      date: string;
      detection_count: number;
      mean_frp_mw: number;
      max_frp_mw: number;
    }>;
    evidence: string[];
    caveat: string;
  }>;
};

type ApiCluster = {
  cluster_id: string;
  representative_event_id: string;
  centroid_latitude: number;
  centroid_longitude: number;
  detection_count: number;
  sensor_count: number;
  active_days: number;
  observation_window_days: number;
  first_seen: string;
  last_seen: string;
  mean_frp_mw: number;
  median_frp_mw: number;
  max_frp_mw: number;
  latest_frp_mw: number;
  anomaly_score: number | null;
  anomaly_status: ThermalClusterSummary["anomalyStatus"];
  persistence_score: number;
  persistence_label: ThermalClusterSummary["persistenceLabel"];
  classification: string;
  category: EventClass;
  nearest_facility: {
    name: string;
    facility_type: string;
    distance_m: number;
  } | null;
  evidence: string[];
};

type ApiClusterCollection = { clusters: ApiCluster[] };

type ApiAnalyticsDashboard = {
  observation_window_start: string;
  observation_window_end: string;
  observation_window_days: number;
  total_events: number;
  total_clusters: number;
  persistent_candidates: number;
  recurring_candidates: number;
  elevated_clusters: number;
  unmapped_persistent_candidates: number;
  category_counts: Record<string, number>;
  severity_counts: Record<string, number>;
  daily_activity: Array<{
    date: string;
    detections: number;
    mean_frp_mw: number;
    industrial_context_events: number;
  }>;
  methodology: string;
};

const confidenceLabel = (value: ApiEvidenceEvent["confidence"]) =>
  value === "unknown" ? "Unspecified" : value[0].toUpperCase() + value.slice(1);

const adaptOperationalEvent = (event: ApiEvidenceEvent): ThermalEvent => {
  const acquired = new Date(event.acquired_at);
  const chartDate = acquired.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
  const confidence = Math.round(event.classification_confidence * 100);
  const facility = event.nearest_facility;
  const industrialContext = event.category === "industrial" && facility;
  const landCover = event.land_cover;

  return {
    id: event.id,
    shortId: `NF-${event.id.slice(0, 6).toUpperCase()}`,
    title:
      event.cluster_sensor_count >= 2
        ? `Multi-sensor cluster ${event.cluster_id.slice(-4)}`
        : `VIIRS anomaly ${event.id.slice(0, 5).toUpperCase()}`,
    region: "Configured India bounding-box feed",
    coordinates: [event.longitude, event.latitude],
    classification: event.classification,
    category: event.category,
    confidence,
    severity: event.severity,
    status:
      event.anomaly_status === "elevated"
        ? "Elevated vs observed baseline"
        : event.active_days >= 4
          ? "Persistent-source candidate"
          : event.cluster_sensor_count >= 2
            ? "Cross-sensor corroboration"
            : "Context enrichment pending",
    acquiredAt: event.acquired_at,
    firstSeen: event.first_seen,
    detectedAt: acquired.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }) + " UTC",
    sensor: `${event.source} · ${event.satellite}`,
    sensorCount: event.cluster_sensor_count,
    frp: event.frp_mw,
    baselineFrp: event.baseline_frp_mw,
    brightness: event.brightness_i4_k ?? 0,
    persistence: Math.round(event.recurrence_score * 100),
    activeDays: event.active_days,
    historyWindow: event.observation_window_days,
    nearestFacility: facility?.name ?? "No supported OSM facility within 25 km",
    facilityDistance: facility ? `${facility.distance_m.toLocaleString("en-IN")} m` : "Not found",
    isNew: event.active_days === 1,
    summary: industrialContext
      ? `NASA FIRMS detected a thermal anomaly near a mapped ${facility.facility_type.replaceAll("_", " ")}. Seven-day recurrence and robust FRP deviation are included, but proximity does not confirm a fire or incident.`
      : landCover
        ? `NASA FIRMS detected a thermal anomaly over ${landCover.class_label.toLowerCase()}. Annual MODIS land cover and seven-day recurrence support a candidate classification, not incident confirmation.`
        : "NASA FIRMS detected a thermal anomaly. The result combines sensor confidence, OSM proximity, and seven-day recurrence; incident confirmation is not available.",
    evidence: [
      {
        label: "FIRMS confidence",
        value: confidenceLabel(event.confidence),
        impact: event.confidence === "high" ? "positive" : "neutral",
        source: `${event.source_attribution.provider} · ${event.source_attribution.product}`,
      },
      {
        label: "Thermal intensity",
        value: `${event.frp_mw.toFixed(2)} MW FRP`,
        impact: "neutral",
        source: "NASA FIRMS source record",
      },
      {
        label: "Observed recurrence",
        value: `${event.active_days}/${event.observation_window_days} active days · ${event.cluster_sensor_count} sensor(s)`,
        impact: event.active_days >= 4 ? "positive" : "neutral",
        source: "ThermalWatch temporal engine · NASA FIRMS 7-day snapshot",
      },
      {
        label: "Robust FRP baseline",
        value: `${event.baseline_frp_mw.toFixed(2)} MW median · MAD ${event.frp_mad_mw.toFixed(2)}`,
        impact: event.anomaly_status === "elevated" ? "positive" : "neutral",
        source: "ThermalWatch rules_temporal_v2",
      },
      {
        label: "Context status",
        value: facility
          ? `${facility.facility_type.replaceAll("_", " ")} · ${facility.distance_m.toFixed(0)} m`
          : "No supported facility within 25 km",
        impact: industrialContext ? "positive" : "neutral",
        source: facility ? "OpenStreetMap / Overpass snapshot" : "ThermalWatch OSM proximity scan",
      },
      ...(landCover
        ? [{
            label: "Land-cover context",
            value: `${landCover.class_label} · ${landCover.observation_date.slice(0, 4)}`,
            impact: landCover.group === "cropland" || landCover.group === "vegetation" ? "positive" as const : "neutral" as const,
            source: `${landCover.provider} · ${landCover.product}`,
          }]
        : []),
    ],
    history: event.temporal_history.length
      ? event.temporal_history.map((point) => ({
          date: new Date(`${point.date}T00:00:00Z`).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            timeZone: "UTC",
          }),
          frp: point.mean_frp_mw,
          baseline: event.baseline_frp_mw,
        }))
      : [{ date: chartDate, frp: event.frp_mw, baseline: event.baseline_frp_mw }],
    dataOrigin: "nasa-firms",
    sourceUrl: event.source_attribution.source_url,
    clusterId: event.cluster_id,
    anomalyStatus: event.anomaly_status,
    anomalyScore: event.anomaly_score ?? undefined,
    modelVersion: event.model_version,
    featureVersion: event.feature_version,
    landCover: landCover
      ? {
          provider: landCover.provider,
          product: landCover.product,
          observationDate: landCover.observation_date,
          igbpValues: landCover.igbp_values,
          classLabel: landCover.class_label,
          group: landCover.group,
          nativeResolutionM: landCover.native_resolution_m,
          samplingMethod: landCover.sampling_method,
          sourceUrl: landCover.source_url,
        }
      : undefined,
  };
};

const adaptCluster = (cluster: ApiCluster): ThermalClusterSummary => ({
  clusterId: cluster.cluster_id,
  representativeEventId: cluster.representative_event_id,
  coordinates: [cluster.centroid_longitude, cluster.centroid_latitude],
  detectionCount: cluster.detection_count,
  sensorCount: cluster.sensor_count,
  activeDays: cluster.active_days,
  observationWindowDays: cluster.observation_window_days,
  firstSeen: cluster.first_seen,
  lastSeen: cluster.last_seen,
  meanFrp: cluster.mean_frp_mw,
  medianFrp: cluster.median_frp_mw,
  maxFrp: cluster.max_frp_mw,
  latestFrp: cluster.latest_frp_mw,
  anomalyScore: cluster.anomaly_score,
  anomalyStatus: cluster.anomaly_status,
  persistenceScore: cluster.persistence_score,
  persistenceLabel: cluster.persistence_label,
  classification: cluster.classification,
  category: cluster.category,
  facilityName: cluster.nearest_facility?.name ?? null,
  facilityType: cluster.nearest_facility?.facility_type ?? null,
  facilityDistanceM: cluster.nearest_facility?.distance_m ?? null,
  evidence: cluster.evidence,
});

const adaptAnalytics = (body: ApiAnalyticsDashboard): AnalyticsDashboard => ({
  observationWindowStart: body.observation_window_start,
  observationWindowEnd: body.observation_window_end,
  observationWindowDays: body.observation_window_days,
  totalEvents: body.total_events,
  totalClusters: body.total_clusters,
  persistentCandidates: body.persistent_candidates,
  recurringCandidates: body.recurring_candidates,
  elevatedClusters: body.elevated_clusters,
  unmappedPersistentCandidates: body.unmapped_persistent_candidates,
  categoryCounts: body.category_counts,
  severityCounts: body.severity_counts,
  dailyActivity: body.daily_activity.map((point) => ({
    date: point.date,
    detections: point.detections,
    meanFrp: point.mean_frp_mw,
    industrialContextEvents: point.industrial_context_events,
  })),
  methodology: body.methodology,
});

const adaptPlayback = (body: ApiPlaybackCollection): PlaybackFrame[] =>
  body.frames.map((frame) => ({
    date: frame.date,
    detectionCount: frame.detection_count,
    clusterCount: frame.cluster_count,
    newClusterCount: frame.new_cluster_count,
    activePersistentCells: frame.active_persistent_cells,
    highFrpCount: frame.high_frp_count,
    meanFrp: frame.mean_frp_mw,
    eventIds: frame.event_ids,
  }));

const adaptFacilityMonitor = (
  monitor: ApiFacilityMonitorCollection["monitors"][number],
): FacilityMonitor => ({
  monitorId: monitor.monitor_id,
  facility: {
    id: monitor.facility.osm_id,
    name: monitor.facility.name,
    facilityType: monitor.facility.facility_type,
    coordinates: [monitor.facility.longitude, monitor.facility.latitude],
    operator: monitor.facility.operator ?? undefined,
  },
  representativeEventId: monitor.representative_event_id,
  observedDetections: monitor.observed_detections,
  clusterCount: monitor.cluster_count,
  sensorCount: monitor.sensor_count,
  activeDays: monitor.active_days,
  observationWindowDays: monitor.observation_window_days,
  firstSeen: monitor.first_seen,
  lastSeen: monitor.last_seen,
  medianFrp: monitor.median_frp_mw,
  maximumFrp: monitor.maximum_frp_mw,
  latestFrp: monitor.latest_frp_mw,
  persistenceScore: monitor.persistence_score,
  anomalyStatus: monitor.anomaly_status,
  operatingStatus: monitor.operating_status,
  alertCount: monitor.alert_count,
  history: monitor.history.map((point) => ({
    date: point.date,
    detectionCount: point.detection_count,
    meanFrp: point.mean_frp_mw,
    maxFrp: point.max_frp_mw,
  })),
  evidence: monitor.evidence,
  caveat: monitor.caveat,
});

export async function fetchOperationalEvents(signal?: AbortSignal): Promise<DashboardDataset> {
  const [
    eventResponse,
    historyResponse,
    facilityResponse,
    alertResponse,
    clusterResponse,
    analyticsResponse,
    playbackResponse,
    monitorResponse,
  ] = await Promise.all([
    fetch(`${API_BASE_URL}/events?min_frp=1&window_hours=24&limit=2000`, {
      signal,
      cache: "no-store",
    }),
    fetch(`${API_BASE_URL}/events?limit=5000`, {
      signal,
      cache: "no-store",
    }),
    fetch(`${API_BASE_URL}/facilities?limit=800`, {
      signal,
      cache: "no-store",
    }),
    fetch(`${API_BASE_URL}/alerts`, {
      signal,
      cache: "no-store",
    }),
    fetch(`${API_BASE_URL}/clusters?limit=100`, { signal, cache: "no-store" }),
    fetch(`${API_BASE_URL}/analytics/dashboard`, { signal, cache: "no-store" }),
    fetch(`${API_BASE_URL}/playback`, { signal, cache: "no-store" }),
    fetch(`${API_BASE_URL}/facility-monitors?limit=100`, { signal, cache: "no-store" }),
  ]);
  if (!eventResponse.ok) {
    throw new Error(`ThermalWatch API returned ${eventResponse.status}`);
  }
  const body = (await eventResponse.json()) as ApiEventCollection;
  const historyBody: ApiEventCollection = historyResponse.ok
    ? ((await historyResponse.json()) as ApiEventCollection)
    : body;
  const facilityBody: ApiFacilityCollection = facilityResponse.ok
    ? ((await facilityResponse.json()) as ApiFacilityCollection)
    : { total: 0, facilities: [] };
  const alertBody: ApiAlertCollection = alertResponse.ok
    ? ((await alertResponse.json()) as ApiAlertCollection)
    : { total: 0, alerts: [] };
  const clusterBody: ApiClusterCollection = clusterResponse.ok
    ? ((await clusterResponse.json()) as ApiClusterCollection)
    : { clusters: [] };
  const analyticsBody = analyticsResponse.ok
    ? ((await analyticsResponse.json()) as ApiAnalyticsDashboard)
    : null;
  const playbackBody: ApiPlaybackCollection = playbackResponse.ok
    ? ((await playbackResponse.json()) as ApiPlaybackCollection)
    : { frames: [] };
  const monitorBody: ApiFacilityMonitorCollection = monitorResponse.ok
    ? ((await monitorResponse.json()) as ApiFacilityMonitorCollection)
    : { monitors: [] };
  const facilities: IndustrialFacility[] = facilityBody.facilities.map((facility) => ({
    id: facility.osm_id,
    name: facility.name,
    facilityType: facility.facility_type,
    coordinates: [facility.longitude, facility.latitude],
    operator: facility.operator ?? undefined,
  }));
  const alerts: ReviewAlert[] = alertBody.alerts.map((alert) => ({
    id: alert.id,
    eventId: alert.event_id,
    clusterId: alert.cluster_id,
    alertType: alert.alert_type,
    severity: alert.severity,
    title: alert.title,
    reason: alert.reason,
    acquiredAt: alert.acquired_at,
    frp: alert.frp_mw,
    evidence: alert.evidence,
    reviewStatus: alert.review_status,
    reviewNote: alert.review_note,
    reviewedBy: alert.reviewed_by,
    reviewedAt: alert.reviewed_at,
  }));
  return {
    events: body.events.map(adaptOperationalEvent),
    facilities,
    alertCount: alerts.filter((alert) => alert.reviewStatus !== "closed").length,
    total: body.total,
    returned: body.returned,
    sourceUpdatedAt: body.source_updated_at,
    limitations: body.scope_limitations,
    clusters: clusterBody.clusters.map(adaptCluster),
    alerts,
    analytics: analyticsBody ? adaptAnalytics(analyticsBody) : null,
    historicalEvents: historyBody.events.map(adaptOperationalEvent),
    playback: adaptPlayback(playbackBody),
    facilityMonitors: monitorBody.monitors.map(adaptFacilityMonitor),
  };
}

export async function updateAlertReview(
  alertId: string,
  status: ReviewAlert["reviewStatus"],
): Promise<ReviewAlert> {
  const response = await fetch(`${API_BASE_URL}/alerts/${alertId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status,
      note: "Updated from the ThermalWatch analyst workspace",
      reviewed_by: "web_analyst",
    }),
  });
  if (!response.ok) throw new Error(`Alert update failed with ${response.status}`);
  const alert = (await response.json()) as ApiAlertCollection["alerts"][number];
  return {
    id: alert.id,
    eventId: alert.event_id,
    clusterId: alert.cluster_id,
    alertType: alert.alert_type,
    severity: alert.severity,
    title: alert.title,
    reason: alert.reason,
    acquiredAt: alert.acquired_at,
    frp: alert.frp_mw,
    evidence: alert.evidence,
    reviewStatus: alert.review_status,
    reviewNote: alert.review_note,
    reviewedBy: alert.reviewed_by,
    reviewedAt: alert.reviewed_at,
  };
}
