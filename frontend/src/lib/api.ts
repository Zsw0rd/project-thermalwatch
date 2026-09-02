import type {
  AnalyticsDashboard,
  DashboardDataset,
  EventClass,
  IndustrialFacility,
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
      : "NASA FIRMS detected a thermal anomaly. The result combines sensor confidence, OSM proximity, and seven-day recurrence; land cover and incident confirmation are not yet available.",
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

export async function fetchOperationalEvents(signal?: AbortSignal): Promise<DashboardDataset> {
  const [eventResponse, facilityResponse, alertResponse, clusterResponse, analyticsResponse] = await Promise.all([
    fetch(`${API_BASE_URL}/events?min_frp=1&window_hours=24&limit=2000`, {
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
  ]);
  if (!eventResponse.ok) {
    throw new Error(`ThermalWatch API returned ${eventResponse.status}`);
  }
  const body = (await eventResponse.json()) as ApiEventCollection;
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
  }));
  return {
    events: body.events.map(adaptOperationalEvent),
    facilities,
    alertCount: alertBody.total,
    total: body.total,
    returned: body.returned,
    sourceUpdatedAt: body.source_updated_at,
    limitations: body.scope_limitations,
    clusters: clusterBody.clusters.map(adaptCluster),
    alerts,
    analytics: analyticsBody ? adaptAnalytics(analyticsBody) : null,
  };
}
