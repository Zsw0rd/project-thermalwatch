"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  ChevronRight,
  CircleDot,
  Clock3,
  Database,
  Flame,
  Focus,
  Gauge,
  Grid3X3,
  Layers3,
  Map,
  Menu,
  Radar,
  Search,
  ShieldCheck,
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
import { fetchOperationalEvents } from "@/lib/api";
import type { DashboardDataset, EventClass, ThermalEvent } from "@/lib/types";
import { ThermalMap } from "./thermal-map";

type Filter = "all" | EventClass;

const NAV_ITEMS: { label: string; icon: LucideIcon }[] = [
  { label: "Overview", icon: Radar },
  { label: "Events", icon: Flame },
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
  const mediaQuery = window.matchMedia("(min-width: 1280px)");
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
};

const getDesktopSnapshot = () => window.matchMedia("(min-width: 1280px)").matches;
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
            ["Baseline FRP", isOperational ? "Not learned" : `${event.baselineFrp} MW`],
            [isOperational ? "Recurrence proxy" : "Persistence", `${event.persistence}/100`],
            [isOperational ? "Co-observations" : "Active days", isOperational ? `${event.activeDays} det. / ${event.historyWindow} src.` : `${event.activeDays}/${event.historyWindow}`],
          ].map(([label, value]) => (
            <div key={label} className="bg-[#0a121a] p-3">
              <p className="text-[9px] uppercase tracking-[0.13em] text-slate-600">{label}</p>
              <p className="mt-1.5 font-mono text-sm font-semibold text-slate-200">{value}</p>
            </div>
          ))}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="eyebrow">{isOperational ? "Snapshot thermal signature" : "7-day thermal signature"}</p>
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
  const corroboratedCount = activeEvents.filter((event) => event.status === "Cross-sensor corroboration").length;
  const priorityCount =
    dataView === "operational" && operationalDataset
      ? operationalDataset.alertCount
      : activeEvents.filter((event) => event.severity === "critical" || event.severity === "high").length;
  const datasetTotal = dataView === "operational" && operationalDataset ? operationalDataset.total : activeEvents.length;

  const selectEvent = (id: string) => {
    setSelectedId(id);
    if (window.innerWidth < 1280) setMobileIntelOpen(true);
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
          <button type="button" className="icon-button relative" aria-label="Notifications">
            <Bell size={15} />
            <i className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-orange-400" />
          </button>
          <button type="button" className="icon-button lg:hidden" aria-label="Open navigation"><Menu size={16} /></button>
          <div className="grid h-8 w-8 place-items-center rounded-sm border border-white/10 bg-[#111b24] text-[10px] font-bold text-slate-300">TA</div>
        </div>
      </header>

      <section className="mx-auto max-w-[1800px] px-3 pb-5 pt-4 sm:px-5 lg:px-6">
        <div className="mb-4 flex flex-col justify-between gap-3 xl:flex-row xl:items-end">
          <div>
            <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-orange-400">
              <CircleDot size={11} /> National operating picture
            </div>
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.035em] text-white sm:text-2xl">Thermal intelligence command center</h1>
            <p className="mt-1 text-[11px] text-slate-500">Detection · context · persistence · classification · explanation</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="search-box">
              <Search size={13} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ID, region, source…" aria-label="Search thermal intelligence" />
              {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={12} /></button>}
            </div>
            <button type="button" className="secondary-button"><SlidersHorizontal size={13} /> Advanced filters</button>
            <button type="button" className="primary-button"><Sparkles size={13} /> Generate brief</button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <MetricCard label="Thermal detections" value={datasetTotal.toLocaleString("en-IN")} detail={`${activeEvents.length} loaded on this map`} icon={Flame} tone="#ff6b35" />
          <MetricCard label="High-FRP signals" value={String(highFrpCount).padStart(2, "0")} detail="FRP ≥ 20 MW · not incident confirmation" icon={Gauge} tone="#f7bf4f" />
          <MetricCard label="Corroborated cells" value={String(corroboratedCount).padStart(2, "0")} detail="Observed by multiple VIIRS sources" icon={Radar} tone="#7ed957" />
          <MetricCard label="Priority review" value={String(priorityCount).padStart(2, "0")} detail="One triage item per grid cell" icon={AlertTriangle} tone="#b28cff" />
        </div>

        <div className="workspace-grid">
          <section className="event-rail custom-scrollbar">
            <div className="border-b border-white/[0.07] p-3">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Intelligence queue</p>
                <span className="font-mono text-[10px] text-slate-600">{filteredEvents.length}/{activeEvents.length}</span>
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
              {filteredEvents.length ? filteredEvents.map((event) => (
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
                <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-300"><Map size={13} /> Intelligence map</span>
                <span className="hidden text-[9px] text-slate-600 sm:inline">India · last 24 hours · all sensors</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="map-tool" onClick={() => setShowGrid((current) => !current)} aria-pressed={showGrid}><Grid3X3 size={12} /> <span className="hidden sm:inline">{showGrid ? "Grid on" : "Grid off"}</span></button>
                <button type="button" className="map-tool" onClick={() => setShowFacilities((current) => !current)}><Layers3 size={12} /> <span className="hidden sm:inline">{showFacilities ? "Facilities on" : "Facilities off"}</span></button>
                <button type="button" className="map-tool"><Database size={12} /> <span className="hidden sm:inline">Sources</span></button>
              </div>
            </div>
            <div className="relative min-h-[480px] flex-1">
              <ThermalMap
                events={filteredEvents}
                selectedId={effectiveSelectedId}
                onSelect={selectEvent}
                facilities={showFacilities && dataView === "operational" ? operationalDataset?.facilities : []}
                showGrid={showGrid}
              />
            </div>
            <div className="map-statusbar">
              <span><ShieldCheck size={11} className="text-emerald-400" /> Attribution preserved</span>
              <span><Database size={11} /> FIRMS · OSM · land cover pending</span>
              <span className="ml-auto font-mono">{dataView === "operational" ? `NASA FIRMS · ${operationalDataset?.returned ?? 0} SHOWN` : "SIMULATION DATA · 01 SEP 2026"}</span>
            </div>
          </section>

          {isDesktop && <EvidencePanel event={selectedEvent} />}
        </div>

        <div className="mt-3 flex items-center justify-between rounded-sm border border-amber-300/15 bg-amber-300/[0.035] px-3 py-2 text-[9px] text-slate-500">
          <span className="flex items-center gap-2"><ShieldCheck size={12} className="text-amber-300" /> {dataView === "operational" ? "Operational NASA FIRMS detections: thermal anomalies only. OSM proximity is applied; land cover, persistence history, and incident confirmation are not yet available." : "Demonstration environment: events and intelligence outputs are simulated and are not operational incident reports."}</span>
          <span className="hidden items-center gap-1 text-slate-600 sm:flex">Methodology <ChevronRight size={11} /></span>
        </div>
      </section>

      {mobileIntelOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm xl:hidden" onClick={() => setMobileIntelOpen(false)}>
          <div className="absolute bottom-0 right-0 top-0 w-full max-w-md bg-[#071018] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setMobileIntelOpen(false)} className="absolute right-4 top-4 z-10 icon-button" aria-label="Close intelligence panel"><X size={15} /></button>
            <EvidencePanel event={selectedEvent} />
          </div>
        </div>
      )}
    </main>
  );
}
