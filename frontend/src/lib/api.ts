import type {
  DashboardDataset,
  EventClass,
  IndustrialFacility,
  ThermalEvent,
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
      event.cluster_sensor_count >= 2
        ? "Cross-sensor corroboration"
        : "Context enrichment pending",
    detectedAt: acquired.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }) + " UTC",
    sensor: `${event.source} · ${event.satellite}`,
    frp: event.frp_mw,
    baselineFrp: 0,
    brightness: event.brightness_i4_k ?? 0,
    persistence: Math.round(event.recurrence_score * 100),
    activeDays: event.cluster_detection_count,
    historyWindow: event.cluster_sensor_count,
    nearestFacility: facility?.name ?? "No supported OSM facility within 25 km",
    facilityDistance: facility ? `${facility.distance_m.toLocaleString("en-IN")} m` : "Not found",
    isNew: true,
    summary: industrialContext
      ? `NASA FIRMS detected a thermal anomaly near a mapped ${facility.facility_type.replaceAll("_", " ")}. Proximity increases industrial-context likelihood but does not confirm a fire or incident.`
      : "NASA FIRMS detected a thermal anomaly. The current result reflects sensor confidence, OSM proximity, and 24-hour co-observation only; land cover and incident confirmation are not yet available.",
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
        label: "Snapshot co-observation",
        value: `${event.cluster_detection_count} detection(s) · ${event.cluster_sensor_count} sensor(s)`,
        impact: event.cluster_sensor_count >= 2 ? "positive" : "neutral",
        source: "ThermalWatch ~1 km grid grouping",
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
    history: [
      {
        date: chartDate,
        frp: event.frp_mw,
        baseline: 0,
      },
    ],
    dataOrigin: "nasa-firms",
    sourceUrl: event.source_attribution.source_url,
  };
};

export async function fetchOperationalEvents(signal?: AbortSignal): Promise<DashboardDataset> {
  const [eventResponse, facilityResponse, alertResponse] = await Promise.all([
    fetch(`${API_BASE_URL}/events?min_frp=1&limit=350`, {
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
    : { total: 0 };
  const facilities: IndustrialFacility[] = facilityBody.facilities.map((facility) => ({
    id: facility.osm_id,
    name: facility.name,
    facilityType: facility.facility_type,
    coordinates: [facility.longitude, facility.latitude],
    operator: facility.operator ?? undefined,
  }));
  return {
    events: body.events.map(adaptOperationalEvent),
    facilities,
    alertCount: alertBody.total,
    total: body.total,
    returned: body.returned,
    sourceUpdatedAt: body.source_updated_at,
    limitations: body.scope_limitations,
  };
}
