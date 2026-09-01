"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import type { IndustrialFacility, ThermalEvent } from "@/lib/types";
import { CLASS_META } from "@/lib/demo-data";

type ThermalMapProps = {
  events: ThermalEvent[];
  selectedId: string;
  onSelect: (id: string) => void;
  facilities?: IndustrialFacility[];
  showGrid?: boolean;
};

const GRID_DATA: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
  type: "FeatureCollection",
  features: [
    ...[70, 75, 80, 85, 90, 95].map((longitude) => ({
      type: "Feature" as const,
      properties: { label: `${longitude}°E` },
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [longitude, 5],
          [longitude, 40],
        ],
      },
    })),
    ...[10, 15, 20, 25, 30, 35].map((latitude) => ({
      type: "Feature" as const,
      properties: { label: `${latitude}°N` },
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [65, latitude],
          [100, latitude],
        ],
      },
    })),
  ],
};

export function ThermalMap({
  events,
  selectedId,
  onSelect,
  facilities = [],
  showGrid = true,
}: ThermalMapProps) {
  const isOperational = events.some((event) => event.dataOrigin === "nasa-firms");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  const lastSelectedRef = useRef(selectedId);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [78.5, 22.7],
      zoom: 3.65,
      minZoom: 3,
      maxZoom: 12,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-left",
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);
    map.once("load", () => map.resize());

    mapRef.current = map;

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = events.map((event) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = `thermal-marker${event.id === selectedId ? " is-selected" : ""}${event.severity === "critical" || event.severity === "high" ? " is-alert" : ""}`;
      element.style.setProperty("--marker-color", CLASS_META[event.category].color);
      element.setAttribute("aria-label", `Select ${event.title}`);
      element.innerHTML = `<span></span><i></i>`;
      element.addEventListener("click", () => onSelectRef.current(event.id));

      return new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat(event.coordinates)
        .addTo(map);
    });
  }, [events, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyGrid = () => {
      if (!map.getSource("coordinate-grid")) {
        map.addSource("coordinate-grid", { type: "geojson", data: GRID_DATA });
        map.addLayer({
          id: "coordinate-grid-lines",
          type: "line",
          source: "coordinate-grid",
          paint: {
            "line-color": "#27c8f2",
            "line-opacity": 0.72,
            "line-width": 1.15,
            "line-dasharray": [3, 3],
          },
        });
        map.addLayer({
          id: "coordinate-grid-labels",
          type: "symbol",
          source: "coordinate-grid",
          layout: {
            "symbol-placement": "line",
            "symbol-spacing": 280,
            "text-field": ["get", "label"],
            "text-size": 10,
            "text-letter-spacing": 0.08,
          },
          paint: {
            "text-color": "#d8f7ff",
            "text-halo-color": "#071018",
            "text-halo-width": 1.4,
            "text-opacity": 0.95,
          },
        });
      }
      const visibility = showGrid ? "visible" : "none";
      map.setLayoutProperty("coordinate-grid-lines", "visibility", visibility);
      map.setLayoutProperty("coordinate-grid-labels", "visibility", visibility);
    };

    if (map.isStyleLoaded()) applyGrid();
    else map.once("load", applyGrid);
    return () => {
      map.off("load", applyGrid);
    };
  }, [showGrid]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const data = {
      type: "FeatureCollection" as const,
      features: facilities.map((facility) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: facility.coordinates,
        },
        properties: {
          id: facility.id,
          name: facility.name,
          facilityType: facility.facilityType,
        },
      })),
    };

    const applyFacilities = () => {
      const source = map.getSource("industrial-facilities") as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
        return;
      }
      map.addSource("industrial-facilities", { type: "geojson", data });
      map.addLayer({
        id: "industrial-facilities",
        type: "circle",
        source: "industrial-facilities",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 2, 8, 5],
          "circle-color": "#54d8ff",
          "circle-opacity": 0.56,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#071018",
        },
      });
    };

    if (map.isStyleLoaded()) applyFacilities();
    else map.once("load", applyFacilities);
    return () => {
      map.off("load", applyFacilities);
    };
  }, [facilities]);

  useEffect(() => {
    const map = mapRef.current;
    const selected = events.find((event) => event.id === selectedId);
    if (!map || !selected || lastSelectedRef.current === selectedId) return;

    lastSelectedRef.current = selectedId;

    map.flyTo({
      center: selected.coordinates,
      zoom: Math.max(map.getZoom(), 4.6),
      duration: 850,
      essential: true,
    });
  }, [events, selectedId]);

  return (
    <div className="map-shell">
      <div ref={containerRef} className="absolute inset-0" aria-label="Thermal events map" />
      <div className="map-vignette" aria-hidden="true" />
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-sm border border-white/10 bg-[#09121a]/90 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300 shadow-lg backdrop-blur">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        Live canvas · {isOperational ? "attributed snapshot" : "simulation cache"}
      </div>
      <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4 rounded-sm border border-white/10 bg-[#09121a]/90 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400 shadow-xl backdrop-blur">
        {Object.entries(CLASS_META).map(([key, item]) => (
          <span key={key} className="flex items-center gap-2 whitespace-nowrap">
            <i className="h-2 w-2 rounded-full" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
