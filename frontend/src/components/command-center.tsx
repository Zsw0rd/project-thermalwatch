"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  ChevronRight,
  CheckCircle2,
  CircleDot,
  Clock3,
  Cpu,
  Database,
  Flame,
  Factory,
  Fingerprint,
  Focus,
  Gauge,
  Grid3X3,
  Layers3,
  Map as MapIcon,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  Radar,
  Satellite,
  Search,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sparkles,
  Sun,
  Target,
  Trees,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CLASS_META, DEMO_EVENTS } from "@/lib/demo-data";
import {
  createClusterReview,
  fetchClusteringSensitivity,
  fetchEventEvidenceGraph,
  fetchIngestionRuns,
  fetchOperationalHealth,
  fetchOperationalEvents,
  fetchUnknownDiscoveries,
  updateAlertReview,
} from "@/lib/api";
import type {
  AnalyticsDashboard,
  ClusteringSensitivityReport,
  ClusteringDiagnostics,
  ClusterReview,
  ClusterReviewLabel,
  DashboardDataset,
  EventClass,
  EventEvidenceGraph,
  FacilityMonitor,
  HistoryReadiness,
  IndiaBoundary,
  IndustrialFacility,
  IngestionRun,
  ModelBenchmarkEnvelope,
  ModelRegistry,
  ModelTrainingReadiness,
  OperationalHealth,
  PlaybackFrame,
  ReviewAlert,
  ThermalClusterSummary,
  ThermalEvent,
  ThermalSourceFingerprint,
} from "@/lib/types";
import { ThermalMap } from "./thermal-map";

type Filter = "all" | EventClass;
type WorkspaceName = "Overview" | "Events" | "Monitor" | "Playback" | "Discover" | "Analytics" | "Validate" | "Models" | "Sources";
type ThemeMode = "dark" | "light";

const NAV_GROUPS: { label: string; items: { label: WorkspaceName; icon: LucideIcon; description: string }[] }[] = [
  {
    label: "Operate",
    items: [
      { label: "Overview", icon: Radar, description: "Live operating picture" },
      { label: "Events", icon: Flame, description: "Evidence-led triage" },
      { label: "Monitor", icon: Factory, description: "Facility watchlists" },
    ],
  },
  {
    label: "Investigate",
    items: [
      { label: "Playback", icon: Play, description: "Historical reconstruction" },
      { label: "Discover", icon: Fingerprint, description: "Persistent unknowns" },
      { label: "Analytics", icon: Activity, description: "Pattern analysis" },
    ],
  },
  {
    label: "Govern",
    items: [
      { label: "Validate", icon: CheckCircle2, description: "Analyst review" },
      { label: "Models", icon: Cpu, description: "Readiness and registry" },
      { label: "Sources", icon: Target, description: "Provenance control" },
    ],
  },
];

const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All intelligence" },
  { id: "industrial", label: "Industrial" },
  { id: "vegetation", label: "Vegetation" },
  { id: "agricultural", label: "Agricultural" },
  { id: "unknown", label: "Unknown" },
];

const severityClass = (severity: ThermalEvent["severity"]) =>
  ({
    critical: "text-red-300 bg-red-400/10 border-red-400/25",
    high: "text-orange-300 bg-orange-400/10 border-orange-400/25",
    medium: "text-amber-200 bg-amber-300/10 border-amber-300/25",
    low: "text-emerald-300 bg-emerald-400/10 border-emerald-400/25",
  })[severity];

const subscribeToDesktopViewport = (callback: () => void) => {
  const mediaQuery = window.matchMedia("(min-width: 1440px)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
};

const getDesktopSnapshot = () => window.matchMedia("(min-width: 1440px)").matches;
const getServerDesktopSnapshot = () => false;
const THEME_CHANGE_EVENT = "aegisfire-theme-change";

const getThemeSnapshot = (): ThemeMode => {
  const savedTheme = window.localStorage.getItem("aegisfire-theme");
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
};

const getServerThemeSnapshot = (): ThemeMode => "dark";

const subscribeToTheme = (callback: () => void) => {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  mediaQuery.addEventListener("change", callback);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
    mediaQuery.removeEventListener("change", callback);
  };
};

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <article className="metric-card" style={{ "--metric-tone": tone } as CSSProperties}>
      <span className="metric-card-icon"><Icon size={16} strokeWidth={1.8} /></span>
      <div className="metric-card-copy">
        <p className="metric-card-label">{label}</p>
        <p className="metric-card-value">{value}</p>
        <p className="metric-card-detail">{detail}</p>
      </div>
    </article>
  );
}

function EventRow({
  event,
  selected,
  onClick,
}: {
  event: ThermalEvent;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`event-row w-full text-left ${selected ? "is-selected" : ""}`}
    >
      <span
        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_14px_currentColor]"
        style={{ color: CLASS_META[event.category].color, background: "currentColor" }}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="truncate text-xs font-semibold text-slate-200">{event.title}</span>
          <span className="shrink-0 font-mono text-[10px] text-slate-600">{event.shortId}</span>
        </span>
        <span className="mt-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-[10px] uppercase tracking-[0.1em] text-slate-500">{event.classification}</span>
          <span className="text-[10px] font-semibold text-slate-400">{event.confidence}%</span>
        </span>
      </span>
    </button>
  );
}

function EvidencePanel({
  event,
  evidenceGraph,
}: {
  event: ThermalEvent;
  evidenceGraph: EventEvidenceGraph | null;
}) {
  const gradientId = `frp-fill-${useId().replaceAll(":", "")}`;
  const isOperational = event.dataOrigin === "nasa-firms";

  return (
    <aside className="intel-panel custom-scrollbar">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
        <div>
          <p className="eyebrow">Selected intelligence</p>
          <p className="mt-1 font-mono text-[11px] text-slate-500">{event.shortId}</p>
        </div>
        <span className={`rounded-sm border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${severityClass(event.severity)}`}>
          {event.severity}
        </span>
      </div>

      <div className="space-y-5 p-5">
        <section>
          <div className="flex items-start gap-3">
            <span
              className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-sm border"
              style={{
                color: CLASS_META[event.category].color,
                borderColor: `${CLASS_META[event.category].color}40`,
                background: `${CLASS_META[event.category].color}12`,
              }}
            >
              <Flame size={17} />
            </span>
            <div>
              <h2 className="text-base font-semibold leading-tight tracking-[-0.02em] text-white">{event.title}</h2>
              <p className="mt-1 text-[11px] text-slate-500">{event.region}</p>
            </div>
          </div>
          <div className="mt-4 border-l-2 border-orange-400/70 bg-orange-400/[0.045] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-300">{event.classification}</p>
              <p className="font-mono text-sm font-semibold text-white">{event.confidence}%</p>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{event.summary}</p>
          </div>
        </section>

        {isOperational && (
          <section className="event-evidence-graph">
            <div className="mb-3 flex items-center justify-between">
              <p className="eyebrow">Explainable evidence graph</p>
              <span>{evidenceGraph ? `${evidenceGraph.edges.length} attributed links` : "Loading graph…"}</span>
            </div>
            {evidenceGraph && (
              <>
                <div className="event-graph-inputs">
                  {evidenceGraph.nodes
                    .filter((node) => !["classification", "limitation"].includes(node.kind))
                    .map((node) => (
                      <div key={node.nodeId} className={`direction-${node.direction}`}>
                        <i />
                        <span><strong>{node.label}</strong><small>{node.value}</small><em>{node.source}</em></span>
                      </div>
                    ))}
                </div>
                <div className="event-graph-outcome">
                  <span>Evidence-supported candidate</span>
                  <strong>{evidenceGraph.classification}</strong>
                  <small>{Math.round(evidenceGraph.confidence * 100)}% rules confidence · {evidenceGraph.modelVersion}</small>
                </div>
                <p className="event-graph-boundary"><ShieldCheck size={11} /> {evidenceGraph.interpretationBoundary}</p>
              </>
            )}
          </section>
        )}

        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-white/[0.07] bg-white/[0.07]">
          {[
            ["Current FRP", `${event.frp} MW`],
            ["Observed median", `${event.baselineFrp.toFixed(2)} MW`],
            [isOperational ? "Persistence score" : "Persistence", `${event.persistence}/100`],
            ["Active days", `${event.activeDays}/${event.historyWindow}`],
          ].map(([label, value]) => (
            <div key={label} className="bg-[#0a121a] p-3">
              <p className="text-[9px] uppercase tracking-[0.13em] text-slate-600">{label}</p>
              <p className="mt-1.5 font-mono text-sm font-semibold text-slate-200">{value}</p>
            </div>
          ))}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="eyebrow">{isOperational ? "Observed thermal history" : "7-day thermal signature"}</p>
            <span className="flex items-center gap-1.5 text-[9px] text-slate-600">
              <i className="h-px w-3 bg-orange-400" /> FRP MW
            </span>
          </div>
          <div className="h-36 rounded-sm border border-white/[0.07] bg-[#081018] p-2">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart data={event.history} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff6b35" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#ff6b35" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#ffffff0a" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#586675", fontSize: 8 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#586675", fontSize: 8 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "#0b151e", border: "1px solid #ffffff14", borderRadius: 2, fontSize: 10 }}
                  labelStyle={{ color: "#94a3b8" }}
                  itemStyle={{ color: "#ff8a5c" }}
                />
                <Area type="monotone" dataKey="frp" stroke="#ff6b35" strokeWidth={2} dot={{ r: 2 }} fill={`url(#${gradientId})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="eyebrow">Evidence stack</p>
            <span className="text-[9px] uppercase tracking-[0.1em] text-slate-600">{event.evidence.length} signals</span>
          </div>
          <div className="space-y-2">
            {event.evidence.map((item) => (
              <div key={item.label} className="rounded-sm border border-white/[0.065] bg-white/[0.018] p-3">
                <div className="flex items-start gap-2.5">
                  <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                    item.impact === "positive" ? "bg-emerald-400" : item.impact === "negative" ? "bg-slate-600" : "bg-amber-300"
                  }`} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="text-[10px] font-medium text-slate-400">{item.label}</p>
                      <p className="text-[10px] font-semibold text-slate-200">{item.value}</p>
                    </div>
                    <p className="mt-1 text-[9px] text-slate-650">Source: {item.source}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-white/[0.07] pt-4">
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <Clock3 size={12} />
            {event.detectedAt} · {event.sensor}
          </div>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
            <Focus size={12} />
            {event.nearestFacility} · {event.facilityDistance}
          </div>
        </section>
      </div>
    </aside>
  );
}

function AlertsWorkspace({
  alerts,
  onUpdate,
}: {
  alerts: ReviewAlert[];
  onUpdate: (alertId: string, status: ReviewAlert["reviewStatus"]) => Promise<void>;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const statuses: ReviewAlert["reviewStatus"][] = [
    "requires_analyst_review",
    "acknowledged",
    "investigating",
    "closed",
  ];
  const counts = Object.fromEntries(
    statuses.map((status) => [status, alerts.filter((alert) => alert.reviewStatus === status).length]),
  ) as Record<ReviewAlert["reviewStatus"], number>;
  const nextAction = (status: ReviewAlert["reviewStatus"]) => ({
    requires_analyst_review: { label: "Acknowledge", next: "acknowledged" },
    acknowledged: { label: "Investigate", next: "investigating" },
    investigating: { label: "Close review", next: "closed" },
    closed: { label: "Reopen", next: "requires_analyst_review" },
  } as const)[status];
  const applyUpdate = async (alert: ReviewAlert) => {
    setPendingId(alert.id);
    try {
      await onUpdate(alert.id, nextAction(alert.reviewStatus).next);
    } finally {
      setPendingId(null);
    }
  };
  return (
    <section className="stage-workspace">
      <div className="stage-header">
        <div>
          <p className="eyebrow">Analyst review workflow</p>
          <h2>Alert triage</h2>
        </div>
        <span className="stage-badge">{alerts.length - counts.closed} active review items</span>
      </div>
      <div className="stage-metrics stage-metrics-four">
        <div><span>Requires review</span><strong>{counts.requires_analyst_review}</strong></div>
        <div><span>Acknowledged</span><strong>{counts.acknowledged}</strong></div>
        <div><span>Investigating</span><strong>{counts.investigating}</strong></div>
        <div><span>Closed</span><strong>{counts.closed}</strong></div>
      </div>
      <div className="stage-table custom-scrollbar">
        {alerts.map((alert) => (
          <article key={alert.id} className="alert-record">
            <span className={`rounded-sm border px-2 py-1 text-[9px] font-semibold uppercase ${severityClass(alert.severity)}`}>
              {alert.severity}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3>{alert.title}</h3>
                <span className="font-mono text-[9px] text-slate-600">{alert.clusterId}</span>
              </div>
              <p>{alert.reason}</p>
              <div className="mt-2 flex flex-wrap gap-3 font-mono text-[9px] text-slate-500">
                <span>{alert.frp.toFixed(2)} MW</span>
                <span>{new Date(alert.acquiredAt).toLocaleString("en-IN", { timeZone: "UTC" })} UTC</span>
                <span>{alert.alertType.replaceAll("_", " ")}</span>
              </div>
            </div>
            <div className="alert-workflow-actions">
              <span className={`review-chip status-${alert.reviewStatus}`}>{alert.reviewStatus.replaceAll("_", " ")}</span>
              <button type="button" disabled={pendingId === alert.id} onClick={() => applyUpdate(alert)}>
                {alert.reviewStatus === "closed" ? <CheckCircle2 size={11} /> : <ChevronRight size={11} />}
                {pendingId === alert.id ? "Saving…" : nextAction(alert.reviewStatus).label}
              </button>
            </div>
          </article>
        ))}
      </div>
      <p className="stage-footnote">Alert rules prioritize evidence for human review. They do not confirm a fire, accident, or responsible facility.</p>
    </section>
  );
}

function FacilityMonitorWorkspace({ monitors }: { monitors: FacilityMonitor[] }) {
  const [selectedMonitorId, setSelectedMonitorId] = useState(monitors[0]?.monitorId ?? "");
  const chartId = `facility-frp-${useId().replaceAll(":", "")}`;
  const selected = monitors.find((monitor) => monitor.monitorId === selectedMonitorId) ?? monitors[0];
  if (!selected) {
    return <section className="stage-workspace grid place-items-center text-sm text-slate-500">No industrial-context monitors are available.</section>;
  }
  const statusLabel = selected.operatingStatus.replaceAll("_", " ");
  return (
    <section className="stage-workspace">
      <div className="stage-header">
        <div><p className="eyebrow">Facility-centric intelligence</p><h2>Industrial facility monitor</h2></div>
        <span className="stage-badge">{monitors.length} attributed sites ranked</span>
      </div>
      <div className="monitor-workspace">
        <aside className="monitor-list custom-scrollbar">
          <p className="eyebrow">Observed facilities</p>
          {monitors.map((monitor) => (
            <button
              type="button"
              key={monitor.monitorId}
              className={monitor.monitorId === selected.monitorId ? "is-selected" : ""}
              onClick={() => setSelectedMonitorId(monitor.monitorId)}
            >
              <span><b>{monitor.facility.name}</b><small>{monitor.facility.facilityType.replaceAll("_", " ")}</small></span>
              <span><strong>{monitor.activeDays}/{monitor.observationWindowDays}</strong><small>active</small></span>
            </button>
          ))}
        </aside>
        <section className="monitor-detail">
          <div className="monitor-title">
            <div>
              <p className="eyebrow">{selected.facility.facilityType.replaceAll("_", " ")} · OpenStreetMap</p>
              <h3>{selected.facility.name}</h3>
              <span>{selected.facility.operator ?? "Operator not present in mapped context"} · {selected.facility.coordinates[1].toFixed(4)}°N, {selected.facility.coordinates[0].toFixed(4)}°E</span>
            </div>
            <span className={selected.operatingStatus === "elevated_observed_frp" ? "monitor-status is-elevated" : "monitor-status"}>{statusLabel}</span>
          </div>
          <div className="monitor-metrics">
            <div><span>Detections</span><strong>{selected.observedDetections}</strong><small>{selected.clusterCount} thermal cells</small></div>
            <div><span>Active days</span><strong>{selected.activeDays}/{selected.observationWindowDays}</strong><small>{selected.sensorCount} VIIRS feeds</small></div>
            <div><span>Median FRP</span><strong>{selected.medianFrp.toFixed(2)} MW</strong><small>{selected.maximumFrp.toFixed(2)} MW maximum</small></div>
            <div><span>Review alerts</span><strong>{selected.alertCount}</strong><small>{Math.round(selected.persistenceScore * 100)}% persistence</small></div>
          </div>
          <div className="monitor-lower-grid">
            <section className="monitor-chart">
              <div className="flex items-center justify-between"><p className="eyebrow">Observed facility-proximate FRP</p><span>daily mean / maximum</span></div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <AreaChart data={selected.history} margin={{ top: 18, right: 8, left: -20, bottom: 0 }}>
                    <defs><linearGradient id={chartId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff6b35" stopOpacity={0.3} /><stop offset="100%" stopColor="#ff6b35" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid stroke="#ffffff0a" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "#586675", fontSize: 8 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#586675", fontSize: 8 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "#0b151e", border: "1px solid #ffffff14", borderRadius: 2, fontSize: 10 }} />
                    <Area type="monotone" dataKey="maxFrp" stroke="#f7bf4f" fill="transparent" strokeWidth={1} strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="meanFrp" stroke="#ff6b35" strokeWidth={2} fill={`url(#${chartId})`} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="monitor-evidence">
              <p className="eyebrow">Facility evidence</p>
              {selected.evidence.map((item) => <p key={item}><ShieldCheck size={12} /> {item}</p>)}
              <small>{selected.caveat}</small>
            </section>
          </div>
        </section>
      </div>
    </section>
  );
}

function PlaybackWorkspace({
  frames,
  events,
  facilities,
  boundary,
}: {
  frames: PlaybackFrame[];
  events: ThermalEvent[];
  facilities: IndustrialFacility[];
  boundary: IndiaBoundary | null;
}) {
  const [frameIndex, setFrameIndex] = useState(Math.max(0, frames.length - 1));
  const [isPlaying, setIsPlaying] = useState(false);
  useEffect(() => {
    if (!isPlaying || !frames.length) return;
    const timer = window.setInterval(() => {
      setFrameIndex((current) => {
        if (current >= frames.length - 1) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 1100);
    return () => window.clearInterval(timer);
  }, [isPlaying, frames.length]);
  const frame = frames[frameIndex];
  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const frameEvents = useMemo(
    () => frame?.eventIds.map((id) => eventById.get(id)).filter((event): event is ThermalEvent => Boolean(event)) ?? [],
    [eventById, frame],
  );
  if (!frame) {
    return <section className="stage-workspace grid place-items-center text-sm text-slate-500">Playback frames are unavailable.</section>;
  }
  return (
    <section className="stage-workspace playback-stage">
      <div className="stage-header">
        <div><p className="eyebrow">Historical observation playback</p><h2>Thermal activity timeline</h2></div>
        <span className="stage-badge">Frame {frameIndex + 1} of {frames.length} · UTC</span>
      </div>
      <div className="playback-metrics">
        <div><span>Selected date</span><strong>{new Date(`${frame.date}T00:00:00Z`).toLocaleDateString("en-IN", { dateStyle: "long", timeZone: "UTC" })}</strong></div>
        <div><span>Detections</span><strong>{frame.detectionCount}</strong></div>
        <div><span>New cells</span><strong>{frame.newClusterCount}</strong></div>
        <div><span>Persistent as-of date</span><strong>{frame.activePersistentCells}</strong></div>
        <div><span>High FRP</span><strong>{frame.highFrpCount}</strong></div>
      </div>
      <div className="playback-map">
        <ThermalMap
          events={frameEvents}
          selectedId={frameEvents[0]?.id ?? ""}
          onSelect={() => undefined}
          facilities={facilities}
          showGrid
          showSatellite
          focusNonce={0}
          boundary={boundary}
        />
      </div>
      <div className="timeline-control">
        <button type="button" aria-label="First frame" onClick={() => { setIsPlaying(false); setFrameIndex(0); }}><SkipBack size={14} /></button>
        <button type="button" className="play-toggle" aria-label={isPlaying ? "Pause playback" : "Play playback"} onClick={() => { if (frameIndex >= frames.length - 1) setFrameIndex(0); setIsPlaying((current) => !current); }}>{isPlaying ? <Pause size={14} /> : <Play size={14} />}</button>
        <input aria-label="Playback date" type="range" min={0} max={frames.length - 1} value={frameIndex} onChange={(event) => { setIsPlaying(false); setFrameIndex(Number(event.target.value)); }} />
        <button type="button" aria-label="Last frame" onClick={() => { setIsPlaying(false); setFrameIndex(frames.length - 1); }}><SkipForward size={14} /></button>
      </div>
      <p className="stage-footnote">Playback displays when NASA FIRMS observations were acquired. It does not represent confirmed fire spread or incident evolution.</p>
    </section>
  );
}

function DiscoveryWorkspace({
  fingerprints,
  events,
  facilities,
  boundary,
}: {
  fingerprints: ThermalSourceFingerprint[];
  events: ThermalEvent[];
  facilities: IndustrialFacility[];
  boundary: IndiaBoundary | null;
}) {
  const [selectedClusterId, setSelectedClusterId] = useState("");
  const [focusNonce, setFocusNonce] = useState(0);
  const selected = fingerprints.find((item) => item.clusterId === selectedClusterId) ?? fingerprints[0];
  const representativeIds = useMemo(
    () => new Set(fingerprints.map((item) => item.representativeEventId)),
    [fingerprints],
  );
  const mapEvents = useMemo(() => {
    if (!selected) return [];
    return events.filter(
      (event) => event.clusterId === selected.clusterId || representativeIds.has(event.id),
    );
  }, [events, representativeIds, selected]);
  const selectFingerprint = (clusterId: string) => {
    setSelectedClusterId(clusterId);
    setFocusNonce((current) => current + 1);
  };

  if (!selected) {
    return <section className="stage-workspace grid place-items-center text-sm text-slate-500">Unknown-source fingerprints are loading or unavailable.</section>;
  }

  const bands = [
    ["Recurrence", selected.recurrenceScore],
    ["Spatial stability", selected.spatialStability],
    ["Profile completeness", selected.profileCompleteness],
    ["Night share", selected.nightDetectionRatio],
    ["FRP intensity", Math.min(1, selected.p90Frp / 50)],
  ] as const;

  return (
    <section className="stage-workspace discovery-workspace">
      <div className="stage-header">
        <div><p className="eyebrow">Persistent-source intelligence</p><h2>Unknown-source discovery</h2></div>
        <span className="stage-badge">{fingerprints.length} unresolved candidates</span>
      </div>

      <div className="discovery-metrics">
        <div><span>Priority unknowns</span><strong>{fingerprints.filter((item) => item.discoveryStatus === "priority_unknown").length}</strong></div>
        <div><span>Most recurrent</span><strong>{Math.max(...fingerprints.map((item) => item.activeDays))}/{selected.observationWindowDays}d</strong></div>
        <div><span>Multi-sensor</span><strong>{fingerprints.filter((item) => item.sensorCount > 1).length}</strong></div>
        <div><span>Profile version</span><strong className="text-xs">thermal v1</strong></div>
      </div>

      <div className="discovery-grid">
        <aside className="discovery-queue custom-scrollbar">
          <div className="discovery-queue-head"><span>Ranked review queue</span><small>score, not identity</small></div>
          {fingerprints.map((item, index) => (
            <button
              type="button"
              key={item.fingerprintId}
              className={item.clusterId === selected.clusterId ? "is-active" : ""}
              onClick={() => selectFingerprint(item.clusterId)}
            >
              <b>{String(index + 1).padStart(2, "0")}</b>
              <span><strong>{item.clusterId}</strong><small>{item.activeDays} {item.activeDays === 1 ? "day" : "days"} · {item.detectionCount} {item.detectionCount === 1 ? "detection" : "detections"}</small></span>
              <i>{Math.round(item.discoveryPriority * 100)}</i>
            </button>
          ))}
        </aside>

        <div className="discovery-map-shell">
          <div className="discovery-map-toolbar">
            <span><MapIcon size={13} /> Candidate geometry</span>
            <span><Grid3X3 size={12} /> Metric grid</span>
            <span><Satellite size={12} /> Satellite</span>
          </div>
          <div className="discovery-map">
            <ThermalMap
              events={mapEvents}
              selectedId={selected.representativeEventId}
              onSelect={(eventId) => {
                const event = events.find((item) => item.id === eventId);
                if (event?.clusterId) selectFingerprint(event.clusterId);
              }}
              facilities={facilities}
              showGrid
              showSatellite
              showLandCover
              focusNonce={focusNonce}
              boundary={boundary}
            />
          </div>
          <div className="discovery-map-foot">
            <span>{selected.coordinates[1].toFixed(4)}, {selected.coordinates[0].toFixed(4)}</span>
            <span>{selected.spatialRadiusM.toFixed(0)} m observed radius</span>
            <span>{selected.landCoverLabel ?? "Land-cover context unavailable"}</span>
          </div>
        </div>

        <aside className="fingerprint-panel custom-scrollbar">
          <div className="fingerprint-title">
            <div><p className="eyebrow">{selected.discoveryStatus.replaceAll("_", " ")}</p><h3>{selected.fingerprintId}</h3></div>
            <strong>{Math.round(selected.discoveryPriority * 100)}</strong>
          </div>
          <p className="fingerprint-class">{selected.classification}</p>
          <div className="fingerprint-facts">
            <div><span>Active days</span><b>{selected.activeDays}/{selected.observationWindowDays}</b></div>
            <div><span>Detections</span><b>{selected.detectionCount}</b></div>
            <div><span>Median / P90</span><b>{selected.medianFrp.toFixed(1)} / {selected.p90Frp.toFixed(1)} MW</b></div>
            <div><span>Typical UTC</span><b>{selected.typicalUtcHours.map((hour) => `${String(hour).padStart(2, "0")}:00`).join(" · ")}</b></div>
          </div>
          <div className="fingerprint-bands">
            {bands.map(([label, value]) => (
              <div key={label}><span>{label}</span><i><b style={{ width: `${Math.round(value * 100)}%` }} /></i><strong>{Math.round(value * 100)}</strong></div>
            ))}
          </div>
          <div className="fingerprint-dates">
            <span>Observed UTC dates</span>
            <div>{selected.observationDates.map((date) => <b key={date}>{date.slice(5)}</b>)}</div>
          </div>
          <div className="fingerprint-evidence">
            {selected.evidence.map((item) => <p key={item}><CircleDot size={9} /> {item}</p>)}
          </div>
          <p className="fingerprint-limit"><ShieldCheck size={12} /> {selected.limitation}</p>
        </aside>
      </div>
    </section>
  );
}

function SourcesWorkspace({
  dataset,
  health,
  ingestionRuns,
}: {
  dataset: DashboardDataset | null;
  health: OperationalHealth | null;
  ingestionRuns: IngestionRun[];
}) {
  const cards = [
    {
      title: "NASA FIRMS / VIIRS",
      state: "Operational",
      detail: `${dataset?.analytics?.totalEvents.toLocaleString("en-IN") ?? "—"} seven-day detections · 24-hour map window`,
      source: "NOAA-20 · NOAA-21 · S-NPP",
    },
    {
      title: "OpenStreetMap context",
      state: "Operational",
      detail: `${dataset?.facilities.length.toLocaleString("en-IN") ?? "—"} facilities loaded to the web context layer`,
      source: "Refinery · flare · power · steel · quarry",
    },
    {
      title: "NASA GIBS imagery",
      state: "Visual context",
      detail: "VIIRS corrected reflectance over Blue Marble fallback",
      source: "Imagery is contextual, not classification evidence",
    },
    {
      title: "MODIS IGBP land cover",
      state: "Classification context",
      detail: `${dataset?.events.filter((event) => event.landCover).length.toLocaleString("en-IN") ?? "—"} loaded map events enriched with annual 500 m context`,
      source: "MCD12Q1.061 · NASA EOSDIS GIBS · 2024-01-01",
    },
    {
      title: "Temporal engine v2",
      state: "Candidate ranking",
      detail: `${dataset?.analytics?.observationWindowDays ?? "—"}-day recurrence and median/MAD deviation`,
      source: "Deterministic · explainable · no trained ML claim",
    },
    {
      title: "FIRMS history archive",
      state: dataset?.historyReadiness?.status === "ninety_day_ready" ? "90-day ready" : "Accumulating",
      detail: `${dataset?.historyReadiness?.observedCalendarDays ?? "—"}/30 observed UTC dates · ${dataset?.historyReadiness?.archiveSnapshotFiles ?? "—"} immutable snapshot files`,
      source: "Content-addressed raw CSV · overlapping records deduplicated",
    },
    {
      title: "India ADM0 boundary",
      state: "Containment filter",
      detail: "FIRMS detections and OSM facilities clipped by point-in-polygon containment",
      source: "geoBoundaries gbOpen · 2014 representation · CC0 1.0",
    },
  ];
  const healthLabel = health?.status.replaceAll("_", " ") ?? "telemetry unavailable";
  return (
    <section className="stage-workspace">
      <div className="stage-header">
        <div><p className="eyebrow">Provenance and readiness</p><h2>Evidence sources</h2></div>
        <span className="stage-badge">Attribution enforced</span>
      </div>
      <div className="source-grid">
        {cards.map((card) => (
          <article key={card.title} className="source-card">
            <div className="flex items-center justify-between gap-3">
              <Database size={16} className="text-cyan-300" />
              <span>{card.state}</span>
            </div>
            <h3>{card.title}</h3>
            <p>{card.detail}</p>
            <small>{card.source}</small>
          </article>
        ))}
      </div>
      {health && (
        <section className="operations-panel">
          <div className="operations-summary">
            <div>
              <p className="eyebrow">Ingestion control plane</p>
              <h3>Operational health</h3>
              <span className={`operations-status is-${health.status}`}><CircleDot size={10} /> {healthLabel}</span>
            </div>
            <div><span>Normalized events</span><strong>{health.normalizedEvents.toLocaleString("en-IN")}</strong></div>
            <div><span>Observation lag</span><strong>{health.observationLagHours === null ? "—" : `${health.observationLagHours.toFixed(1)} h`}</strong></div>
            <div><span>Refresh cadence</span><strong>{health.refreshIntervalMinutes / 60} h</strong></div>
            <div><span>Archived files</span><strong>{health.archiveSnapshotFiles}</strong></div>
          </div>
          <div className="operations-grid">
            <div className="source-health-table">
              <div className="operations-subhead"><span>Raw source files</span><small>freshness and origin</small></div>
              {health.sourceFiles.map((file) => (
                <div key={`${file.origin}-${file.name}`}>
                  <span><strong>{file.name}</strong><small>{(file.bytes / 1024).toFixed(1)} KiB · {file.origin}</small></span>
                  <span className={`file-health is-${file.status}`}>{file.status.replaceAll("_", " ")}</span>
                  <time>{file.ageHours.toFixed(1)} h old</time>
                </div>
              ))}
            </div>
            <div className="ingestion-run-list">
              <div className="operations-subhead"><span>Recent ingestion runs</span><small>append-only local audit</small></div>
              {ingestionRuns.length ? ingestionRuns.map((run) => (
                <div key={run.runId}>
                  <CircleDot size={10} className={run.status === "succeeded" ? "text-emerald-300" : "text-red-300"} />
                  <span><strong>{run.trigger.replaceAll("_", " ")}</strong><small>{new Date(run.finishedAt).toLocaleString("en-IN")} · {run.sourceMode.replaceAll("_", " ")}</small></span>
                  <b>{run.normalizedEvents.toLocaleString("en-IN")}</b>
                </div>
              )) : <p>No completed ingestion run is recorded yet. Bundled evidence remains deterministic.</p>}
              <code>{health.schedulerCommand}</code>
            </div>
          </div>
          {health.issues.length > 0 && <div className="operations-issues">{health.issues.map((issue) => <p key={issue}><AlertTriangle size={11} /> {issue}</p>)}</div>}
        </section>
      )}
      <div className="limitations-panel">
        <p className="eyebrow">Current evidence boundaries</p>
        {(dataset?.limitations ?? ["Operational API unavailable; deterministic simulation remains active."]).map((item) => (
          <p key={item}><ShieldCheck size={12} /> {item}</p>
        ))}
        <p><Clock3 size={12} /> Source snapshot: {dataset ? new Date(dataset.sourceUpdatedAt).toLocaleString("en-IN") : "offline"}</p>
      </div>
    </section>
  );
}

function AnalyticsWorkspace({
  analytics,
  clusters,
  historyReadiness,
  clusteringDiagnostics,
  clusteringSensitivity,
}: {
  analytics: AnalyticsDashboard | null;
  clusters: ThermalClusterSummary[];
  historyReadiness: HistoryReadiness | null;
  clusteringDiagnostics: ClusteringDiagnostics | null;
  clusteringSensitivity: ClusteringSensitivityReport | null;
}) {
  if (!analytics) {
    return <section className="stage-workspace grid place-items-center text-sm text-slate-500">Analytics are unavailable in simulation mode.</section>;
  }
  const dailyMaximum = Math.max(...analytics.dailyActivity.map((point) => point.detections), 1);
  return (
    <section className="stage-workspace">
      <div className="stage-header">
        <div><p className="eyebrow">Observed temporal intelligence</p><h2>Persistence and anomaly analytics</h2></div>
        <span className="stage-badge">{analytics.observationWindowDays}-day evidence window</span>
      </div>
      <div className="stage-metrics stage-metrics-four">
        <div><span>Thermal clusters</span><strong>{analytics.totalClusters.toLocaleString("en-IN")}</strong></div>
        <div><span>Persistent candidates</span><strong>{analytics.persistentCandidates}</strong></div>
        <div><span>Elevated clusters</span><strong>{analytics.elevatedClusters}</strong></div>
        <div><span>Unmapped persistent</span><strong>{analytics.unmappedPersistentCandidates}</strong></div>
      </div>
      {historyReadiness && (
        <section className="readiness-panel">
          <div>
            <p className="eyebrow">Historical baseline readiness</p>
            <strong>{historyReadiness.observedCalendarDays} observed UTC dates</strong>
            <span>{historyReadiness.archiveSnapshotFiles} immutable files · {historyReadiness.uniqueEvents.toLocaleString("en-IN")} deduplicated detections</span>
          </div>
          <div className="readiness-targets">
            <div>
              <span>30-day candidate baseline</span>
              <i><b style={{ width: `${historyReadiness.readiness30Percent}%` }} /></i>
              <strong>{historyReadiness.readiness30Percent.toFixed(1)}%</strong>
            </div>
            <div>
              <span>90-day seasonal baseline</span>
              <i><b style={{ width: `${historyReadiness.readiness90Percent}%` }} /></i>
              <strong>{historyReadiness.readiness90Percent.toFixed(1)}%</strong>
            </div>
          </div>
          <small>{historyReadiness.status.replaceAll("_", " ")} · Coverage telemetry only; no learned baseline is claimed yet.</small>
        </section>
      )}
      {clusteringDiagnostics && (
        <section className="clustering-diagnostics">
          <div>
            <p className="eyebrow">Spatial grouping diagnostics</p>
            <strong>{clusteringDiagnostics.algorithm} · {clusteringDiagnostics.distanceMetric}</strong>
            <span>{clusteringDiagnostics.epsilonM.toFixed(0)} m epsilon · {clusteringDiagnostics.minSamples} point minimum density</span>
          </div>
          <div>
            <span>Density-supported</span>
            <strong>{clusteringDiagnostics.clusteredEvents.toLocaleString("en-IN")}</strong>
            <small>{clusteringDiagnostics.multiEventClusters} multi-event clusters</small>
          </div>
          <div>
            <span>Explicit noise</span>
            <strong>{clusteringDiagnostics.noiseEvents.toLocaleString("en-IN")}</strong>
            <small>Retained as reviewable singletons</small>
          </div>
          <div>
            <span>Cluster radius P95</span>
            <strong>{clusteringDiagnostics.p95ClusterRadiusM.toFixed(0)} m</strong>
            <small>Median {clusteringDiagnostics.medianClusterRadiusM.toFixed(0)} m</small>
          </div>
          <div>
            <span>vs rounded grid</span>
            <strong>{clusteringDiagnostics.clusterCountDeltaVsLegacy >= 0 ? "+" : ""}{clusteringDiagnostics.clusterCountDeltaVsLegacy}</strong>
            <small>{clusteringDiagnostics.legacyRoundedGridCells.toLocaleString("en-IN")} legacy cells</small>
          </div>
        </section>
      )}
      <section className="sensitivity-card">
        <div className="model-section-heading">
          <div><p className="eyebrow">Parameter sensitivity · evaluation only</p><h3>DBSCAN stability sweep</h3></div>
          <span>{clusteringSensitivity ? `${clusteringSensitivity.variants.length} deterministic variants` : "Computing variants…"}</span>
        </div>
        {clusteringSensitivity ? (
          <div className="sensitivity-table-scroll">
            <div className="sensitivity-table sensitivity-table-head"><span>Configuration</span><span>Clusters</span><span>Supported</span><span>Noise</span><span>Border</span><span>P95 radius</span><span>Largest</span><span>Membership vs control</span></div>
            {clusteringSensitivity.variants.map((variant) => (
              <div key={`${variant.epsilonM}-${variant.minSamples}`} className={`sensitivity-table ${variant.isOperationalSetting ? "is-operational" : ""}`}>
                <span><strong>{variant.epsilonM.toLocaleString("en-IN")} m · min {variant.minSamples}</strong><small>{variant.isOperationalSetting ? "operational control" : "evaluation variant"}</small></span>
                <span>{variant.totalClusters}</span>
                <span>{variant.multiEventClusters}</span>
                <span>{variant.noisePercent.toFixed(1)}%</span>
                <span>{variant.borderEvents}</span>
                <span>{variant.p95SupportedRadiusM.toFixed(0)} m</span>
                <span>{variant.largestClusterEvents}</span>
                <span>{(variant.coMembershipJaccardVsOperational * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        ) : <p className="model-empty">The sweep runs separately so operational map loading is never blocked.</p>}
        {clusteringSensitivity && <p className="sensitivity-boundary"><ShieldCheck size={11} /> {clusteringSensitivity.caveats[0]} Reviewed examples remain required before parameter calibration.</p>}
      </section>
      <div className="analytics-grid">
        <section className="analytics-card">
          <div className="flex items-center justify-between"><p className="eyebrow">Daily FIRMS activity</p><span>detections</span></div>
          <div className="daily-bars">
            {analytics.dailyActivity.map((point) => (
              <div key={point.date} className="daily-bar-row">
                <time>{point.date.slice(5)}</time>
                <i><b style={{ width: `${Math.max(2, point.detections / dailyMaximum * 100)}%` }} /></i>
                <strong>{point.detections}</strong>
                <span>{point.meanFrp.toFixed(1)} MW avg</span>
              </div>
            ))}
          </div>
        </section>
        <section className="analytics-card">
          <p className="eyebrow">Classification coverage</p>
          <div className="class-breakdown">
            {Object.entries(analytics.categoryCounts).map(([category, count]) => (
              <div key={category}>
                <span style={{ background: CLASS_META[category as EventClass].color }} />
                <p>{CLASS_META[category as EventClass].label}</p>
                <strong>{count.toLocaleString("en-IN")}</strong>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[10px] leading-relaxed text-slate-500">{analytics.methodology}</p>
        </section>
      </div>
      <section className="cluster-leaderboard">
        <div className="flex items-center justify-between"><p className="eyebrow">Persistent-source candidates</p><span>Analyst validation required</span></div>
        <div className="cluster-head"><span>Cluster / context</span><span>Active days</span><span>Median FRP</span><span>Persistence</span><span>Status</span></div>
        {clusters.filter((cluster) => cluster.persistenceLabel === "persistent_candidate").slice(0, 12).map((cluster) => (
          <div key={cluster.clusterId} className="cluster-row">
            <span><b>{cluster.facilityName ?? "Unmapped source"}</b><small>{cluster.clusterId} · {cluster.classification}</small></span>
            <span>{cluster.activeDays}/{cluster.observationWindowDays}</span>
            <span>{cluster.medianFrp.toFixed(2)} MW</span>
            <span>{Math.round(cluster.persistenceScore * 100)}%</span>
            <span className={cluster.anomalyStatus === "elevated" ? "text-orange-300" : "text-emerald-300"}>{cluster.anomalyStatus.replaceAll("_", " ")}</span>
          </div>
        ))}
      </section>
    </section>
  );
}

const REVIEW_LABELS: ClusterReviewLabel[] = [
  "likely_industrial",
  "likely_vegetation",
  "likely_agricultural",
  "likely_other",
  "uncertain",
  "exclude_data_quality",
];

function ValidationWorkspace({
  clusters,
  reviews,
  events,
  facilities,
  boundary,
  diagnostics,
  onReview,
}: {
  clusters: ThermalClusterSummary[];
  reviews: ClusterReview[];
  events: ThermalEvent[];
  facilities: IndustrialFacility[];
  boundary: IndiaBoundary | null;
  diagnostics: ClusteringDiagnostics | null;
  onReview: (clusterId: string, label: ClusterReviewLabel, note: string) => Promise<void>;
}) {
  const [selectedClusterId, setSelectedClusterId] = useState("");
  const [label, setLabel] = useState<ClusterReviewLabel>("uncertain");
  const [note, setNote] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const effectiveClusterId = clusters.some((cluster) => cluster.clusterId === selectedClusterId)
    ? selectedClusterId
    : (clusters[0]?.clusterId ?? "");
  const selected = clusters.find((cluster) => cluster.clusterId === effectiveClusterId);
  const latestReview = reviews.find((review) => review.clusterId === effectiveClusterId);
  const reviewCount = reviews.filter((review) => review.clusterId === effectiveClusterId).length;
  const clusterEvents = events.filter((event) => event.clusterId === effectiveClusterId);
  const mapEvent = clusterEvents.find((event) => event.id === selected?.representativeEventId)
    ?? clusterEvents[0];

  if (!selected) {
    return <section className="stage-workspace grid place-items-center text-sm text-slate-500">Validation candidates are unavailable in simulation mode.</section>;
  }

  const submitReview = async () => {
    setSaveState("saving");
    try {
      await onReview(selected.clusterId, label, note);
      setNote("");
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  return (
    <section className="stage-workspace validation-stage">
      <div className="stage-header">
        <div><p className="eyebrow">Human-in-the-loop evidence review</p><h2>Cluster validation workspace</h2></div>
        <span className="stage-badge">{reviews.length} audit record{reviews.length === 1 ? "" : "s"} · no incident confirmation</span>
      </div>
      <div className="validation-layout">
        <aside className="validation-queue custom-scrollbar">
          <p className="eyebrow">Ranked candidates · {clusters.length}</p>
          {clusters.map((cluster) => {
            const reviewed = reviews.some((review) => review.clusterId === cluster.clusterId);
            return (
              <button
                key={cluster.clusterId}
                type="button"
                className={cluster.clusterId === effectiveClusterId ? "is-selected" : ""}
                onClick={() => {
                  setSelectedClusterId(cluster.clusterId);
                  setSaveState("idle");
                }}
              >
                <span><b>{cluster.facilityName ?? cluster.classification}</b><small>{cluster.clusterId} · {cluster.activeDays}/{cluster.observationWindowDays} active days</small></span>
                <span><strong>{Math.round(cluster.persistenceScore * 100)}%</strong><small>{reviewed ? "reviewed" : cluster.persistenceLabel.replaceAll("_", " ")}</small></span>
              </button>
            );
          })}
        </aside>

        <div className="validation-evidence">
          <div className="validation-title">
            <div>
              <p className="eyebrow">Proposed machine context</p>
              <h3>{selected.classification}</h3>
              <span>{selected.clusterId} · {selected.coordinates[1].toFixed(5)}, {selected.coordinates[0].toFixed(5)}</span>
            </div>
            <div className="validation-confidence">
              <span>{selected.persistenceLabel.replaceAll("_", " ")}</span>
              <strong>{Math.round(selected.persistenceScore * 100)}%</strong>
            </div>
          </div>

          <div className="validation-metrics">
            <div><span>Detections</span><strong>{selected.detectionCount}</strong><small>{selected.sensorCount} VIIRS source(s)</small></div>
            <div><span>Metric radius</span><strong>{selected.clusterRadiusM.toFixed(0)} m</strong><small>{selected.clusterEpsilonM.toFixed(0)} m DBSCAN epsilon</small></div>
            <div><span>Observed FRP</span><strong>{selected.medianFrp.toFixed(1)} MW</strong><small>{selected.maxFrp.toFixed(1)} MW maximum</small></div>
            <div><span>Density roles</span><strong>{selected.densityRoleCounts.core ?? 0} core</strong><small>{selected.densityRoleCounts.border ?? 0} border · {selected.densityRoleCounts.noise ?? 0} noise</small></div>
          </div>

          <div className="validation-main-grid">
            <div className="validation-map">
              {mapEvent ? (
                <ThermalMap
                  events={clusterEvents}
                  selectedId={mapEvent.id}
                  onSelect={() => undefined}
                  facilities={facilities}
                  showGrid
                  showSatellite
                  showLandCover
                  autoFocusSelected
                  focusNonce={clusters.findIndex((cluster) => cluster.clusterId === effectiveClusterId) + 1}
                  boundary={boundary}
                />
              ) : <div className="grid h-full place-items-center text-xs text-slate-600">Representative map evidence unavailable.</div>}
            </div>
            <section className="validation-facts">
              <p className="eyebrow">Review packet</p>
              {selected.evidence.map((item) => <p key={item}><ShieldCheck size={11} /> {item}</p>)}
              <small>{diagnostics?.methodology ?? "Metric clustering diagnostics unavailable."}</small>
            </section>
          </div>
        </div>

        <aside className="validation-form">
          <p className="eyebrow">Analyst context label</p>
          <h3>Record assessment</h3>
          <p className="validation-boundary">Choose the most supportable context label. This annotation does not confirm a fire, accident, or responsible facility.</p>
          <div className="validation-labels">
            {REVIEW_LABELS.map((item) => (
              <button key={item} type="button" aria-pressed={label === item} onClick={() => { setLabel(item); setSaveState("idle"); }}>
                {item.replaceAll("_", " ")}
              </button>
            ))}
          </div>
          <label htmlFor="validation-note">Evidence note</label>
          <textarea id="validation-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="Record the evidence supporting or weakening this label…" />
          <button type="button" className="validation-submit" disabled={saveState === "saving"} onClick={submitReview}>
            <CheckCircle2 size={13} /> {saveState === "saving" ? "Saving audit record…" : "Append review record"}
          </button>
          {saveState === "saved" && <p className="validation-success">Review appended to the local validation set.</p>}
          {saveState === "error" && <p className="validation-error">Review could not be saved. Check the local API.</p>}
          {latestReview && (
            <div className="validation-latest">
              <span>Latest of {reviewCount} review{reviewCount === 1 ? "" : "s"}</span>
              <strong>{latestReview.analystLabel.replaceAll("_", " ")}</strong>
              <small>{new Date(latestReview.reviewedAt).toLocaleString("en-IN")} · {latestReview.reviewedBy}</small>
              {latestReview.note && <p>{latestReview.note}</p>}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

const modelDisplayName = (model: string) => ({
  model_v1_rules_baseline: "Rules baseline",
  model_v2_logistic: "Logistic regression",
  model_v3_random_forest: "Random forest",
  model_v4_xgboost: "XGBoost",
})[model] ?? model.replaceAll("_", " ");

function ModelsWorkspace({
  readiness,
  benchmark,
  registry,
}: {
  readiness: ModelTrainingReadiness | null;
  benchmark: ModelBenchmarkEnvelope | null;
  registry: ModelRegistry | null;
}) {
  if (!readiness) {
    return <section className="stage-workspace grid place-items-center text-sm text-slate-500">Model governance is unavailable in simulation mode.</section>;
  }

  const report = benchmark?.report ?? null;
  const candidates = report
    ? [report.rulesBaseline, ...report.candidateModels]
    : [];
  const selected = candidates.find(
    (candidate) => candidate.model === report?.selectedDevelopmentCandidate,
  ) ?? candidates[0];
  const rankedFeatures = selected
    ? Object.entries(selected.featureImportances).sort(([, left], [, right]) => right - left).slice(0, 8)
    : [];
  const maximumImportance = Math.max(...rankedFeatures.map(([, value]) => value), 1);
  const reviewedProgress = Math.min(
    100,
    (readiness.eligibleReviewedSamples / readiness.requiredReviewedSamples) * 100,
  );
  const gateReady = readiness.status === "ready_for_reviewed_training";
  const gpu = report?.gpuInventory.devices[0];

  const exportGovernanceBrief = () => {
    const lines = [
      "# AegisFire model governance brief",
      "",
      `Generated: ${new Date().toISOString()}`,
      `Operational model: ${registry?.operationalVersion ?? readiness.currentOperationalModel}`,
      `Reviewed-label gate: ${readiness.eligibleReviewedSamples}/${readiness.requiredReviewedSamples}`,
      `Benchmark status: ${benchmark?.status ?? "unavailable"}`,
      `Benchmark scope: ${report?.evaluationLanguage ?? "not run"}`,
      `Spatial split: ${report ? `${report.trainSpatialGroups} train groups / ${report.testSpatialGroups} held-out groups / ${report.spatialGroupOverlap.length} overlapping` : "unavailable"}`,
      "",
      "## Registry",
      ...(registry?.entries.map((entry) => (
        `- ${entry.version}: ${entry.lifecycle}; serving=${entry.serving}; device=${entry.device}; promotion=${entry.promotionStatus}`
      )) ?? ["- Registry unavailable"]),
      "",
      "## Promotion policy",
      ...(registry?.promotionPolicy.map((item) => `- ${item}`) ?? ["- Policy unavailable"]),
      "",
      "## Interpretation boundary",
      "Weak-label agreement is not validation accuracy. No benchmark candidate is automatically promoted, and no output confirms an incident.",
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/markdown" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "aegisfire-model-governance-brief.md";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="stage-workspace models-stage">
      <div className="stage-header">
        <div><p className="eyebrow">Governed model lifecycle</p><h2>Training readiness and benchmark laboratory</h2></div>
        <div className="model-header-actions">
          <button type="button" onClick={exportGovernanceBrief}><Database size={12} /> Export governance brief</button>
          <span className={`model-gate-badge ${gateReady ? "is-ready" : "is-blocked"}`}>
            {gateReady ? "Reviewed training gate ready" : "Production gate blocked"}
          </span>
        </div>
      </div>

      <section className="model-boundary-banner">
        <AlertTriangle size={16} />
        <div>
          <strong>{benchmark?.message ?? "No development benchmark has been run."}</strong>
          <p>Perfect weak-label agreement only shows that a candidate reproduced existing rule outputs. It is not real-world accuracy and no trained model is serving classifications.</p>
        </div>
        <span>Operational: {readiness.currentOperationalModel}</span>
      </section>

      <div className="model-summary-grid">
        <section className="model-readiness-card">
          <div className="flex items-start justify-between gap-4">
            <div><p className="eyebrow">Reviewed-label gate</p><strong>{readiness.eligibleReviewedSamples}/{readiness.requiredReviewedSamples}</strong></div>
            <span>{reviewedProgress.toFixed(0)}%</span>
          </div>
          <i><b style={{ width: `${reviewedProgress}%` }} /></i>
          <p>{readiness.recommendedNextAction}</p>
          <small>{readiness.reviewedSpatialGroups} reviewed spatial groups · latest eligible label per cluster only</small>
        </section>

        <section className="model-runtime-card">
          <div><Cpu size={17} /><span>{gpu ? "GPU benchmark completed" : "Compute inventory"}</span></div>
          <strong>{gpu?.name ?? "No GPU recorded"}</strong>
          <p>{gpu ? `${(gpu.memoryMib / 1024).toFixed(0)} GB VRAM · driver ${gpu.driverVersion}` : "Run the training command to capture hardware provenance."}</p>
          <small>{report?.candidateModels.find((candidate) => candidate.model === "model_v4_xgboost")?.device ?? "Device unavailable"} · trained candidates remain offline artifacts</small>
        </section>

        <section className="model-data-card">
          <p className="eyebrow">Benchmark evidence</p>
          <strong>{report?.sampleCount.toLocaleString("en-IN") ?? "—"} clusters</strong>
          <p>{report?.featureCount ?? readiness.featureCount} features · {report?.spatialGroupCount ?? readiness.weakLabelSpatialGroups} spatial blocks</p>
          <small>{report ? `${report.trainSamples} train / ${report.testSamples} held out · ${report.spatialGroupOverlap.length} overlapping blocks` : "Benchmark report unavailable"}</small>
        </section>
      </div>

      <section className="model-class-gates">
        <div><p className="eyebrow">Balanced analyst coverage</p><span>{readiness.requiredSamplesPerClass} reviewed clusters and {readiness.requiredSpatialGroupsPerClass} spatial groups required per class</span></div>
        {readiness.requiredClasses.map((category) => {
          const count = readiness.reviewedLabelCounts[category] ?? 0;
          const progress = Math.min(100, count / readiness.requiredSamplesPerClass * 100);
          return (
            <div key={category}>
              <span style={{ color: CLASS_META[category].color }}>{CLASS_META[category].label}</span>
              <strong>{count}/{readiness.requiredSamplesPerClass}</strong>
              <i><b style={{ width: `${progress}%`, background: CLASS_META[category].color }} /></i>
              <small>{readiness.weakLabelCounts[category]?.toLocaleString("en-IN") ?? 0} weak-label candidates</small>
            </div>
          );
        })}
      </section>

      <section className="model-comparison-card">
        <div className="model-section-heading">
          <div><p className="eyebrow">Spatially separated evaluation</p><h3>Candidate comparison</h3></div>
          <span>Weak-label agreement · not accuracy</span>
        </div>
        {candidates.length ? (
          <div className="model-table-scroll">
            <div className="model-table model-table-head"><span>Candidate</span><span>Device</span><span>Balanced agreement</span><span>Macro F1</span><span>Industrial precision</span><span>Industrial recall</span><span>Train time</span></div>
            {candidates.map((candidate) => (
              <div key={candidate.model} className={`model-table ${candidate.model === report?.selectedDevelopmentCandidate ? "is-selected" : ""}`}>
                <span><strong>{modelDisplayName(candidate.model)}</strong><small>{candidate.model === report?.selectedDevelopmentCandidate ? "development candidate" : candidate.model === "model_v1_rules_baseline" ? "operational reference" : "offline artifact"}</small></span>
                <span>{candidate.device}</span>
                <span>{(candidate.metrics.balancedAccuracy * 100).toFixed(1)}%</span>
                <span>{(candidate.metrics.macroF1 * 100).toFixed(1)}%</span>
                <span>{(candidate.metrics.industrialPrecision * 100).toFixed(1)}%</span>
                <span>{(candidate.metrics.industrialRecall * 100).toFixed(1)}%</span>
                <span>{candidate.trainingSeconds.toFixed(2)}s</span>
              </div>
            ))}
          </div>
        ) : <p className="model-empty">No reproducible benchmark report is bundled yet.</p>}
      </section>

      {selected && (
        <div className="model-diagnostics-grid">
          <section className="model-confusion-card">
            <div className="model-section-heading">
              <div><p className="eyebrow">Held-out confusion matrix</p><h3>{modelDisplayName(selected.model)}</h3></div>
              <span>Rows: weak label · columns: prediction</span>
            </div>
            <div className="confusion-grid" style={{ gridTemplateColumns: `104px repeat(${selected.metrics.labels.length}, minmax(48px, 1fr))` }}>
              <span />
              {selected.metrics.labels.map((label) => <b key={`head-${label}`}>{label.slice(0, 4)}</b>)}
              {selected.metrics.confusionMatrix.flatMap((row, rowIndex) => [
                <b key={`row-${selected.metrics.labels[rowIndex]}`}>{selected.metrics.labels[rowIndex]}</b>,
                ...row.map((value, columnIndex) => (
                  <span key={`${rowIndex}-${columnIndex}`} className={rowIndex === columnIndex ? "is-diagonal" : ""}>{value}</span>
                )),
              ])}
            </div>
          </section>

          <section className="model-features-card">
            <div className="model-section-heading">
              <div><p className="eyebrow">Candidate behavior</p><h3>Top feature signals</h3></div>
              <span>{readiness.currentFeatureVersion}</span>
            </div>
            <div className="feature-bars">
              {rankedFeatures.map(([feature, value]) => (
                <div key={feature}><span>{feature.replaceAll("_", " ")}</span><i><b style={{ width: `${value / maximumImportance * 100}%` }} /></i><strong>{value.toFixed(3)}</strong></div>
              ))}
            </div>
          </section>
        </div>
      )}

      <section className="model-policy-grid">
        <div><ShieldCheck size={14} /><span><strong>Label policy</strong>{readiness.labelPolicy}</span></div>
        <div><Grid3X3 size={14} /><span><strong>Split policy</strong>{readiness.splitPolicy}</span></div>
      </section>

      {registry && (
        <section className="model-registry-card">
          <div className="model-section-heading">
            <div><p className="eyebrow">Versioned control plane</p><h3>Model registry</h3></div>
            <span>Rollback: {registry.rollbackTarget}</span>
          </div>
          <div className="registry-table-scroll">
            <div className="registry-table registry-table-head"><span>Version / family</span><span>Lifecycle</span><span>Serving</span><span>Label source</span><span>Artifact integrity</span><span>Promotion state</span></div>
            {registry.entries.map((entry) => (
              <div key={entry.version} className={`registry-table ${entry.serving ? "is-serving" : ""}`}>
                <span><strong>{entry.version}</strong><small>{entry.family} · {entry.device}</small></span>
                <span>{entry.lifecycle.replaceAll("_", " ")}</span>
                <span className={entry.serving ? "text-emerald-300" : "text-slate-600"}>{entry.serving ? "yes" : "no"}</span>
                <span>{entry.labelProvenance.replaceAll("_", " ")}</span>
                <span title={entry.artifactSha256 ?? "No binary artifact"}>{entry.artifactSha256 ? `${entry.artifactSha256.slice(0, 12)}…` : "not applicable"}</span>
                <span>{entry.promotionStatus.replaceAll("_", " ")}</span>
              </div>
            ))}
          </div>
          <div className="registry-policy">
            {registry.promotionPolicy.map((item, index) => <p key={item}><b>{String(index + 1).padStart(2, "0")}</b>{item}</p>)}
          </div>
        </section>
      )}
    </section>
  );
}

export function CommandCenter() {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState(DEMO_EVENTS[0].id);
  const [query, setQuery] = useState("");
  const [nav, setNav] = useState<WorkspaceName>("Overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileIntelOpen, setMobileIntelOpen] = useState(false);
  const [operationalDataset, setOperationalDataset] = useState<DashboardDataset | null>(null);
  const [evidenceGraph, setEvidenceGraph] = useState<EventEvidenceGraph | null>(null);
  const [clusteringSensitivity, setClusteringSensitivity] = useState<ClusteringSensitivityReport | null>(null);
  const [unknownFingerprints, setUnknownFingerprints] = useState<ThermalSourceFingerprint[]>([]);
  const [operationalHealth, setOperationalHealth] = useState<OperationalHealth | null>(null);
  const [ingestionRuns, setIngestionRuns] = useState<IngestionRun[]>([]);
  const [dataView, setDataView] = useState<"operational" | "simulation">("simulation");
  const [apiStatus, setApiStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [showFacilities, setShowFacilities] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showSatellite, setShowSatellite] = useState(true);
  const [showLandCover, setShowLandCover] = useState(true);
  const [mapFocusNonce, setMapFocusNonce] = useState(0);
  const isDesktop = useSyncExternalStore(
    subscribeToDesktopViewport,
    getDesktopSnapshot,
    getServerDesktopSnapshot,
  );
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("aegisfire-theme", nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchOperationalEvents(controller.signal)
      .then((dataset) => {
        if (!dataset.events.length) throw new Error("Operational dataset is empty");
        setOperationalDataset(dataset);
        setDataView("operational");
        setApiStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setApiStatus("unavailable");
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchClusteringSensitivity(controller.signal)
      .then(setClusteringSensitivity)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setClusteringSensitivity(null);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchUnknownDiscoveries(controller.signal),
      fetchOperationalHealth(controller.signal),
      fetchIngestionRuns(controller.signal),
    ])
      .then(([discoveries, health, runs]) => {
        setUnknownFingerprints(discoveries.fingerprints);
        setOperationalHealth(health);
        setIngestionRuns(runs);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setUnknownFingerprints([]);
        setOperationalHealth(null);
        setIngestionRuns([]);
      });
    return () => controller.abort();
  }, []);

  const activeEvents =
    dataView === "operational" && operationalDataset
      ? operationalDataset.events
      : DEMO_EVENTS;

  const filteredEvents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return activeEvents.filter((event) => {
      const categoryMatch = filter === "all" || event.category === filter;
      const queryMatch =
        !normalized ||
        event.title.toLowerCase().includes(normalized) ||
        event.region.toLowerCase().includes(normalized) ||
        event.shortId.toLowerCase().includes(normalized) ||
        (event.landCover?.classLabel.toLowerCase().includes(normalized) ?? false);
      return categoryMatch && queryMatch;
    });
  }, [activeEvents, filter, query]);

  const effectiveSelectedId = filteredEvents.some((event) => event.id === selectedId)
    ? selectedId
    : (filteredEvents[0]?.id ?? selectedId);

  const selectedEvent =
    activeEvents.find((event) => event.id === effectiveSelectedId) ?? activeEvents[0] ?? DEMO_EVENTS[0];

  useEffect(() => {
    if (dataView !== "operational") return;
    const controller = new AbortController();
    fetchEventEvidenceGraph(selectedEvent.id, controller.signal)
      .then(setEvidenceGraph)
      .catch(() => undefined);
    return () => controller.abort();
  }, [dataView, selectedEvent.id]);

  const selectedEvidenceGraph =
    dataView === "operational" && evidenceGraph?.eventId === selectedEvent.id
      ? evidenceGraph
      : null;

  const highFrpCount = activeEvents.filter((event) => event.frp >= 20).length;
  const corroboratedCount = activeEvents.filter((event) => (event.sensorCount ?? 1) >= 2).length;
  const priorityCount =
    dataView === "operational" && operationalDataset
      ? operationalDataset.alertCount
      : activeEvents.filter((event) => event.severity === "critical" || event.severity === "high").length;
  const datasetTotal = dataView === "operational" && operationalDataset ? operationalDataset.total : activeEvents.length;
  const visibleQueueEvents = filteredEvents.slice(0, 350);

  const selectEvent = (id: string) => {
    setSelectedId(id);
    setMapFocusNonce((current) => current + 1);
    if (window.innerWidth < 1440) setMobileIntelOpen(true);
  };

  const handleAlertReview = async (
    alertId: string,
    status: ReviewAlert["reviewStatus"],
  ) => {
    const updated = await updateAlertReview(alertId, status);
    setOperationalDataset((current) => {
      if (!current) return current;
      const alerts = current.alerts.map((alert) => alert.id === updated.id ? updated : alert);
      return {
        ...current,
        alerts,
        alertCount: alerts.filter((alert) => alert.reviewStatus !== "closed").length,
      };
    });
  };

  const handleClusterReview = async (
    clusterId: string,
    label: ClusterReviewLabel,
    note: string,
  ) => {
    const review = await createClusterReview(clusterId, label, note);
    setOperationalDataset((current) => current
      ? { ...current, clusterReviews: [review, ...current.clusterReviews] }
      : current);
  };

  const viewCopy = {
    Overview: ["National operating picture", "Thermal intelligence command center", "Detection · context · persistence · classification · explanation"],
    Events: ["Evidence-led triage", "Alert and event review", "Prioritized candidates · reason codes · human validation"],
    Monitor: ["Facility-centric intelligence", "Industrial facility monitor", "Attributed observations · temporal status · operational context"],
    Playback: ["Historical reconstruction", "Thermal activity playback", "Daily frames · newly observed cells · cumulative recurrence"],
    Discover: ["Persistent-source intelligence", "Unknown-source discovery", "Thermal fingerprints · ranked candidates · explicit uncertainty"],
    Sources: ["Provenance control", "Evidence source registry", "Readiness · attribution · known boundaries"],
    Analytics: ["Temporal analysis", "Persistence and anomaly workspace", "Observed recurrence · robust deviation · candidate ranking"],
    Validate: ["Human-in-the-loop review", "Cluster validation workspace", "Satellite context · metric diagnostics · append-only analyst labels"],
    Models: ["Governed learning system", "Model readiness and benchmark laboratory", "GPU provenance · spatial holdout · deployment gate"],
  }[nav] ?? ["National operating picture", "Thermal intelligence command center", "Detection · context · persistence · classification · explanation"];
  const currentWorkspace = NAV_ITEMS.find((item) => item.label === nav) ?? NAV_ITEMS[0];
  const CurrentWorkspaceIcon = currentWorkspace.icon;
  const showSearch = nav === "Overview" || nav === "Events" || nav === "Discover";

  const generateBrief = () => {
    const lines = [
      `# AegisFire evidence brief — ${selectedEvent.shortId}`,
      "",
      `Generated: ${new Date().toISOString()}`,
      `Classification: ${selectedEvent.classification} (${selectedEvent.confidence}% rules confidence)`,
      `Status: ${selectedEvent.status}`,
      `Coordinates: ${selectedEvent.coordinates[1].toFixed(5)}, ${selectedEvent.coordinates[0].toFixed(5)}`,
      `Observed FRP: ${selectedEvent.frp.toFixed(2)} MW`,
      `Observed baseline: ${selectedEvent.baselineFrp.toFixed(2)} MW median`,
      `Recurrence: ${selectedEvent.activeDays}/${selectedEvent.historyWindow} active days`,
      `Nearest mapped context: ${selectedEvent.nearestFacility} (${selectedEvent.facilityDistance})`,
      `Land-cover context: ${selectedEvent.landCover ? `${selectedEvent.landCover.classLabel} (${selectedEvent.landCover.observationDate})` : "unavailable"}`,
      `Sensor: ${selectedEvent.sensor}`,
      "",
      "## Evidence",
      ...selectedEvent.evidence.map((item) => `- ${item.label}: ${item.value} — ${item.source}`),
      "",
      "## Interpretation boundary",
      "This brief ranks an evidence-backed thermal-anomaly candidate for analyst review. It does not confirm a fire, accident, or responsible facility.",
      "",
      `Source record: ${selectedEvent.sourceUrl ?? "deterministic simulation fixture"}`,
      `Model: ${selectedEvent.modelVersion ?? "simulation_rules_v1"}`,
      `Features: ${selectedEvent.featureVersion ?? "simulation_features_v1"}`,
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/markdown" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `aegisfire-${selectedEvent.shortId.toLowerCase()}-brief.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className={`app-shell ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
      <div className="noise-layer" aria-hidden="true" />

      <aside className="mission-sidebar" aria-label="AegisFire navigation">
        <div className="sidebar-brand">
          <div className="brand-mark"><Radar size={18} strokeWidth={2.2} /></div>
          <div className="sidebar-brand-copy">
            <strong>AEGISFIRE</strong>
            <span>Thermal intelligence</span>
          </div>
          <button
            type="button"
            className="sidebar-collapse"
            aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={() => setSidebarCollapsed((current) => !current)}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>

        <nav className="mission-navigation" aria-label="Primary navigation">
          {NAV_GROUPS.map((group) => (
            <section key={group.label} className="nav-group">
              <p>{group.label}</p>
              {group.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setNav(item.label)}
                  className={`mission-nav-item ${nav === item.label ? "is-active" : ""}`}
                  aria-current={nav === item.label ? "page" : undefined}
                  title={sidebarCollapsed ? `${item.label} — ${item.description}` : undefined}
                >
                  <item.icon size={16} strokeWidth={1.8} />
                  <span><strong>{item.label}</strong><small>{item.description}</small></span>
                  <ChevronRight size={13} />
                </button>
              ))}
            </section>
          ))}
        </nav>

        <div className="sidebar-system-card">
          <div className="sidebar-system-heading">
            <span className={`system-indicator status-${apiStatus}`} />
            <span><strong>{dataView === "operational" ? "FIRMS connected" : "Demo safeguard"}</strong><small>{apiStatus === "ready" ? "Operational source available" : apiStatus === "loading" ? "Connecting to local service" : "Offline cache active"}</small></span>
          </div>
          <button
            type="button"
            disabled={!operationalDataset}
            onClick={() => setDataView((current) => current === "operational" ? "simulation" : "operational")}
            className="source-switch"
            title={operationalDataset ? "Switch between NASA FIRMS and simulation data" : "Waiting for the local API"}
          >
            {dataView === "operational" ? "Use simulation" : "Use FIRMS snapshot"}
            <ChevronRight size={12} />
          </button>
        </div>

        <div className="sidebar-operator">
          <div className="operator-avatar">TA</div>
          <span><strong>Thermal analyst</strong><small>National desk</small></span>
          <ShieldCheck size={14} />
        </div>
      </aside>

      <div className="app-body">
        <header className="command-bar">
          <div className="command-mobile-brand">
            <button type="button" className="icon-button" aria-label="Open navigation" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((current) => !current)}><Menu size={17} /></button>
            <div className="brand-mark"><Radar size={16} /></div>
          </div>
          <div className="command-location">
            <span>Mission control</span>
            <ChevronRight size={12} />
            <CurrentWorkspaceIcon size={14} />
            <strong>{nav}</strong>
          </div>
          <div className="command-actions">
            <span className="command-time"><Clock3 size={13} /> Live intelligence</span>
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              aria-pressed={theme === "light"}
            >
              <Sun size={13} />
              <span className="theme-toggle-track"><i /></span>
              <Moon size={13} />
            </button>
            <button type="button" className="icon-button notification-button" aria-label="Open event notifications" onClick={() => setNav("Events")}>
              <Bell size={15} /><i />
            </button>
            <div className="command-avatar" aria-label="Signed in as thermal analyst">TA</div>
          </div>
        </header>

        {mobileNavOpen && (
          <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)}>
            <nav className="mobile-nav-panel" aria-label="Mobile navigation" onClick={(event) => event.stopPropagation()}>
              <div className="mobile-nav-heading"><span><Radar size={16} /> AegisFire</span><button type="button" className="icon-button" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={15} /></button></div>
              {NAV_GROUPS.map((group) => (
                <section key={group.label}>
                  <p>{group.label}</p>
                  {group.items.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className={nav === item.label ? "is-active" : ""}
                      onClick={() => { setNav(item.label); setMobileNavOpen(false); }}
                    >
                      <item.icon size={15} />
                      <span><strong>{item.label}</strong><small>{item.description}</small></span>
                      <ChevronRight size={12} />
                    </button>
                  ))}
                </section>
              ))}
            </nav>
          </div>
        )}

        <section className="workspace-container">
          <div className="workspace-heading">
            <div className="workspace-title-block">
              <div className="workspace-kicker"><CircleDot size={11} /> {viewCopy[0]}</div>
              <h1>{viewCopy[1]}</h1>
              <p>{viewCopy[2]}</p>
            </div>
            <div className="workspace-actions">
              {showSearch && <div className="search-box">
                <Search size={14} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ID, region, source…" aria-label="Search thermal intelligence" />
                {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={12} /></button>}
              </div>}
              {nav === "Overview" && <button type="button" className="primary-button" onClick={generateBrief}><Sparkles size={14} /> Generate brief</button>}
            </div>
          </div>

          {nav === "Overview" && <section className="mission-pulse" aria-label="Mission pulse">
            <div className="mission-pulse-label"><span>Mission pulse</span><small>{dataView === "operational" ? "NASA FIRMS snapshot" : "Deterministic demo"}</small></div>
            <MetricCard label="Detections" value={datasetTotal.toLocaleString("en-IN")} detail={`${activeEvents.length} currently mapped`} icon={Flame} tone="#ff6b35" />
            <MetricCard label="High FRP" value={String(highFrpCount).padStart(2, "0")} detail="≥ 20 MW · candidate only" icon={Gauge} tone="#d89a22" />
            <MetricCard label="Corroborated" value={String(corroboratedCount).padStart(2, "0")} detail="Multiple VIIRS sources" icon={Radar} tone="#4fae67" />
            <MetricCard label="Review queue" value={String(priorityCount).padStart(2, "0")} detail="Open priority clusters" icon={AlertTriangle} tone="#8c6ad8" />
          </section>}

        {nav === "Overview" && <div className="workspace-grid">
          <section className="event-rail custom-scrollbar">
            <div className="border-b border-white/[0.07] p-3">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Intelligence queue</p>
                <span className="font-mono text-[10px] text-slate-600">{visibleQueueEvents.length}/{filteredEvents.length}</span>
              </div>
              <div className="filter-strip mt-3 flex gap-1.5 pb-1">
                {FILTERS.map((item) => (
                  <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`filter-button ${filter === item.id ? "is-active" : ""}`}>
                    <span>{item.label}</span>
                    <span className="font-mono text-[9px] opacity-60">
                      {item.id === "all" ? activeEvents.length : activeEvents.filter((event) => event.category === item.id).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-white/[0.055]">
              {visibleQueueEvents.length ? visibleQueueEvents.map((event) => (
                <EventRow key={event.id} event={event} selected={effectiveSelectedId === event.id} onClick={() => selectEvent(event.id)} />
              )) : (
                <div className="px-4 py-10 text-center">
                  <Search className="mx-auto text-slate-700" size={22} />
                  <p className="mt-3 text-xs text-slate-500">No intelligence matches this view.</p>
                </div>
              )}
            </div>
          </section>

          <section className="map-panel">
            <div className="flex h-11 items-center justify-between border-b border-white/[0.07] px-4">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-300"><MapIcon size={13} /> Intelligence map</span>
                <span className="hidden text-[9px] text-slate-600 sm:inline">India · last 24 hours · all sensors</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="map-tool" onClick={() => setShowGrid((current) => !current)} aria-pressed={showGrid}><Grid3X3 size={12} /> <span className="hidden sm:inline">{showGrid ? "Grid on" : "Grid off"}</span></button>
                <button type="button" className="map-tool" onClick={() => setShowSatellite((current) => !current)} aria-pressed={showSatellite}><Satellite size={12} /> <span className="hidden sm:inline">{showSatellite ? "Satellite" : "Terrain"}</span></button>
                <button type="button" className="map-tool" onClick={() => setShowLandCover((current) => !current)} aria-pressed={showLandCover}><Trees size={12} /> <span className="hidden sm:inline">{showLandCover ? "Land cover on" : "Land cover off"}</span></button>
                <button type="button" className="map-tool" onClick={() => setShowFacilities((current) => !current)}><Layers3 size={12} /> <span className="hidden sm:inline">{showFacilities ? "Facilities on" : "Facilities off"}</span></button>
                <button type="button" className="map-tool" onClick={() => setNav("Sources")}><Database size={12} /> <span className="hidden sm:inline">Sources</span></button>
              </div>
            </div>
            <div className="relative min-h-[480px] flex-1">
              <ThermalMap
                events={filteredEvents}
                selectedId={effectiveSelectedId}
                onSelect={selectEvent}
                facilities={showFacilities && dataView === "operational" ? operationalDataset?.facilities : []}
                showGrid={showGrid}
                showSatellite={showSatellite}
                showLandCover={showLandCover && dataView === "operational"}
                focusNonce={mapFocusNonce}
                boundary={dataView === "operational" ? operationalDataset?.boundary : null}
              />
            </div>
            <div className="map-statusbar">
              <span><ShieldCheck size={11} className="text-emerald-400" /> Attribution preserved</span>
              <span><Database size={11} /> FIRMS · MODIS IGBP · GIBS · OSM · geoBoundaries</span>
              <span className="ml-auto font-mono">{dataView === "operational" ? `NASA FIRMS · ${operationalDataset?.returned ?? 0} SHOWN` : "SIMULATION DATA · 01 SEP 2026"}</span>
            </div>
          </section>

          {isDesktop && <EvidencePanel event={selectedEvent} evidenceGraph={selectedEvidenceGraph} />}
        </div>}

        {nav === "Events" && <AlertsWorkspace alerts={operationalDataset?.alerts ?? []} onUpdate={handleAlertReview} />}
        {nav === "Monitor" && <FacilityMonitorWorkspace monitors={operationalDataset?.facilityMonitors ?? []} />}
        {nav === "Playback" && (
          <PlaybackWorkspace
            frames={operationalDataset?.playback ?? []}
            events={operationalDataset?.historicalEvents ?? []}
            facilities={operationalDataset?.facilities ?? []}
            boundary={operationalDataset?.boundary ?? null}
          />
        )}
        {nav === "Discover" && (
          <DiscoveryWorkspace
            fingerprints={unknownFingerprints}
            events={operationalDataset?.historicalEvents ?? []}
            facilities={operationalDataset?.facilities ?? []}
            boundary={operationalDataset?.boundary ?? null}
          />
        )}
        {nav === "Sources" && (
          <SourcesWorkspace
            dataset={operationalDataset}
            health={operationalHealth}
            ingestionRuns={ingestionRuns}
          />
        )}
        {nav === "Analytics" && (
          <AnalyticsWorkspace
            analytics={operationalDataset?.analytics ?? null}
            clusters={operationalDataset?.clusters ?? []}
            historyReadiness={operationalDataset?.historyReadiness ?? null}
            clusteringDiagnostics={operationalDataset?.clusteringDiagnostics ?? null}
            clusteringSensitivity={clusteringSensitivity}
          />
        )}
        {nav === "Validate" && (
          <ValidationWorkspace
            clusters={operationalDataset?.clusters ?? []}
            reviews={operationalDataset?.clusterReviews ?? []}
            events={operationalDataset?.historicalEvents ?? []}
            facilities={operationalDataset?.facilities ?? []}
            boundary={operationalDataset?.boundary ?? null}
            diagnostics={operationalDataset?.clusteringDiagnostics ?? null}
            onReview={handleClusterReview}
          />
        )}
        {nav === "Models" && (
          <ModelsWorkspace
            readiness={operationalDataset?.modelReadiness ?? null}
            benchmark={operationalDataset?.modelBenchmark ?? null}
            registry={operationalDataset?.modelRegistry ?? null}
          />
        )}

        <div className="methodology-strip">
          <span className="flex items-center gap-2"><ShieldCheck size={12} className="text-amber-300" /> {dataView === "operational" ? "Operational NASA FIRMS detections: thermal anomalies only. India ADM0 containment, OSM proximity, annual MODIS land cover, and accumulated history are applied; readiness is disclosed and no incident is confirmed." : "Demonstration environment: events and intelligence outputs are simulated and are not operational incident reports."}</span>
          <span className="hidden items-center gap-1 text-slate-600 sm:flex">Methodology <ChevronRight size={11} /></span>
        </div>
      </section>

      {mobileIntelOpen && (
        <div className="mobile-intel-backdrop min-[1440px]:hidden" onClick={() => setMobileIntelOpen(false)}>
          <div className="mobile-intel-sheet" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setMobileIntelOpen(false)} className="absolute right-4 top-4 z-10 icon-button" aria-label="Close intelligence panel"><X size={15} /></button>
            <EvidencePanel event={selectedEvent} evidenceGraph={selectedEvidenceGraph} />
          </div>
        </div>
      )}
      </div>
    </main>
  );
}
