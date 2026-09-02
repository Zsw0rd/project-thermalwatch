"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  ChevronRight,
  CheckCircle2,
  CircleDot,
  Clock3,
  Database,
  Flame,
  Factory,
  Focus,
  Gauge,
  Grid3X3,
  Layers3,
  Map as MapIcon,
  Menu,
  Pause,
  Play,
  Radar,
  Satellite,
  Search,
  ShieldCheck,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Target,
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
import { fetchOperationalEvents, updateAlertReview } from "@/lib/api";
import type {
  AnalyticsDashboard,
  DashboardDataset,
  EventClass,
  FacilityMonitor,
  IndustrialFacility,
  PlaybackFrame,
  ReviewAlert,
  ThermalClusterSummary,
  ThermalEvent,
} from "@/lib/types";
import { ThermalMap } from "./thermal-map";

type Filter = "all" | EventClass;

const NAV_ITEMS: { label: string; icon: LucideIcon }[] = [
  { label: "Overview", icon: Radar },
  { label: "Events", icon: Flame },
  { label: "Monitor", icon: Factory },
  { label: "Playback", icon: Play },
  { label: "Sources", icon: Target },
  { label: "Analytics", icon: Activity },
];

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
  const mediaQuery = window.matchMedia("(min-width: 1120px)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
};

const getDesktopSnapshot = () => window.matchMedia("(min-width: 1120px)").matches;
const getServerDesktopSnapshot = () => false;

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
    <article className="metric-card group">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{label}</p>
          <p className="mt-2 text-[1.65rem] font-semibold tracking-[-0.04em] text-white">{value}</p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-sm border border-white/8 bg-white/[0.025]" style={{ color: tone }}>
          <Icon size={17} strokeWidth={1.8} />
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-white/[0.055] pt-3 text-[11px] text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} />
        {detail}
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

function EvidencePanel({ event }: { event: ThermalEvent }) {
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
}: {
  frames: PlaybackFrame[];
  events: ThermalEvent[];
  facilities: IndustrialFacility[];
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

function SourcesWorkspace({ dataset }: { dataset: DashboardDataset | null }) {
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
      title: "Temporal engine v2",
      state: "Candidate ranking",
      detail: `${dataset?.analytics?.observationWindowDays ?? "—"}-day recurrence and median/MAD deviation`,
      source: "Deterministic · explainable · no trained ML claim",
    },
  ];
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
}: {
  analytics: AnalyticsDashboard | null;
  clusters: ThermalClusterSummary[];
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

export function CommandCenter() {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState(DEMO_EVENTS[0].id);
  const [query, setQuery] = useState("");
  const [nav, setNav] = useState("Overview");
  const [mobileIntelOpen, setMobileIntelOpen] = useState(false);
  const [operationalDataset, setOperationalDataset] = useState<DashboardDataset | null>(null);
  const [dataView, setDataView] = useState<"operational" | "simulation">("simulation");
  const [apiStatus, setApiStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [showFacilities, setShowFacilities] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showSatellite, setShowSatellite] = useState(true);
  const [mapFocusNonce, setMapFocusNonce] = useState(0);
  const isDesktop = useSyncExternalStore(
    subscribeToDesktopViewport,
    getDesktopSnapshot,
    getServerDesktopSnapshot,
  );

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
        event.shortId.toLowerCase().includes(normalized);
      return categoryMatch && queryMatch;
    });
  }, [activeEvents, filter, query]);

  const effectiveSelectedId = filteredEvents.some((event) => event.id === selectedId)
    ? selectedId
    : (filteredEvents[0]?.id ?? selectedId);

  const selectedEvent =
    activeEvents.find((event) => event.id === effectiveSelectedId) ?? activeEvents[0] ?? DEMO_EVENTS[0];

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
    if (window.innerWidth < 1120) setMobileIntelOpen(true);
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

  const viewCopy = {
    Overview: ["National operating picture", "Thermal intelligence command center", "Detection · context · persistence · classification · explanation"],
    Events: ["Evidence-led triage", "Alert and event review", "Prioritized candidates · reason codes · human validation"],
    Monitor: ["Facility-centric intelligence", "Industrial facility monitor", "Attributed observations · temporal status · operational context"],
    Playback: ["Historical reconstruction", "Thermal activity playback", "Daily frames · newly observed cells · cumulative recurrence"],
    Sources: ["Provenance control", "Evidence source registry", "Readiness · attribution · known boundaries"],
    Analytics: ["Temporal analysis", "Persistence and anomaly workspace", "Observed recurrence · robust deviation · candidate ranking"],
  }[nav] ?? ["National operating picture", "Thermal intelligence command center", "Detection · context · persistence · classification · explanation"];

  const generateBrief = () => {
    const lines = [
      `# ThermalWatch evidence brief — ${selectedEvent.shortId}`,
      "",
      `Generated: ${new Date().toISOString()}`,
      `Classification: ${selectedEvent.classification} (${selectedEvent.confidence}% rules confidence)`,
      `Status: ${selectedEvent.status}`,
      `Coordinates: ${selectedEvent.coordinates[1].toFixed(5)}, ${selectedEvent.coordinates[0].toFixed(5)}`,
      `Observed FRP: ${selectedEvent.frp.toFixed(2)} MW`,
      `Observed baseline: ${selectedEvent.baselineFrp.toFixed(2)} MW median`,
      `Recurrence: ${selectedEvent.activeDays}/${selectedEvent.historyWindow} active days`,
      `Nearest mapped context: ${selectedEvent.nearestFacility} (${selectedEvent.facilityDistance})`,
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
    anchor.download = `thermalwatch-${selectedEvent.shortId.toLowerCase()}-brief.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-[#050a0f] text-slate-300">
      <div className="noise-layer" aria-hidden="true" />

      <header className="topbar">
        <div className="flex min-w-0 items-center gap-3">
          <div className="brand-mark"><Radar size={18} strokeWidth={2.2} /></div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-bold tracking-[-0.02em] text-white">THERMALWATCH</span>
              <span className="text-[9px] font-semibold tracking-[0.22em] text-orange-400">AI</span>
            </div>
            <p className="hidden text-[8px] uppercase tracking-[0.17em] text-slate-600 sm:block">Geospatial intelligence system</p>
          </div>
        </div>

        <nav className="hidden h-full items-center lg:flex" aria-label="Primary navigation">
          {NAV_ITEMS.map((item) => (
            <button key={item.label} type="button" onClick={() => setNav(item.label)} className={`nav-tab ${nav === item.label ? "is-active" : ""}`}>
              <item.icon size={13} /> {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            disabled={!operationalDataset}
            onClick={() => setDataView((current) => current === "operational" ? "simulation" : "operational")}
            className="hidden items-center gap-2 rounded-sm border border-emerald-400/15 bg-emerald-400/[0.045] px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-300 disabled:text-slate-500 sm:flex"
            title={operationalDataset ? "Switch between NASA FIRMS and simulation data" : "Waiting for the local API"}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${apiStatus === "ready" ? "bg-emerald-400" : apiStatus === "loading" ? "bg-amber-300" : "bg-slate-600"}`} />
            {apiStatus === "loading" ? "Connecting FIRMS" : dataView === "operational" ? "NASA FIRMS snapshot" : apiStatus === "ready" ? "Simulation · FIRMS ready" : "Simulation · API offline"}
          </button>
          <button type="button" className="icon-button relative" aria-label="Notifications" onClick={() => setNav("Events")}>
            <Bell size={15} />
            <i className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-orange-400" />
          </button>
          <button type="button" className="icon-button lg:hidden" aria-label="Open navigation"><Menu size={16} /></button>
          <div className="grid h-8 w-8 place-items-center rounded-sm border border-white/10 bg-[#111b24] text-[10px] font-bold text-slate-300">TA</div>
        </div>
      </header>

      <section className="mx-auto max-w-[1800px] px-3 pb-5 pt-4 sm:px-5 lg:px-6">
        <div className="mb-3 flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-orange-400">
              <CircleDot size={11} /> {viewCopy[0]}
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.035em] text-white sm:text-2xl">{viewCopy[1]}</h1>
            <p className="mt-1 text-[11px] text-slate-500">{viewCopy[2]}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="search-box">
              <Search size={13} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ID, region, source…" aria-label="Search thermal intelligence" />
              {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={12} /></button>}
            </div>
            <button type="button" className="secondary-button"><SlidersHorizontal size={13} /> Advanced filters</button>
            <button type="button" className="primary-button" onClick={generateBrief}><Sparkles size={13} /> Generate brief</button>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <MetricCard label="Thermal detections" value={datasetTotal.toLocaleString("en-IN")} detail={`${activeEvents.length} loaded on this map`} icon={Flame} tone="#ff6b35" />
          <MetricCard label="High-FRP signals" value={String(highFrpCount).padStart(2, "0")} detail="FRP ≥ 20 MW · not incident confirmation" icon={Gauge} tone="#f7bf4f" />
          <MetricCard label="Corroborated cells" value={String(corroboratedCount).padStart(2, "0")} detail="Observed by multiple VIIRS sources" icon={Radar} tone="#7ed957" />
          <MetricCard label="Priority review" value={String(priorityCount).padStart(2, "0")} detail="One triage item per grid cell" icon={AlertTriangle} tone="#b28cff" />
        </div>

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
                focusNonce={mapFocusNonce}
              />
            </div>
            <div className="map-statusbar">
              <span><ShieldCheck size={11} className="text-emerald-400" /> Attribution preserved</span>
              <span><Database size={11} /> FIRMS · GIBS imagery · OSM</span>
              <span className="ml-auto font-mono">{dataView === "operational" ? `NASA FIRMS · ${operationalDataset?.returned ?? 0} SHOWN` : "SIMULATION DATA · 01 SEP 2026"}</span>
            </div>
          </section>

          {isDesktop && <EvidencePanel event={selectedEvent} />}
        </div>}

        {nav === "Events" && <AlertsWorkspace alerts={operationalDataset?.alerts ?? []} onUpdate={handleAlertReview} />}
        {nav === "Monitor" && <FacilityMonitorWorkspace monitors={operationalDataset?.facilityMonitors ?? []} />}
        {nav === "Playback" && (
          <PlaybackWorkspace
            frames={operationalDataset?.playback ?? []}
            events={operationalDataset?.historicalEvents ?? []}
            facilities={operationalDataset?.facilities ?? []}
          />
        )}
        {nav === "Sources" && <SourcesWorkspace dataset={operationalDataset} />}
        {nav === "Analytics" && (
          <AnalyticsWorkspace
            analytics={operationalDataset?.analytics ?? null}
            clusters={operationalDataset?.clusters ?? []}
          />
        )}

        <div className="mt-3 flex items-center justify-between rounded-sm border border-amber-300/15 bg-amber-300/[0.035] px-3 py-2 text-[9px] text-slate-500">
          <span className="flex items-center gap-2"><ShieldCheck size={12} className="text-amber-300" /> {dataView === "operational" ? "Operational NASA FIRMS detections: thermal anomalies only. Seven-day recurrence and OSM proximity are applied; land cover, long-term history, and incident confirmation remain unavailable." : "Demonstration environment: events and intelligence outputs are simulated and are not operational incident reports."}</span>
          <span className="hidden items-center gap-1 text-slate-600 sm:flex">Methodology <ChevronRight size={11} /></span>
        </div>
      </section>

      {mobileIntelOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm min-[1120px]:hidden" onClick={() => setMobileIntelOpen(false)}>
          <div className="absolute bottom-0 right-0 top-0 w-full max-w-md bg-[#071018] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setMobileIntelOpen(false)} className="absolute right-4 top-4 z-10 icon-button" aria-label="Close intelligence panel"><X size={15} /></button>
            <EvidencePanel event={selectedEvent} />
          </div>
        </div>
      )}
    </main>
  );
}
