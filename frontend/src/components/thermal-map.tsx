"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { CLASS_META } from "@/lib/demo-data";
import type { IndiaBoundary, IndustrialFacility, ThermalEvent } from "@/lib/types";

type ThermalMapProps = {
  events: ThermalEvent[];
  selectedId: string;
  onSelect: (id: string) => void;
  facilities?: IndustrialFacility[];
  showGrid?: boolean;
  showSatellite?: boolean;
  showLandCover?: boolean;
  focusNonce?: number;
  boundary?: IndiaBoundary | null;
};

type CanvasThermalMarker = {
  x: number;
  y: number;
  radius: number;
  coordinates: [number, number];
  eventIds: string[];
};

const NASA_IMAGERY_DATE = "2026-09-01";
const MODIS_LAND_COVER_DATE = "2024-01-01";
const MODIS_LAND_COVER_LAYER = "MODIS_Combined_L3_IGBP_Land_Cover_Type_Annual";
const BASE_MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "osm-terrain": {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "operations-background",
      type: "background",
      paint: { "background-color": "#071018" },
    },
    {
      id: "osm-terrain-layer",
      type: "raster",
      source: "osm-terrain",
      paint: {
        "raster-opacity": 0.86,
        "raster-saturation": -0.7,
        "raster-contrast": 0.16,
        "raster-brightness-max": 0.72,
      },
    },
  ],
};

const eventFeatureCollection = (
  events: ThermalEvent[],
): GeoJSON.FeatureCollection<GeoJSON.Point> => ({
  type: "FeatureCollection",
  features: events.map((event) => ({
    type: "Feature",
    id: event.id,
    geometry: { type: "Point", coordinates: event.coordinates },
    properties: { eventId: event.id, category: event.category, frp: event.frp },
  })),
});

const raiseOperationalLayers = (map: MapLibreMap) => {
  void map;
};
const reportOperationalLayers = (map: MapLibreMap, container: HTMLDivElement | null) => {
  void map;
  void container;
};
const reportRenderedFeatures = (map: MapLibreMap, container: HTMLDivElement | null) => {
  void map;
  void container;
};
export function ThermalMap({
  events,
  selectedId,
  onSelect,
  facilities = [],
  showGrid = true,
  showSatellite = true,
  showLandCover = false,
  focusNonce = 0,
  boundary = null,
}: ThermalMapProps) {
  const isOperational = events.some((event) => event.dataOrigin === "nasa-firms");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const coordinateReadoutRef = useRef<HTMLSpanElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const canvasMarkersRef = useRef<CanvasThermalMarker[]>([]);
  const onSelectRef = useRef(onSelect);
  const lastFocusNonceRef = useRef(focusNonce);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_MAP_STYLE,
      bounds: [
        [67.5, 5.5],
        [98.5, 38.5],
      ],
      fitBoundsOptions: { padding: 24 },
      minZoom: 3,
      maxZoom: 14,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true, showZoom: true }),
      "bottom-left",
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    const updateReadout = (longitude: number, latitude: number) => {
      if (!coordinateReadoutRef.current) return;
      coordinateReadoutRef.current.textContent =
        `Z ${map.getZoom().toFixed(1)}  ·  ${Math.abs(latitude).toFixed(4)}°${latitude >= 0 ? "N" : "S"}  ${Math.abs(longitude).toFixed(4)}°${longitude >= 0 ? "E" : "W"}`;
    };
    map.on("mousemove", (event) => updateReadout(event.lngLat.lng, event.lngLat.lat));
    map.on("zoom", () => {
      const center = map.getCenter();
      updateReadout(center.lng, center.lat);
    });
    const reportMapError = (event: maplibregl.ErrorEvent) => {
      containerRef.current?.setAttribute("data-map-error", event.error.message);
    };
    map.on("error", reportMapError);

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);
    const markMapReady = () => {
      map.resize();
      const center = map.getCenter();
      updateReadout(center.lng, center.lat);
      setMapReady(true);
    };
    map.once("style.load", markMapReady);

    mapRef.current = map;

    return () => {
      resizeObserver.disconnect();
      map.off("style.load", markMapReady);
      map.off("error", reportMapError);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyImagery = () => {
      const firstSymbolLayer = map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
      if (!map.getSource("nasa-blue-marble")) {
        map.addSource("nasa-blue-marble", {
          type: "raster",
          tiles: [
            "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
          ],
          tileSize: 256,
          maxzoom: 8,
          attribution: "NASA EOSDIS GIBS",
        });
        map.addLayer(
          {
            id: "nasa-blue-marble-layer",
            type: "raster",
            source: "nasa-blue-marble",
            paint: { "raster-opacity": 0.95, "raster-saturation": -0.2 },
          },
          firstSymbolLayer,
        );
      }
      if (!map.getSource("nasa-viirs-imagery")) {
        map.addSource("nasa-viirs-imagery", {
          type: "raster",
          tiles: [
            `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${NASA_IMAGERY_DATE}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
          ],
          tileSize: 256,
          maxzoom: 9,
          attribution: `NASA EOSDIS GIBS · VIIRS ${NASA_IMAGERY_DATE}`,
        });
        map.addLayer(
          {
            id: "nasa-viirs-imagery-layer",
            type: "raster",
            source: "nasa-viirs-imagery",
            paint: {
              "raster-opacity": 0.78,
              "raster-contrast": 0.08,
              "raster-saturation": -0.12,
            },
          },
          firstSymbolLayer,
        );
      }
      const visibility = showSatellite ? "visible" : "none";
      map.setLayoutProperty("nasa-blue-marble-layer", "visibility", visibility);
      map.setLayoutProperty("nasa-viirs-imagery-layer", "visibility", visibility);
      containerRef.current?.setAttribute("data-imagery-layer", visibility);
    };

    if (mapReady) applyImagery();
  }, [mapReady, showSatellite]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (!map.getSource("nasa-modis-land-cover")) {
      map.addSource("nasa-modis-land-cover", {
        type: "raster",
        tiles: [
          `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${MODIS_LAND_COVER_LAYER}/default/${MODIS_LAND_COVER_DATE}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`,
        ],
        tileSize: 256,
        maxzoom: 8,
        attribution: "NASA EOSDIS GIBS · MCD12Q1.061 MODIS IGBP 2024",
      });
      map.addLayer({
        id: "nasa-modis-land-cover-layer",
        type: "raster",
        source: "nasa-modis-land-cover",
        paint: {
          "raster-opacity": 0.58,
          "raster-fade-duration": 0,
        },
      });
    }
    const visibility = showLandCover ? "visible" : "none";
    map.setLayoutProperty("nasa-modis-land-cover-layer", "visibility", visibility);
    containerRef.current?.setAttribute("data-land-cover-layer", visibility);
  }, [mapReady, showLandCover]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !boundary) return;
    const source = map.getSource("india-adm0") as GeoJSONSource | undefined;
    if (source) {
      source.setData(boundary);
    } else {
      map.addSource("india-adm0", {
        type: "geojson",
        data: boundary,
        attribution: "geoBoundaries gbOpen · CC0 1.0",
      });
      map.addLayer({
        id: "india-adm0-fill",
        type: "fill",
        source: "india-adm0",
        paint: {
          "fill-color": "#28c5e5",
          "fill-opacity": 0.025,
        },
      });
      map.addLayer({
        id: "india-adm0-line",
        type: "line",
        source: "india-adm0",
        paint: {
          "line-color": "rgba(104, 226, 250, 0.85)",
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.8, 9, 1.8],
          "line-opacity": 0.9,
        },
      });
    }
    containerRef.current?.setAttribute("data-boundary-layer", "india-adm0");
  }, [boundary, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const data = eventFeatureCollection(events);

    const applyEvents = () => {
      const source = map.getSource("thermal-events") as GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
        raiseOperationalLayers(map);
        reportOperationalLayers(map, containerRef.current);
        reportRenderedFeatures(map, containerRef.current);
        containerRef.current?.setAttribute("data-event-features", String(data.features.length));
        return;
      }

      map.addSource("thermal-events", {
        type: "geojson",
        data,
        cluster: false,
      });
      map.on("sourcedata", (event) => {
        if (event.sourceId !== "thermal-events") return;
        containerRef.current?.setAttribute(
          "data-source-event",
          `${event.sourceDataType ?? "unknown"}:${String(event.isSourceLoaded)}`,
        );
        if (!event.isSourceLoaded) return;
        reportRenderedFeatures(map, containerRef.current);
      });
      map.addLayer({
        id: "thermal-clusters",
        type: "circle",
        source: "thermal-events",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#3aa9c8",
            10,
            "#e7a83d",
            35,
            "#f05b3e",
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            13,
            10,
            18,
            35,
            24,
          ],
          "circle-opacity": 0.88,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#071018",
        },
      });
      map.addLayer({
        id: "thermal-cluster-count",
        type: "symbol",
        source: "thermal-events",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 10,
          "text-font": ["Noto Sans Regular"],
        },
        paint: {
          "text-color": "#071018",
          "text-halo-color": "rgba(255,255,255,0.35)",
          "text-halo-width": 0.5,
        },
      });
      map.addLayer({
        id: "thermal-points",
        type: "circle",
        source: "thermal-events",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "match",
            ["get", "category"],
            "industrial",
            CLASS_META.industrial.color,
            "vegetation",
            CLASS_META.vegetation.color,
            "agricultural",
            CLASS_META.agricultural.color,
            CLASS_META.unknown.color,
          ],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 4, 9, 7, 14, 10],
          "circle-opacity": 0.9,
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 3, 1, 10, 2],
          "circle-stroke-color": "#071018",
        },
      });

      map.on("click", "thermal-clusters", async (event) => {
        const feature = event.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;
        const clusterId = Number(feature.properties?.cluster_id);
        const clusterSource = map.getSource("thermal-events") as GeoJSONSource;
        const zoom = await clusterSource.getClusterExpansionZoom(clusterId);
        map.easeTo({
          center: feature.geometry.coordinates as [number, number],
          zoom,
          duration: 500,
        });
      });
      map.on("click", "thermal-points", (event) => {
        const eventId = event.features?.[0]?.properties?.eventId;
        if (typeof eventId === "string") onSelectRef.current(eventId);
      });
      for (const layer of ["thermal-clusters", "thermal-points"]) {
        map.on("mouseenter", layer, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
        });
      }
      raiseOperationalLayers(map);
      reportOperationalLayers(map, containerRef.current);
      reportRenderedFeatures(map, containerRef.current);
      containerRef.current?.setAttribute("data-event-features", String(data.features.length));
    };

    if (mapReady) applyEvents();
  }, [events, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const selected = events.find((event) => event.id === selectedId);
    if (!map) return;

    const selectedData: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: "FeatureCollection",
      features: selected
        ? [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: selected.coordinates },
              properties: { eventId: selected.id },
            },
          ]
        : [],
    };
    const applySelection = () => {
      const source = map.getSource("selected-thermal-event") as GeoJSONSource | undefined;
      if (source) source.setData(selectedData);
      else {
        map.addSource("selected-thermal-event", { type: "geojson", data: selectedData });
        map.addLayer({
          id: "selected-thermal-event-ring",
          type: "circle",
          source: "selected-thermal-event",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 9, 10, 15],
            "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-width": 2.5,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 0.95,
          },
        });
      }
      raiseOperationalLayers(map);
    };
    if (mapReady) applySelection();

    if (selected && lastFocusNonceRef.current !== focusNonce) {
      lastFocusNonceRef.current = focusNonce;
      map.flyTo({
        center: selected.coordinates,
        zoom: Math.max(map.getZoom(), 9),
        duration: 700,
        essential: true,
      });
    }
  }, [events, focusNonce, mapReady, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    const canvas = overlayCanvasRef.current;
    const container = containerRef.current;
    if (!map || !canvas || !container || !mapReady) return;

    let animationFrame = 0;
    const drawOverlay = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width === 0 || height === 0) return;

        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const targetWidth = Math.round(width * ratio);
        const targetHeight = Math.round(height * ratio);
        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
        }

        const context = canvas.getContext("2d");
        if (!context) return;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, width, height);

        if (showGrid) {
          context.save();
          context.lineWidth = 1;
          context.strokeStyle = "rgba(59, 220, 255, 0.62)";
          context.setLineDash([5, 7]);
          context.shadowColor = "rgba(25, 204, 255, 0.45)";
          context.shadowBlur = 4;

          for (const longitude of [70, 75, 80, 85, 90, 95]) {
            context.beginPath();
            for (let latitude = 5; latitude <= 40; latitude += 1) {
              const point = map.project([longitude, latitude]);
              if (latitude === 5) context.moveTo(point.x, point.y);
              else context.lineTo(point.x, point.y);
            }
            context.stroke();
          }
          for (const latitude of [10, 15, 20, 25, 30, 35]) {
            context.beginPath();
            for (let longitude = 65; longitude <= 100; longitude += 1) {
              const point = map.project([longitude, latitude]);
              if (longitude === 65) context.moveTo(point.x, point.y);
              else context.lineTo(point.x, point.y);
            }
            context.stroke();
          }

          const bounds = map.getBounds();
          const labelLatitude = Math.min(35, bounds.getNorth() - 0.6);
          const labelLongitude = Math.max(68, bounds.getWest() + 0.6);
          context.setLineDash([]);
          context.shadowBlur = 3;
          context.font = "600 9px ui-monospace, SFMono-Regular, Menlo, monospace";
          context.fillStyle = "rgba(190, 241, 255, 0.88)";
          for (const longitude of [70, 75, 80, 85, 90, 95]) {
            const point = map.project([longitude, labelLatitude]);
            if (point.x > 12 && point.x < width - 28) context.fillText(`${longitude}°E`, point.x + 4, 16);
          }
          for (const latitude of [10, 15, 20, 25, 30, 35]) {
            const point = map.project([labelLongitude, latitude]);
            if (point.y > 26 && point.y < height - 12) context.fillText(`${latitude}°N`, 8, point.y - 4);
          }
          context.restore();
        }

        context.save();
        context.fillStyle = "rgba(52, 211, 255, 0.58)";
        for (const facility of facilities) {
          const point = map.project(facility.coordinates);
          if (point.x < -4 || point.x > width + 4 || point.y < -4 || point.y > height + 4) continue;
          context.beginPath();
          context.arc(point.x, point.y, map.getZoom() < 6 ? 1.3 : 2, 0, Math.PI * 2);
          context.fill();
        }
        context.restore();

        const zoom = map.getZoom();
        const clusterSize = zoom >= 9.5 ? 0 : zoom >= 7 ? 34 : zoom >= 5 ? 44 : 58;
        const buckets = new Map<string, ThermalEvent[]>();
        for (const event of events) {
          const point = map.project(event.coordinates);
          if (point.x < -30 || point.x > width + 30 || point.y < -30 || point.y > height + 30) continue;
          const key = clusterSize
            ? `${Math.floor(point.x / clusterSize)}:${Math.floor(point.y / clusterSize)}`
            : event.id;
          const bucket = buckets.get(key);
          if (bucket) bucket.push(event);
          else buckets.set(key, [event]);
        }

        const canvasMarkers: CanvasThermalMarker[] = [];
        for (const bucketEvents of buckets.values()) {
          const longitude = bucketEvents.reduce((sum, event) => sum + event.coordinates[0], 0) / bucketEvents.length;
          const latitude = bucketEvents.reduce((sum, event) => sum + event.coordinates[1], 0) / bucketEvents.length;
          const coordinates: [number, number] = [longitude, latitude];
          const point = map.project(coordinates);
          const isCluster = bucketEvents.length > 1;
          const radius = isCluster ? Math.min(24, 10 + Math.log2(bucketEvents.length) * 2.4) : zoom < 6 ? 4.2 : 5.5;
          const hasIndustrial = bucketEvents.some((event) => event.category === "industrial");
          const fill = isCluster
            ? bucketEvents.length >= 25
              ? "#ff5f3d"
              : "#ffad3d"
            : CLASS_META[bucketEvents[0].category].color;

          context.save();
          context.shadowColor = fill;
          context.shadowBlur = isCluster ? 18 : 12;
          context.globalAlpha = 0.32;
          context.fillStyle = fill;
          context.beginPath();
          context.arc(point.x, point.y, radius + (isCluster ? 7 : 5), 0, Math.PI * 2);
          context.fill();
          context.globalAlpha = 0.96;
          context.shadowBlur = 7;
          context.fillStyle = fill;
          context.beginPath();
          context.arc(point.x, point.y, radius, 0, Math.PI * 2);
          context.fill();
          context.lineWidth = hasIndustrial ? 2 : 1.5;
          context.strokeStyle = hasIndustrial ? "#ffe4d6" : "#071018";
          context.stroke();
          if (isCluster) {
            context.shadowBlur = 0;
            context.fillStyle = "#081018";
            context.font = "700 10px ui-monospace, SFMono-Regular, Menlo, monospace";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText(bucketEvents.length > 999 ? "999+" : String(bucketEvents.length), point.x, point.y + 0.5);
          }
          context.restore();
          canvasMarkers.push({
            x: point.x,
            y: point.y,
            radius: radius + 7,
            coordinates,
            eventIds: bucketEvents.map((event) => event.id),
          });
        }

        const selected = events.find((event) => event.id === selectedId);
        if (selected) {
          const point = map.project(selected.coordinates);
          context.save();
          context.strokeStyle = "rgba(255, 255, 255, 0.96)";
          context.lineWidth = 2;
          context.shadowColor = "#ffffff";
          context.shadowBlur = 9;
          context.beginPath();
          context.arc(point.x, point.y, zoom < 7 ? 9 : 13, 0, Math.PI * 2);
          context.stroke();
          context.restore();
        }

        canvasMarkersRef.current = canvasMarkers;
        container.dataset.canvasMarkers = String(canvasMarkers.length);
        container.dataset.canvasGrid = String(showGrid);
      });
    };

    const nearestMarker = (x: number, y: number) =>
      canvasMarkersRef.current.find((marker) => Math.hypot(marker.x - x, marker.y - y) <= marker.radius);
    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      const marker = nearestMarker(event.point.x, event.point.y);
      if (!marker) return;
      if (marker.eventIds.length === 1) onSelectRef.current(marker.eventIds[0]);
      else {
        map.easeTo({
          center: marker.coordinates,
          zoom: Math.min(map.getZoom() + 2, 10),
          duration: 500,
        });
      }
    };
    const handlePointerMove = (event: maplibregl.MapMouseEvent) => {
      map.getCanvas().style.cursor = nearestMarker(event.point.x, event.point.y) ? "pointer" : "";
    };

    map.on("move", drawOverlay);
    map.on("resize", drawOverlay);
    map.on("click", handleMapClick);
    map.on("mousemove", handlePointerMove);
    drawOverlay();
    return () => {
      window.cancelAnimationFrame(animationFrame);
      map.off("move", drawOverlay);
      map.off("resize", drawOverlay);
      map.off("click", handleMapClick);
      map.off("mousemove", handlePointerMove);
    };
  }, [events, facilities, mapReady, selectedId, showGrid]);

  return (
    <div className="map-shell">
      <div ref={containerRef} className="absolute inset-0" aria-label="Thermal events map" />
      <div className="map-vignette" aria-hidden="true" />
      <canvas ref={overlayCanvasRef} className="operational-map-overlay" aria-hidden="true" />
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-sm border border-white/10 bg-[#09121a]/90 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300 shadow-lg backdrop-blur">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        Geospatial canvas · {isOperational ? "FIRMS · India ADM0" : "simulation cache"}
      </div>
      <div className="coordinate-readout">
        <span ref={coordinateReadoutRef}>Z — · cursor coordinates</span>
      </div>
      {showLandCover && (
        <div className="land-cover-legend" aria-label="MODIS IGBP land-cover legend">
          <strong>MODIS IGBP · 2024</strong>
          <span><i style={{ background: "#31cc31" }} /> Forest</span>
          <span><i style={{ background: "#faef73" }} /> Cropland</span>
          <span><i style={{ background: "#ff0000" }} /> Built-up</span>
          <span><i style={{ background: "#bfbfbd" }} /> Barren</span>
          <span><i style={{ background: "#86cae3" }} /> Water</span>
        </div>
      )}
      <div className="map-legend">
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
