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
};
