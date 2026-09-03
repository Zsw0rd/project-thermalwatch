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

export type LandCoverContext = {
  provider: "NASA EOSDIS GIBS";
  product: "MCD12Q1.061 MODIS IGBP annual land cover";
  observationDate: string;
  igbpValues: number[];
  classLabel: string;
  group:
    | "vegetation"
    | "cropland"
    | "built_up"
    | "barren"
    | "water"
    | "snow_ice"
    | "unclassified";
  nativeResolutionM: number;
  samplingMethod: string;
  sourceUrl: string;
};

export type AdministrativeAreaContext = {
  provider: "geoBoundaries";
  dataset: "gbOpen";
  countryName: "India";
  iso3: "IND";
  boundaryLevel: "ADM0";
  boundaryId: string;
  shapeId: string;
  boundaryYear: number;
  license: string;
  containmentMethod: string;
  sourceUrl: string;
};

export type IndiaBoundary = GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon
>;

export type HistoryReadiness = {
  observationWindowStart: string | null;
  observationWindowEnd: string | null;
  observedCalendarDays: number;
  calendarSpanDays: number;
  uniqueEvents: number;
  uniqueCells: number;
  archiveSnapshotFiles: number;
  bundledSeedFiles: number;
  readiness30Percent: number;
  readiness90Percent: number;
  status: "insufficient_history" | "thirty_day_candidate" | "ninety_day_ready";
  methodology: string;
  caveats: string[];
};

export type ModelTrainingReadiness = {
  status: "blocked_insufficient_reviewed_labels" | "ready_for_reviewed_training";
  currentOperationalModel: string;
  currentFeatureVersion: string;
  reviewedRecords: number;
  reviewedClusters: number;
  eligibleReviewedSamples: number;
  excludedOrUncertainReviews: number;
  weakLabelSamples: number;
  reviewedLabelCounts: Record<EventClass, number>;
  weakLabelCounts: Record<EventClass, number>;
  reviewedSpatialGroups: number;
  weakLabelSpatialGroups: number;
  requiredReviewedSamples: number;
  requiredSamplesPerClass: number;
  requiredSpatialGroupsPerClass: number;
  requiredClasses: EventClass[];
  featureCount: number;
  featureNames: string[];
  candidateModels: string[];
  labelPolicy: string;
  splitPolicy: string;
  blockers: string[];
  recommendedNextAction: string;
};

export type ModelBenchmarkMetrics = {
  balancedAccuracy: number;
  macroF1: number;
  industrialPrecision: number;
  industrialRecall: number;
  industrialF1: number;
  labels: EventClass[];
  confusionMatrix: number[][];
};

export type ModelBenchmarkCandidate = {
  model: string;
  device: string;
  requestedDevice?: string;
  fallbackReason?: string | null;
  trainingSeconds: number;
  evaluationLanguage: string;
  metrics: ModelBenchmarkMetrics;
  featureImportances: Record<string, number>;
};

export type ModelBenchmarkReport = {
  generatedAt: string;
  labelProvenance: "weak_rules" | "analyst_reviewed";
  evaluationLanguage: string;
  sampleCount: number;
  featureCount: number;
  classCounts: Record<EventClass, number>;
  spatialGroupCount: number;
  trainSamples: number;
  testSamples: number;
  trainSpatialGroups: number;
  testSpatialGroups: number;
  spatialGroupOverlap: string[];
  selectedDevelopmentCandidate: string;
  productionEligible: boolean;
  operationalModelUnchanged: string;
  rulesBaseline: ModelBenchmarkCandidate;
  candidateModels: ModelBenchmarkCandidate[];
  gpuInventory: {
    available: boolean;
    devices: Array<{
      name: string;
      memoryMib: number;
      driverVersion: string;
    }>;
  };
  libraryVersions: Record<string, string>;
  limitations: string[];
};

export type ModelBenchmarkEnvelope = {
  available: boolean;
  status: "not_run" | "development_only" | "reviewed_evaluation";
  message: string;
  report: ModelBenchmarkReport | null;
};

export type EvidenceGraphNode = {
  nodeId: string;
  kind: "observation" | "temporal" | "spatial" | "context" | "classification" | "limitation";
  label: string;
  value: string;
  source: string;
  sourceUrl: string | null;
  direction: "supports" | "limits" | "neutral";
};

export type EventEvidenceGraph = {
  eventId: string;
  clusterId: string;
  classificationNodeId: string;
  classification: string;
  category: EventClass;
  confidence: number;
  modelVersion: string;
  featureVersion: string;
  nodes: EvidenceGraphNode[];
  edges: Array<{
    sourceNodeId: string;
    targetNodeId: string;
    relation: "supports" | "limits" | "contextualizes";
  }>;
  interpretationBoundary: string;
};

export type ClusteringSensitivityVariant = {
  epsilonM: number;
  minSamples: number;
  isOperationalSetting: boolean;
  totalClusters: number;
  multiEventClusters: number;
  largestClusterEvents: number;
  coreEvents: number;
  borderEvents: number;
  noiseEvents: number;
  noisePercent: number;
  medianSupportedRadiusM: number;
  p95SupportedRadiusM: number;
  maximumSupportedRadiusM: number;
  coMembershipJaccardVsOperational: number;
};

export type ClusteringSensitivityReport = {
  eventCount: number;
  operationalEpsilonM: number;
  operationalMinSamples: number;
  variants: ClusteringSensitivityVariant[];
  methodology: string;
  caveats: string[];
};

export type ModelRegistryEntry = {
  version: string;
  family: string;
  lifecycle: "operational" | "development_only" | "evaluation_only";
  serving: boolean;
  labelProvenance: string;
  featureVersion: string;
  artifactFile: string | null;
  artifactSha256: string | null;
  device: string;
  metricName: string | null;
  metricValue: number | null;
  promotionStatus: string;
  notes: string[];
};

export type ModelRegistry = {
  operationalVersion: string;
  rollbackTarget: string;
  entries: ModelRegistryEntry[];
  promotionPolicy: string[];
};

export type ThermalSourceFingerprint = {
  fingerprintId: string;
  clusterId: string;
  representativeEventId: string;
  coordinates: [number, number];
  category: EventClass;
  classification: string;
  sourceContext: "mapped_industrial" | "land_cover_context" | "unresolved";
  detectionCount: number;
  sensorCount: number;
  activeDays: number;
  observationWindowDays: number;
  observationDates: string[];
  meanGapDays: number | null;
  typicalUtcHours: number[];
  dayDetectionRatio: number;
  nightDetectionRatio: number;
  medianFrp: number;
  p90Frp: number;
  maximumFrp: number;
  frpMad: number;
  spatialRadiusM: number;
  spatialStability: number;
  recurrenceScore: number;
  profileCompleteness: number;
  baselineMaturity:
    | "snapshot_only"
    | "short_window"
    | "thirty_day_candidate"
    | "seasonal_candidate";
  nearestFacilityName: string | null;
  nearestFacilityDistanceM: number | null;
  landCoverLabel: string | null;
  discoveryPriority: number;
  discoveryStatus: "priority_unknown" | "watch_unknown" | "contextualized_source";
  evidence: string[];
  limitation: string;
};

export type SourceFingerprintCollection = {
  total: number;
  returned: number;
  featureVersion: string;
  methodology: string;
  fingerprints: ThermalSourceFingerprint[];
};

export type IngestionRun = {
  runId: string;
  trigger: "manual_api" | "scheduler" | "archive_only";
  status: "succeeded" | "failed";
  startedAt: string;
  finishedAt: string;
  sourceMode: "authenticated_area_api" | "public_firms_feeds" | "local_archive";
  files: string[];
  archivedFiles: string[];
  normalizedEvents: number;
  errorType: string | null;
};

export type OperationalHealth = {
  generatedAt: string;
  status: "healthy" | "demo_ready" | "attention";
  dataMode: "live" | "snapshot";
  normalizedEvents: number;
  latestObservationAt: string | null;
  observationLagHours: number | null;
  sourceFiles: Array<{
    name: string;
    origin: "cache" | "bundled";
    bytes: number;
    modifiedAt: string;
    ageHours: number;
    status: "fresh" | "stale" | "bundled_snapshot";
  }>;
  observedCalendarDays: number;
  archiveSnapshotFiles: number;
  lastIngestionRun: IngestionRun | null;
  refreshIntervalMinutes: number;
  schedulerCommand: string;
  issues: string[];
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
  acquiredAt?: string;
  firstSeen?: string;
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
  clusterRole?: "core" | "border" | "noise";
  clusterRadiusM?: number;
  clusterEpsilonM?: number;
  anomalyStatus?: "elevated" | "within_observed_range" | "insufficient_baseline";
  anomalyScore?: number;
  modelVersion?: string;
  featureVersion?: string;
  landCover?: LandCoverContext;
  administrativeArea?: AdministrativeAreaContext;
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
  historicalEvents: ThermalEvent[];
  playback: PlaybackFrame[];
  facilityMonitors: FacilityMonitor[];
  historyReadiness: HistoryReadiness | null;
  clusteringDiagnostics: ClusteringDiagnostics | null;
  clusterReviews: ClusterReview[];
  modelReadiness: ModelTrainingReadiness | null;
  modelBenchmark: ModelBenchmarkEnvelope | null;
  modelRegistry: ModelRegistry | null;
  boundary: IndiaBoundary | null;
};

export type ThermalClusterSummary = {
  clusterId: string;
  representativeEventId: string;
  coordinates: [number, number];
  clusterMethod: "metric_dbscan_haversine_v1";
  clusterRadiusM: number;
  clusterEpsilonM: number;
  clusterMinSamples: number;
  densityRoleCounts: Record<string, number>;
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
  reviewStatus: "requires_analyst_review" | "acknowledged" | "investigating" | "closed";
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
};

export type PlaybackFrame = {
  date: string;
  detectionCount: number;
  clusterCount: number;
  newClusterCount: number;
  activePersistentCells: number;
  highFrpCount: number;
  meanFrp: number;
  eventIds: string[];
};

export type FacilityThermalDay = {
  date: string;
  detectionCount: number;
  meanFrp: number;
  maxFrp: number;
};

export type FacilityMonitor = {
  monitorId: string;
  facility: IndustrialFacility;
  representativeEventId: string;
  observedDetections: number;
  clusterCount: number;
  sensorCount: number;
  activeDays: number;
  observationWindowDays: number;
  firstSeen: string;
  lastSeen: string;
  medianFrp: number;
  maximumFrp: number;
  latestFrp: number;
  persistenceScore: number;
  anomalyStatus: "elevated" | "within_observed_range" | "insufficient_baseline";
  operatingStatus: "elevated_observed_frp" | "persistent_observed_heat" | "recent_thermal_activity" | "insufficient_history";
  alertCount: number;
  history: FacilityThermalDay[];
  evidence: string[];
  caveat: string;
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

export type ClusteringDiagnostics = {
  algorithm: "DBSCAN";
  implementation: "metric_dbscan_haversine_v1";
  distanceMetric: "Haversine great-circle distance";
  epsilonM: number;
  minSamples: number;
  totalEvents: number;
  totalClusters: number;
  clusteredEvents: number;
  noiseEvents: number;
  coreEvents: number;
  borderEvents: number;
  multiEventClusters: number;
  singletonClusters: number;
  medianClusterRadiusM: number;
  p95ClusterRadiusM: number;
  maximumClusterRadiusM: number;
  legacyRoundedGridCells: number;
  clusterCountDeltaVsLegacy: number;
  methodology: string;
  caveats: string[];
};

export type ClusterReviewLabel =
  | "likely_industrial"
  | "likely_vegetation"
  | "likely_agricultural"
  | "likely_other"
  | "uncertain"
  | "exclude_data_quality";

export type ClusterReview = {
  reviewId: string;
  clusterId: string;
  representativeEventId: string;
  proposedCategory: EventClass;
  proposedClassification: string;
  analystLabel: ClusterReviewLabel;
  note: string | null;
  reviewedBy: string;
  reviewedAt: string;
  evidenceSnapshot: {
    detectionCount?: number;
    sensorCount?: number;
    activeDays?: number;
    observationWindowDays?: number;
    clusterRadiusM?: number;
    clusterEpsilonM?: number;
    persistenceScore?: number;
    persistenceLabel?: string;
    anomalyStatus?: string;
    medianFrpMw?: number;
    maxFrpMw?: number;
  };
  modelVersion: string;
  featureVersion: string;
  incidentConfirmation: false;
};
