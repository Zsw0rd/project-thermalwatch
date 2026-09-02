export type EventClass =
  | "industrial"
  | "vegetation"
  | "agricultural"
  | "unknown";

export type AlertSeverity = "critical" | "high" | "medium" | "low";

export type ThermalHistoryPoint = {
  date: string;
  frp: number;
  baseline: number;
};

export type EvidenceItem = {
  label: string;
  value: string;
  impact: "positive" | "negative" | "neutral";
  source: string;
};

export type ThermalEvent = {
  id: string;
  shortId: string;
  title: string;
  region: string;
  coordinates: [number, number];
  classification: string;
  category: EventClass;
  confidence: number;
  severity: AlertSeverity;
  status: string;
  detectedAt: string;
  sensor: string;
  sensorCount?: number;
  frp: number;
  baselineFrp: number;
  brightness: number;
  persistence: number;
  activeDays: number;
  historyWindow: number;
  nearestFacility: string;
  facilityDistance: string;
  isNew: boolean;
  summary: string;
  evidence: EvidenceItem[];
  history: ThermalHistoryPoint[];
  dataOrigin?: "simulation" | "nasa-firms";
  sourceUrl?: string;
  clusterId?: string;
  anomalyStatus?: "elevated" | "within_observed_range" | "insufficient_baseline";
  anomalyScore?: number;
  modelVersion?: string;
  featureVersion?: string;
};

export type IndustrialFacility = {
  id: string;
  name: string;
  facilityType: string;
  coordinates: [number, number];
  operator?: string;
};

export type DashboardDataset = {
  events: ThermalEvent[];
  facilities: IndustrialFacility[];
  alertCount: number;
  total: number;
  returned: number;
  sourceUpdatedAt: string;
  limitations: string[];
  clusters: ThermalClusterSummary[];
  alerts: ReviewAlert[];
  analytics: AnalyticsDashboard | null;
};

export type ThermalClusterSummary = {
  clusterId: string;
  representativeEventId: string;
  coordinates: [number, number];
  detectionCount: number;
  sensorCount: number;
  activeDays: number;
  observationWindowDays: number;
  firstSeen: string;
  lastSeen: string;
  meanFrp: number;
  medianFrp: number;
  maxFrp: number;
  latestFrp: number;
  anomalyScore: number | null;
  anomalyStatus: "elevated" | "within_observed_range" | "insufficient_baseline";
  persistenceScore: number;
  persistenceLabel: "persistent_candidate" | "recurring_candidate" | "insufficient_history";
  classification: string;
  category: EventClass;
  facilityName: string | null;
  facilityType: string | null;
  facilityDistanceM: number | null;
  evidence: string[];
};

export type ReviewAlert = {
  id: string;
  eventId: string;
  clusterId: string;
  alertType: string;
  severity: AlertSeverity;
  title: string;
  reason: string;
  acquiredAt: string;
  frp: number;
  evidence: string[];
};

export type DailyAnalyticsPoint = {
  date: string;
  detections: number;
  meanFrp: number;
  industrialContextEvents: number;
};

export type AnalyticsDashboard = {
  observationWindowStart: string;
  observationWindowEnd: string;
  observationWindowDays: number;
  totalEvents: number;
  totalClusters: number;
  persistentCandidates: number;
  recurringCandidates: number;
  elevatedClusters: number;
  unmappedPersistentCandidates: number;
  categoryCounts: Record<string, number>;
  severityCounts: Record<string, number>;
  dailyActivity: DailyAnalyticsPoint[];
  methodology: string;
};
