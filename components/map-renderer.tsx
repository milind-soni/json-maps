"use client";

import { Fragment, createContext, useContext, useEffect, useRef, useCallback, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  type MapRendererProps,
  type MarkerSpec,
  type MarkerComponentProps,
  type PopupComponentProps,
  type TooltipComponentProps,
  type LayerTooltipComponentProps,
  type GeoJsonLayerSpec,
  type RouteLayerSpec,
  type HeatmapLayerSpec,
  type VectorTileLayerSpec,
  type RasterTileLayerSpec,
  type ControlsSpec,
  type LegendSpec,
  type WidgetSpec,
  type ColorValue,
  type ContinuousColor,
  type CategoricalColor,
  type SizeValue,
  resolveBasemapStyle,
} from "@/lib/spec";
import { PALETTES } from "@/lib/palettes";
import { osrmProvider } from "@/lib/routing";
import { DynamicIcon } from "lucide-react/dynamic";

const defaultRoutingProvider = osrmProvider();

const DEFAULT_CENTER: [number, number] = [0, 20];
const DEFAULT_ZOOM = 1.5;

/* ------------------------------------------------------------------ */
/*  Map context (useMap hook)                                          */
/* ------------------------------------------------------------------ */

interface MapContextValue {
  map: maplibregl.Map | null;
  isLoaded: boolean;
}

const MapContext = createContext<MapContextValue | null>(null);

export function useMap(): MapContextValue {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error("useMap must be used within <MapRenderer>");
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  Color helpers                                                      */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function colorValueToExpression(color: ColorValue): any {
  if (typeof color === "string") return color;

  const palette = PALETTES[color.palette];
  if (!palette || palette.length === 0) return "#888888";

  if (color.type === "continuous") {
    const [min, max] = color.domain ?? [0, 1];
    const steps = palette.length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expr: any[] = ["interpolate", ["linear"], ["get", color.attr]];
    for (let i = 0; i < steps; i++) {
      expr.push(min + (max - min) * (i / (steps - 1)));
      expr.push(palette[i]);
    }
    return expr;
  }

  if (color.type === "categorical") {
    if (!color.categories || color.categories.length === 0)
      return palette[0] ?? "#888888";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expr: any[] = ["match", ["get", color.attr]];
    for (let i = 0; i < color.categories.length; i++) {
      expr.push(color.categories[i]);
      expr.push(palette[i % palette.length]);
    }
    expr.push(color.nullColor ?? "#cccccc");
    return expr;
  }

  return "#888888";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sizeValueToExpression(size: SizeValue, fallback: number): any {
  if (typeof size === "number") return size;
  if (size.type === "continuous") {
    const [dMin, dMax] = size.domain;
    const [rMin, rMax] = size.range;
    return ["interpolate", ["linear"], ["get", size.attr], dMin, rMin, dMax, rMax];
  }
  return fallback;
}

/* ------------------------------------------------------------------ */
/*  Portal content components                                          */
/* ------------------------------------------------------------------ */

export function DefaultMarker({ marker, color }: MarkerComponentProps) {
  const { icon, label } = marker;
  const size = icon ? 28 : 16;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {icon ? (
        <div
          className="relative flex items-center justify-center w-7 h-7 rounded-full transition-transform duration-150 hover:scale-[1.15]"
          style={{
            background: color,
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
          }}
        >
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <DynamicIcon name={icon as any} size={16} color="#ffffff" strokeWidth={2.5} />
        </div>
      ) : (
        <div
          className="relative rounded-full border-2 border-white transition-transform duration-150 hover:scale-[1.3]"
          style={{
            width: size,
            height: size,
            background: color,
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
          }}
        />
      )}
      {label && (
        <div
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium pointer-events-none"
          style={{
            top: "100%",
            marginTop: 4,
            textShadow:
              "0 0 4px rgba(255,255,255,0.9), 0 0 4px rgba(255,255,255,0.9)",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

export function DefaultPopup({ marker }: PopupComponentProps) {
  const popup = marker.popup;
  if (!popup) return null;

  const isRich = typeof popup === "object";
  const title = isRich ? popup.title : marker.label;
  const description = isRich ? popup.description : popup;
  const image = isRich ? popup.image : undefined;

  return (
    <div className="relative rounded-md border border-border bg-popover text-popover-foreground shadow-md overflow-hidden max-w-[260px] animate-in fade-in-0 zoom-in-95">
      {image && (
        <div className="h-32 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={title ?? ""}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-3 space-y-1">
        {title && (
          <div className="font-semibold text-sm leading-tight">{title}</div>
        )}
        {description && (
          <div className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </div>
        )}
      </div>
    </div>
  );
}

export function DefaultTooltip({ text }: TooltipComponentProps) {
  return (
    <div className="rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md whitespace-nowrap animate-in fade-in-0 zoom-in-95">
      {text}
    </div>
  );
}

interface LayerTooltipData {
  properties: Record<string, unknown>;
  columns: string[];
}

export function DefaultLayerTooltip({ properties, columns }: LayerTooltipComponentProps) {
  // Simple text tooltip (single "_text" column = literal string)
  if (columns.length === 1 && columns[0] === "_text") {
    return (
      <div className="rounded-md border border-border bg-popover text-popover-foreground shadow-md px-2.5 py-1.5 max-w-[280px] text-xs font-medium">
        {String(properties._text)}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-popover text-popover-foreground shadow-md px-3 py-2 max-w-[280px]">
      <div className="space-y-0.5">
        {columns.map((col) => {
          const value = properties[col];
          if (value === undefined || value === null) return null;
          return (
            <div key={col} className="flex gap-2 text-xs leading-relaxed">
              <span className="text-muted-foreground shrink-0">
                {col}
              </span>
              <span className="font-medium truncate">{String(value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Map controls                                                       */
/* ------------------------------------------------------------------ */

const POSITION_CLASSES: Record<string, string> = {
  "top-left": "top-2 left-2",
  "top-right": "top-2 right-2",
  "bottom-left": "bottom-2 left-2",
  "bottom-right": "bottom-2 right-2",
};

function ControlButton({
  onClick,
  title,
  dark,
  children,
}: {
  onClick: () => void;
  title: string;
  dark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center w-[29px] h-[29px] border-0 cursor-pointer transition-colors duration-150 ${
        dark
          ? "bg-[#1a1a1a] hover:bg-[#252525] text-gray-300"
          : "bg-white hover:bg-gray-100 text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

function MapControls({
  controls,
  mapRef,
  containerRef,
  dark,
}: {
  controls: ControlsSpec;
  mapRef: React.RefObject<maplibregl.Map | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  dark: boolean;
}) {
  const position = controls.position ?? "top-right";
  const posClass = POSITION_CLASSES[position] ?? POSITION_CLASSES["top-right"];
  const [bearing, setBearing] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track bearing for compass rotation
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !controls.compass) return;
    const onRotate = () => setBearing(map.getBearing());
    map.on("rotate", onRotate);
    return () => { map.off("rotate", onRotate); };
  }, [mapRef, controls.compass]);

  // Track fullscreen changes
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const showZoom = controls.zoom !== false;
  const showCompass = controls.compass !== false;
  const borderClass = dark ? "border-white/10" : "border-gray-200";
  const dividerClass = dark ? "divide-white/10" : "divide-gray-200";

  return (
    <div className={`absolute ${posClass} z-10 flex flex-col gap-1.5`}>
      {/* Zoom controls */}
      {showZoom && (
        <div className={`rounded-md overflow-hidden shadow-md divide-y ${dividerClass} border ${borderClass}`}>
          <ControlButton onClick={() => mapRef.current?.zoomIn()} title="Zoom in" dark={dark}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="7" y1="2" x2="7" y2="12" />
              <line x1="2" y1="7" x2="12" y2="7" />
            </svg>
          </ControlButton>
          <ControlButton onClick={() => mapRef.current?.zoomOut()} title="Zoom out" dark={dark}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="2" y1="7" x2="12" y2="7" />
            </svg>
          </ControlButton>
        </div>
      )}

      {/* Compass */}
      {showCompass && (
        <div className={`rounded-md overflow-hidden shadow-md border ${borderClass}`}>
          <ControlButton onClick={() => mapRef.current?.easeTo({ bearing: 0, pitch: 0 })} title="Reset bearing" dark={dark}>
            <svg
              width="14" height="14" viewBox="0 0 14 14" fill="none"
              style={{ transform: `rotate(${-bearing}deg)`, transition: "transform 0.2s" }}
            >
              <polygon points="7,1 9,7 7,6 5,7" fill="#e74c3c" />
              <polygon points="7,13 5,7 7,8 9,7" fill={dark ? "#64748b" : "#94a3b8"} />
            </svg>
          </ControlButton>
        </div>
      )}

      {/* Locate */}
      {controls.locate && (
        <div className={`rounded-md overflow-hidden shadow-md border ${borderClass}`}>
          <ControlButton
            dark={dark}
            onClick={() => {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  mapRef.current?.flyTo({
                    center: [pos.coords.longitude, pos.coords.latitude],
                    zoom: 14,
                  });
                },
                () => {},
              );
            }}
            title="My location"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="3" />
              <line x1="7" y1="0" x2="7" y2="3" />
              <line x1="7" y1="11" x2="7" y2="14" />
              <line x1="0" y1="7" x2="3" y2="7" />
              <line x1="11" y1="7" x2="14" y2="7" />
            </svg>
          </ControlButton>
        </div>
      )}

      {/* Fullscreen */}
      {controls.fullscreen && (
        <div className={`rounded-md overflow-hidden shadow-md border ${borderClass}`}>
          <ControlButton
            dark={dark}
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen();
              } else {
                containerRef.current?.requestFullscreen();
              }
            }}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="5,1 5,5 1,5" />
                <polyline points="9,1 9,5 13,5" />
                <polyline points="5,13 5,9 1,9" />
                <polyline points="9,13 9,9 13,9" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="1,5 1,1 5,1" />
                <polyline points="9,1 13,1 13,5" />
                <polyline points="13,9 13,13 9,13" />
                <polyline points="5,13 1,13 1,9" />
              </svg>
            )}
          </ControlButton>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Basemap switcher                                                    */
/* ------------------------------------------------------------------ */

const BASEMAP_OPTIONS: { id: string; label: string; bg: string; border: string }[] = [
  { id: "light", label: "Light", bg: "#e8e8e8", border: "#ccc" },
  { id: "dark", label: "Dark", bg: "#2d2d2d", border: "#555" },
  { id: "streets", label: "Streets", bg: "#f0ece2", border: "#ccc" },
];

function BasemapSwitcher({
  activeBasemap,
  mapRef,
  syncMarkersRef,
  syncLayersRef,
  dark,
}: {
  activeBasemap: string;
  mapRef: React.RefObject<maplibregl.Map | null>;
  syncMarkersRef: React.RefObject<() => void>;
  syncLayersRef: React.RefObject<() => void>;
  dark: boolean;
}) {
  const [active, setActive] = useState(activeBasemap || "light");

  return (
    <div className={`absolute bottom-2 left-2 z-10 flex gap-1 rounded-md backdrop-blur-sm p-1 shadow-md border ${dark ? "bg-black/80 border-white/10" : "bg-white/90 border-gray-200"}`}>
      {BASEMAP_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          onClick={() => {
            const map = mapRef.current;
            if (!map || active === opt.id) return;
            setActive(opt.id);
            const style = resolveBasemapStyle(opt.id);
            if (style) {
              map.setStyle(style);
              map.once("styledata", () => {
                syncMarkersRef.current();
                syncLayersRef.current();
              });
            }
          }}
          title={opt.label}
          className="flex items-center justify-center rounded transition-all duration-150 cursor-pointer"
          style={{
            width: 28,
            height: 28,
            background: opt.bg,
            border: active === opt.id ? "2px solid #3b82f6" : `1px solid ${opt.border}`,
            opacity: active === opt.id ? 1 : 0.7,
          }}
        >
          {active === opt.id && (
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none" stroke={opt.id === "dark" ? "#fff" : "#3b82f6"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="2,7 5.5,10.5 12,3.5" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Geocoding search                                                   */
/* ------------------------------------------------------------------ */

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  boundingbox: [string, string, string, string];
}

function MapSearch({ mapRef, dark }: { mapRef: React.RefObject<maplibregl.Map | null>; dark: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback((q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`, {
      headers: { "Accept-Language": "en" },
    })
      .then((r) => r.json())
      .then((data: NominatimResult[]) => {
        setResults(data);
        setOpen(data.length > 0);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleInput = (value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(value), 300);
  };

  const handleSelect = (result: NominatimResult) => {
    const map = mapRef.current;
    if (!map) return;

    const lng = parseFloat(result.lon);
    const lat = parseFloat(result.lat);
    const bb = result.boundingbox;

    // Use bounding box for better zoom level
    if (bb) {
      map.fitBounds(
        [[parseFloat(bb[2]), parseFloat(bb[0])], [parseFloat(bb[3]), parseFloat(bb[1])]],
        { padding: 40, duration: 1200, maxZoom: 16 },
      );
    } else {
      map.flyTo({ center: [lng, lat], zoom: 14, duration: 1200 });
    }

    setQuery(result.display_name.split(",")[0] ?? result.display_name);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="absolute top-2 left-2 z-20" style={{ width: 260 }}>
      <div className="relative">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 pointer-events-none"
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={dark ? "#9ca3af" : "#6b7280"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search places..."
          className={`w-full rounded-md border backdrop-blur-md shadow-lg pl-8 pr-3 py-1.5 text-sm outline-none ${
            dark
              ? "border-white/10 bg-black/80 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
              : "border-gray-200/60 bg-white/95 text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
          }`}
        />
        {loading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <div className={`size-3.5 border-2 rounded-full animate-spin ${dark ? "border-gray-600 border-t-blue-400" : "border-gray-300 border-t-blue-500"}`} />
          </div>
        )}
      </div>
      {open && results.length > 0 && (
        <div className={`mt-1 rounded-md border backdrop-blur-md shadow-lg overflow-hidden ${dark ? "border-white/10 bg-black/80" : "border-gray-200/60 bg-white/95"}`}>
          {results.map((r) => {
            const parts = r.display_name.split(",");
            const name = parts[0]?.trim();
            const sub = parts.slice(1, 3).join(",").trim();
            return (
              <button
                key={r.place_id}
                onClick={() => handleSelect(r)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer last:border-b-0 ${
                  dark
                    ? "hover:bg-white/10 border-b border-white/5"
                    : "hover:bg-gray-100 border-b border-gray-100"
                }`}
              >
                <div className={`font-medium truncate ${dark ? "text-white" : "text-gray-900"}`}>{name}</div>
                {sub && <div className={`text-[11px] truncate ${dark ? "text-gray-400" : "text-gray-500"}`}>{sub}</div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Legend                                                              */
/* ------------------------------------------------------------------ */

function MapLegend({
  legendSpec,
  layerSpec,
  dark,
}: {
  legendSpec: LegendSpec;
  layerSpec: GeoJsonLayerSpec | null;
  dark: boolean;
}) {
  if (!layerSpec || !layerSpec.style) return null;

  const position = legendSpec.position ?? "bottom-left";
  const posClass = POSITION_CLASSES[position] ?? POSITION_CLASSES["bottom-left"];
  const title = legendSpec.title ?? legendSpec.layer;
  const style = layerSpec.style;

  // Find the first data-driven color for the legend
  const colorDef = (style.pointColor ?? style.fillColor ?? style.lineColor) as
    | ContinuousColor
    | CategoricalColor
    | string
    | undefined;

  if (!colorDef || typeof colorDef === "string") return null;

  const palette = PALETTES[colorDef.palette];
  if (!palette || palette.length === 0) return null;

  const cardClass = dark
    ? "rounded-md border border-white/10 bg-black/80 backdrop-blur-sm shadow-md px-3 py-2 text-xs"
    : "rounded-md border border-gray-200 bg-white/95 backdrop-blur-sm shadow-md px-3 py-2 text-xs";
  const titleClass = dark ? "font-semibold text-white mb-1.5" : "font-semibold text-gray-800 mb-1.5";

  return (
    <div className={`absolute ${posClass} z-10`}>
      <div className={cardClass}>
        <div className={titleClass}>{title}</div>
        {colorDef.type === "continuous" && (
          <ContinuousLegend colorDef={colorDef} palette={palette} dark={dark} />
        )}
        {colorDef.type === "categorical" && (
          <CategoricalLegend colorDef={colorDef} palette={palette} dark={dark} />
        )}
      </div>
    </div>
  );
}

function ContinuousLegend({
  colorDef,
  palette,
  dark,
}: {
  colorDef: ContinuousColor;
  palette: string[];
  dark: boolean;
}) {
  const [min, max] = colorDef.domain ?? [0, 1];
  const gradient = `linear-gradient(to right, ${palette.join(", ")})`;

  return (
    <div>
      <div
        className="h-2.5 w-36 rounded-sm"
        style={{ background: gradient }}
      />
      <div className={`flex justify-between mt-0.5 text-[10px] ${dark ? "text-gray-400" : "text-gray-500"}`}>
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function CategoricalLegend({
  colorDef,
  palette,
  dark,
}: {
  colorDef: CategoricalColor;
  palette: string[];
  dark: boolean;
}) {
  const categories = colorDef.categories ?? [];
  if (categories.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {categories.map((cat, i) => (
        <div key={cat} className="flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ background: palette[i % palette.length] }}
          />
          <span className={`truncate ${dark ? "text-gray-300" : "text-gray-600"}`}>{cat}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Layer switcher                                                     */
/* ------------------------------------------------------------------ */

const LAYER_SUB_IDS = ["-fill", "-line", "-circle", "-heatmap", "-cluster", "-cluster-count", "-raster"];

function formatLayerLabel(id: string): string {
  return id
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function LayerSwitcher({
  layers,
  mapRef,
  dark,
  position = "top-right",
  controlsPosition,
}: {
  layers: Record<string, unknown>;
  mapRef: React.RefObject<maplibregl.Map | null>;
  dark: boolean;
  position?: string;
  controlsPosition?: string;
}) {
  const [open, setOpen] = useState(false);
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const id of Object.keys(layers)) init[id] = true;
    return init;
  });

  // Keep visibility in sync when layers change (new layers default to visible)
  useEffect(() => {
    setVisibility((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(layers)) {
        if (!(id in next)) next[id] = true;
      }
      // Remove stale keys
      for (const id of Object.keys(next)) {
        if (!(id in layers)) delete next[id];
      }
      return next;
    });
  }, [layers]);

  const toggleLayer = (id: string) => {
    const map = mapRef.current;
    if (!map) return;
    const newVisible = !visibility[id];
    setVisibility((prev) => ({ ...prev, [id]: newVisible }));

    const sourceId = `jm-${id}`;
    const value = newVisible ? "visible" : "none";
    for (const suffix of LAYER_SUB_IDS) {
      const layerId = `${sourceId}${suffix}`;
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", value);
      }
    }
  };

  const layerIds = Object.keys(layers);
  if (layerIds.length === 0) return null;

  const isTop = position.startsWith("top");
  const isRight = position.endsWith("right");

  // Offset when sharing a corner with main controls
  const sameCorner = controlsPosition === position;
  const offsetStyle: React.CSSProperties = sameCorner
    ? isRight ? { right: 40 } : { left: 40 }
    : {};
  const posClass = POSITION_CLASSES[position] ?? POSITION_CLASSES["top-right"];

  const cardClass = dark
    ? "rounded-md border border-white/10 bg-black/80 backdrop-blur-md shadow-lg"
    : "rounded-md border border-gray-200/60 bg-white/95 backdrop-blur-md shadow-lg";

  // Panel alignment: anchored to the same edge as the button
  const panelAlign = isRight ? "right-0" : "left-0";
  // Panel opens downward from top corners, upward from bottom corners
  const panelPosition = isTop ? "top-full mt-1.5" : "bottom-full mb-1.5";

  return (
    <div className={`absolute ${posClass} z-10`} style={offsetStyle}>
      <div className="relative">
        {/* Toggle button */}
        <button
          onClick={() => setOpen((o) => !o)}
          title="Toggle layers"
          className={`flex items-center justify-center w-[29px] h-[29px] rounded-md shadow-md cursor-pointer transition-colors duration-150 border ${
            dark
              ? "bg-[#1a1a1a] hover:bg-[#252525] text-gray-300 border-white/10"
              : "bg-white hover:bg-gray-100 text-gray-700 border-gray-200"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12,2 22,8.5 12,15 2,8.5" />
            <polyline points="2,15.5 12,22 22,15.5" />
          </svg>
        </button>

        {/* Dropdown panel — direction adapts to corner */}
        {open && (
          <div className={`absolute ${panelPosition} ${panelAlign} ${cardClass} min-w-[180px] overflow-hidden`}>
            {/* Header */}
            <div className={`flex items-center gap-2 px-3 py-2 ${dark ? "border-b border-white/10" : "border-b border-gray-200/60"}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? "#aaa" : "#888"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12,2 22,8.5 12,15 2,8.5" />
                <polyline points="2,15.5 12,22 22,15.5" />
              </svg>
              <span className={`text-xs font-semibold flex-1 ${dark ? "text-gray-200" : "text-gray-800"}`}>Layers</span>
              <button
                onClick={() => setOpen(false)}
                className={`flex items-center justify-center w-[18px] h-[18px] rounded cursor-pointer transition-colors ${dark ? "hover:bg-white/10" : "hover:bg-gray-200"}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill={dark ? "#aaa" : "#888"}>
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
            {/* Layer list */}
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {layerIds.map((id) => {
                const isVisible = visibility[id] !== false;
                return (
                  <button
                    key={id}
                    onClick={() => toggleLayer(id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer transition-colors ${
                      dark ? "hover:bg-white/8" : "hover:bg-gray-50"
                    } ${dark ? "border-b border-white/5" : "border-b border-gray-100"} last:border-b-0`}
                  >
                    <span className={`flex-1 truncate text-left ${
                      isVisible
                        ? (dark ? "text-gray-200" : "text-gray-800")
                        : (dark ? "text-gray-600" : "text-gray-400")
                    }`}>
                      {formatLayerLabel(id)}
                    </span>
                    {/* Eye icon */}
                    <span className={`shrink-0 transition-colors ${isVisible ? (dark ? "text-gray-400" : "text-gray-500") : (dark ? "text-gray-700" : "text-gray-300")}`}>
                      {isVisible ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
                        </svg>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Widget overlay                                                     */
/* ------------------------------------------------------------------ */

function MapWidget({ widget, dark }: { widget: WidgetSpec; dark: boolean }) {
  const position = widget.position ?? "top-left";
  const posClass = POSITION_CLASSES[position] ?? POSITION_CLASSES["top-left"];

  const cardClass = dark
    ? "rounded-lg border border-white/10 bg-black/80 backdrop-blur-md shadow-lg px-3 py-2.5"
    : "rounded-lg border border-gray-200/60 bg-white/95 backdrop-blur-md shadow-lg px-3 py-2.5";

  return (
    <div className={`absolute ${posClass} z-10`}>
      <div className={cardClass}>
        {widget.title && (
          <div className={`text-[10px] uppercase tracking-wider mb-0.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>
            {widget.title}
          </div>
        )}
        {widget.value && (
          <div className={`text-2xl font-semibold leading-tight ${dark ? "text-white" : "text-gray-900"}`}>
            {widget.value}
          </div>
        )}
        {widget.description && (
          <div className={`text-xs mt-0.5 ${dark ? "text-gray-400" : "text-gray-500"}`}>
            {widget.description}
          </div>
        )}
        {widget.rows && widget.rows.length > 0 && (
          <div className={`${widget.title || widget.value ? "mt-2 pt-2" : ""} ${widget.title || widget.value ? (dark ? "border-t border-white/10" : "border-t border-gray-200/60") : ""} space-y-1`}>
            {widget.rows.map((row, i) => (
              <div key={i} className="flex items-center justify-between gap-4 text-xs">
                <span className={dark ? "text-gray-400" : "text-gray-500"}>{row.label}</span>
                <span
                  className={`font-medium ${row.color ? "" : (dark ? "text-white" : "text-gray-900")}`}
                  style={row.color ? { color: row.color } : undefined}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Internal types                                                     */
/* ------------------------------------------------------------------ */

interface MarkerPortals {
  markerEl: HTMLDivElement;
  popupContainer?: HTMLDivElement;
  tooltipContainer?: HTMLDivElement;
  tooltipPopup?: maplibregl.Popup;
}

/* ------------------------------------------------------------------ */
/*  MapRenderer                                                        */
/* ------------------------------------------------------------------ */

export function MapRenderer({
  spec,
  components,
  children,
  routingProvider = defaultRoutingProvider,
  onViewportChange,
  onMarkerClick,
  onMarkerDragStart,
  onMarkerDrag,
  onMarkerDragEnd,
  onLayerClick,
}: MapRendererProps) {
  const Marker = components?.Marker ?? DefaultMarker;
  const Popup = components?.Popup ?? DefaultPopup;
  const Tooltip = components?.Tooltip ?? DefaultTooltip;
  const LayerTooltip = components?.LayerTooltip ?? DefaultLayerTooltip;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const portalsRef = useRef<Map<string, MarkerPortals>>(new Map());
  const [, setPortalVersion] = useState(0);

  // Callback refs — always current, avoids re-registering listeners
  const callbacksRef = useRef({ onViewportChange, onMarkerClick, onMarkerDragStart, onMarkerDrag, onMarkerDragEnd, onLayerClick });
  callbacksRef.current = { onViewportChange, onMarkerClick, onMarkerDragStart, onMarkerDrag, onMarkerDragEnd, onLayerClick };

  // Map load state for useMap hook
  const [isLoaded, setIsLoaded] = useState(false);

  // Flag to suppress onViewportChange during programmatic moves (flyTo, fitBounds)
  const internalMoveRef = useRef(false);

  // Layer tracking
  const pendingLayerSyncRef = useRef(false);
  const layerSpecsRef = useRef<Record<string, string>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerHandlersRef = useRef<Record<string, Array<{ event: string; layer: string; handler: any }>>>({});
  const pendingRouteFetchRef = useRef<Set<string>>(new Set());
  const layerTooltipPopupRef = useRef<maplibregl.Popup | null>(null);
  const layerTooltipContainerRef = useRef<HTMLDivElement | null>(null);
  const [layerTooltip, setLayerTooltip] = useState<LayerTooltipData | null>(
    null,
  );

  /* ---- Marker helpers ---- */

  function addMarker(map: maplibregl.Map, id: string, ms: MarkerSpec) {
    const color = ms.color || "#3b82f6";
    const hasIcon = !!ms.icon;

    const el = document.createElement("div");
    const baseSize = hasIcon ? 28 : 16;
    el.style.cssText = `width:${baseSize}px;height:${baseSize}px;cursor:pointer;overflow:visible;`;
    el.dataset.color = color;
    if (ms.icon) el.dataset.icon = ms.icon;

    const marker = new maplibregl.Marker({
      element: el,
      anchor: "center",
      draggable: ms.draggable ?? false,
    })
      .setLngLat(ms.coordinates)
      .addTo(map);

    // Marker click event
    el.addEventListener("click", () => {
      callbacksRef.current.onMarkerClick?.(id, ms.coordinates);
    });

    // Drag events (only if draggable)
    if (ms.draggable) {
      marker.on("dragstart", () => {
        const ll = marker.getLngLat();
        callbacksRef.current.onMarkerDragStart?.(id, [ll.lng, ll.lat]);
      });
      marker.on("drag", () => {
        const ll = marker.getLngLat();
        callbacksRef.current.onMarkerDrag?.(id, [ll.lng, ll.lat]);
      });
      marker.on("dragend", () => {
        const ll = marker.getLngLat();
        callbacksRef.current.onMarkerDragEnd?.(id, [ll.lng, ll.lat]);
      });
    }

    const portals: MarkerPortals = { markerEl: el };

    if (ms.popup) {
      const container = document.createElement("div");
      const popup = new maplibregl.Popup({
        offset: 16,
        closeButton: false,
        maxWidth: "none",
      }).setDOMContent(container);
      marker.setPopup(popup);
      portals.popupContainer = container;
    }

    if (ms.tooltip) {
      const container = document.createElement("div");
      const tooltipPopup = new maplibregl.Popup({
        offset: 16,
        closeButton: false,
        closeOnClick: false,
        maxWidth: "none",
      }).setDOMContent(container);

      el.addEventListener("mouseenter", () => {
        if (marker.getPopup()?.isOpen()) return;
        tooltipPopup.setLngLat(marker.getLngLat()).addTo(map);
      });
      el.addEventListener("mouseleave", () => {
        tooltipPopup.remove();
      });

      portals.tooltipContainer = container;
      portals.tooltipPopup = tooltipPopup;
    }

    markersRef.current.set(id, marker);
    portalsRef.current.set(id, portals);
  }

  function removeMarker(id: string) {
    markersRef.current.get(id)?.remove();
    markersRef.current.delete(id);
    portalsRef.current.get(id)?.tooltipPopup?.remove();
    portalsRef.current.delete(id);
  }

  /* ---- Layer helpers ---- */

  function addGeoJsonLayer(
    map: maplibregl.Map,
    id: string,
    layer: GeoJsonLayerSpec,
  ) {
    const sourceId = `jm-${id}`;

    try {
      const style = layer.style ?? {};
      const opacity = style.opacity ?? 0.8;
      const isClustered = layer.cluster === true;
      const clOpts = layer.clusterOptions ?? {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sourceOpts: any = {
        type: "geojson",
        data: layer.data as string | GeoJSON.GeoJSON,
      };
      if (isClustered) {
        sourceOpts.cluster = true;
        sourceOpts.clusterRadius = clOpts.radius ?? 50;
        sourceOpts.clusterMaxZoom = clOpts.maxZoom ?? 14;
        sourceOpts.clusterMinPoints = clOpts.minPoints ?? 2;
      }
      map.addSource(sourceId, sourceOpts);

      // Fill layer (polygons)
      const fillColor = colorValueToExpression(style.fillColor ?? "#3b82f6");
      map.addLayer({
        id: `${sourceId}-fill`,
        type: "fill",
        source: sourceId,
        filter: [
          "any",
          ["==", ["geometry-type"], "Polygon"],
          ["==", ["geometry-type"], "MultiPolygon"],
        ],
        paint: {
          "fill-color": fillColor,
          "fill-opacity": opacity,
        },
      });

      // Line layer (lines + polygon outlines)
      const lineColor = colorValueToExpression(style.lineColor ?? "#333333");
      map.addLayer({
        id: `${sourceId}-line`,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": lineColor,
          "line-width": style.lineWidth ?? 1,
          "line-opacity": Math.min(opacity + 0.1, 1),
        },
      });

      // Circle layer (points) — for non-clustered, or unclustered points in clustered mode
      const pointColor = colorValueToExpression(
        style.pointColor ?? style.fillColor ?? "#3b82f6",
      );
      const circleFilter = isClustered
        ? ["all", ["!", ["has", "point_count"]], ["any", ["==", ["geometry-type"], "Point"], ["==", ["geometry-type"], "MultiPoint"]]]
        : ["any", ["==", ["geometry-type"], "Point"], ["==", ["geometry-type"], "MultiPoint"]];
      map.addLayer({
        id: `${sourceId}-circle`,
        type: "circle",
        source: sourceId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filter: circleFilter as any,
        paint: {
          "circle-color": pointColor,
          "circle-radius": sizeValueToExpression(style.pointRadius ?? 5, 5),
          "circle-opacity": opacity,
          "circle-stroke-width": style.lineWidth ?? 1,
          "circle-stroke-color": lineColor,
        },
      });

      // Cluster layers
      if (isClustered) {
        const colors = clOpts.colors ?? ["#22c55e", "#eab308", "#ef4444"];
        map.addLayer({
          id: `${sourceId}-cluster`,
          type: "circle",
          source: sourceId,
          filter: ["has", "point_count"],
          paint: {
            "circle-color": ["step", ["get", "point_count"], colors[0], 100, colors[1], 750, colors[2]],
            "circle-radius": ["step", ["get", "point_count"], 20, 100, 30, 750, 40],
            "circle-stroke-width": 1,
            "circle-stroke-color": "#fff",
            "circle-opacity": 0.85,
          },
        });
        map.addLayer({
          id: `${sourceId}-cluster-count`,
          type: "symbol",
          source: sourceId,
          filter: ["has", "point_count"],
          layout: {
            "text-field": "{point_count_abbreviated}",
            "text-size": 12,
          },
          paint: { "text-color": "#fff" },
        });

        // Click cluster to zoom in
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const onClusterClick = async (e: any) => {
          const features = map.queryRenderedFeatures(e.point, { layers: [`${sourceId}-cluster`] });
          if (!features.length) return;
          const clusterId = features[0].properties?.cluster_id as number;
          const source = map.getSource(sourceId) as maplibregl.GeoJSONSource;
          const zoom = await source.getClusterExpansionZoom(clusterId);
          map.easeTo({ center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number], zoom });
        };
        map.on("click", `${sourceId}-cluster`, onClusterClick);
        map.on("mouseenter", `${sourceId}-cluster`, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", `${sourceId}-cluster`, () => { map.getCanvas().style.cursor = ""; });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const clusterHandlers: Array<{ event: string; layer: string; handler: any }> = [
          { event: "click", layer: `${sourceId}-cluster`, handler: onClusterClick },
        ];
        layerHandlersRef.current[`${sourceId}-cluster`] = clusterHandlers;
      }

      // Hover tooltip
      if (layer.tooltip && layer.tooltip.length > 0) {
        const isText = typeof layer.tooltip === "string";
        const columns: string[] = isText ? ["_text"] : layer.tooltip as string[];
        const subLayers = [
          `${sourceId}-fill`,
          `${sourceId}-circle`,
          `${sourceId}-line`,
        ];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handlers: Array<{ event: string; layer: string; handler: any }> = [];

        for (const subLayer of subLayers) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const onMove = (e: any) => {
            if (!e.features || e.features.length === 0) return;
            map.getCanvas().style.cursor = "pointer";
            if (isText) {
              setLayerTooltip({ properties: { _text: layer.tooltip as string }, columns });
            } else {
              const props = (e.features[0].properties ?? {}) as Record<string, unknown>;
              setLayerTooltip({ properties: props, columns });
            }

            const popup = layerTooltipPopupRef.current;
            if (popup) {
              popup.setLngLat(e.lngLat).addTo(map);
            }
          };
          const onLeave = () => {
            map.getCanvas().style.cursor = "";
            setLayerTooltip(null);
            layerTooltipPopupRef.current?.remove();
          };

          map.on("mousemove", subLayer, onMove);
          map.on("mouseleave", subLayer, onLeave);
          handlers.push({ event: "mousemove", layer: subLayer, handler: onMove });
          handlers.push({ event: "mouseleave", layer: subLayer, handler: onLeave });
        }

        layerHandlersRef.current[sourceId] = handlers;
      }

      // Click event (for onLayerClick callback) — on all sub-layers
      {
        const clickLayers = [
          `${sourceId}-fill`,
          `${sourceId}-circle`,
          `${sourceId}-line`,
        ];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const clickHandlers: Array<{ event: string; layer: string; handler: any }> = [];
        for (const subLayer of clickLayers) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const onClick = (e: any) => {
            callbacksRef.current.onLayerClick?.(id, [e.lngLat.lng, e.lngLat.lat]);
          };
          map.on("click", subLayer, onClick);
          clickHandlers.push({ event: "click", layer: subLayer, handler: onClick });
        }
        // Append to existing handlers (tooltip may have already set them)
        const existing = layerHandlersRef.current[sourceId] ?? [];
        layerHandlersRef.current[sourceId] = [...existing, ...clickHandlers];
      }
    } catch (err) {
      console.warn(`[json-maps] Failed to add layer "${id}":`, err);
      try { removeLayer(map, id); } catch { /* ignore */ }
    }
  }

  // Keep routing provider in a ref so async callbacks use the latest one
  const routingProviderRef = useRef(routingProvider);
  routingProviderRef.current = routingProvider;

  function renderRouteOnMap(
    map: maplibregl.Map,
    id: string,
    layer: RouteLayerSpec,
    coordinates: [number, number][],
  ) {
    const sourceId = `jm-${id}`;
    const style = layer.style ?? {};
    const geojsonData = {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates },
    };

    // If source already exists (e.g. OSRM resolved after re-sync), just update data
    const existing = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(geojsonData);
      return;
    }

    map.addSource(sourceId, {
      type: "geojson",
      data: geojsonData,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paint: any = {
      "line-color": style.color ?? "#3b82f6",
      "line-width": style.width ?? 3,
      "line-opacity": style.opacity ?? 0.8,
    };
    if (style.dashed) {
      paint["line-dasharray"] = [6, 3];
    }

    map.addLayer({
      id: `${sourceId}-line`,
      type: "line",
      source: sourceId,
      layout: { "line-join": "round", "line-cap": "round" },
      paint,
    });

    const lineLayerId = `${sourceId}-line`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers: Array<{ event: string; layer: string; handler: any }> = [];

    // Tooltip on hover
    if (layer.tooltip && layer.tooltip.length > 0) {
      const isText = typeof layer.tooltip === "string";
      const columns: string[] = isText ? ["_text"] : layer.tooltip as string[];
      const tooltipData: LayerTooltipData = isText
        ? { properties: { _text: layer.tooltip as string }, columns }
        : { properties: {}, columns }; // routes rarely have feature props
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onMove = (e: any) => {
        map.getCanvas().style.cursor = "pointer";
        setLayerTooltip(tooltipData);
        const popup = layerTooltipPopupRef.current;
        if (popup) popup.setLngLat(e.lngLat).addTo(map);
      };
      const onLeave = () => {
        map.getCanvas().style.cursor = "";
        setLayerTooltip(null);
        layerTooltipPopupRef.current?.remove();
      };
      map.on("mousemove", lineLayerId, onMove);
      map.on("mouseleave", lineLayerId, onLeave);
      handlers.push({ event: "mousemove", layer: lineLayerId, handler: onMove });
      handlers.push({ event: "mouseleave", layer: lineLayerId, handler: onLeave });
    }

    // Click event (for onLayerClick callback)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onClick = (e: any) => {
      callbacksRef.current.onLayerClick?.(id, [e.lngLat.lng, e.lngLat.lat]);
    };
    map.on("click", lineLayerId, onClick);
    handlers.push({ event: "click", layer: lineLayerId, handler: onClick });

    if (handlers.length > 0) {
      layerHandlersRef.current[sourceId] = handlers;
    }
  }

  function addHeatmapLayer(
    map: maplibregl.Map,
    id: string,
    layer: HeatmapLayerSpec,
  ) {
    const sourceId = `jm-${id}`;

    try {
      map.addSource(sourceId, {
        type: "geojson",
        data: layer.data as string | GeoJSON.GeoJSON,
      });

      // Build heatmap-color ramp from palette
      const palette = PALETTES[layer.palette ?? "OrYel"] ?? PALETTES["OrYel"];
      const steps = palette.length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const colorRamp: any[] = [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0, "rgba(0,0,0,0)",
      ];
      for (let i = 0; i < steps; i++) {
        colorRamp.push((i + 1) / steps);
        colorRamp.push(palette[i]);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const paint: Record<string, any> = {
        "heatmap-radius": layer.radius ?? 30,
        "heatmap-intensity": layer.intensity ?? 1,
        "heatmap-opacity": layer.opacity ?? 0.8,
        "heatmap-color": colorRamp,
      };

      // Data-driven weight from a feature property
      if (layer.weight) {
        paint["heatmap-weight"] = ["get", layer.weight];
      }

      map.addLayer({
        id: `${sourceId}-heatmap`,
        type: "heatmap",
        source: sourceId,
        paint,
      });
    } catch (err) {
      console.warn(`[json-maps] Failed to add heatmap "${id}":`, err);
      try { removeLayer(map, id); } catch { /* ignore */ }
    }
  }

  function addVectorTileLayer(
    map: maplibregl.Map,
    id: string,
    layer: VectorTileLayerSpec,
  ) {
    const sourceId = `jm-${id}`;

    try {
      const style = layer.style ?? {};
      const opacity = style.opacity ?? 0.8;
      const isTileTemplate = layer.url.includes("{z}") || layer.url.includes("{x}");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sourceOpts: any = { type: "vector" };
      if (isTileTemplate) {
        sourceOpts.tiles = [layer.url];
      } else {
        sourceOpts.url = layer.url;
      }
      if (layer.minzoom != null) sourceOpts.minzoom = layer.minzoom;
      if (layer.maxzoom != null) sourceOpts.maxzoom = layer.maxzoom;

      map.addSource(sourceId, sourceOpts);

      // Shared layer options (without filter — each sub-layer adds geometry-type filter)
      const baseOpts = {
        source: sourceId,
        "source-layer": layer.sourceLayer,
        ...(layer.minzoom != null ? { minzoom: layer.minzoom } : {}),
        ...(layer.maxzoom != null ? { maxzoom: layer.maxzoom } : {}),
      };

      // Helper: combine user filter with geometry-type filter
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const withGeomFilter = (geomFilter: any[]) => {
        if (layer.filter) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return ["all", layer.filter as any, geomFilter];
        }
        return geomFilter;
      };

      // Fill sub-layer (polygons only)
      const fillColor = colorValueToExpression(style.fillColor ?? "#3b82f6");
      map.addLayer({
        id: `${sourceId}-fill`,
        type: "fill",
        ...baseOpts,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filter: withGeomFilter(["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "MultiPolygon"]]) as any,
        paint: {
          "fill-color": fillColor,
          "fill-opacity": opacity,
        },
      });

      // Line sub-layer (lines + polygon outlines)
      const lineColor = colorValueToExpression(style.lineColor ?? "#333333");
      map.addLayer({
        id: `${sourceId}-line`,
        type: "line",
        ...baseOpts,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(layer.filter ? { filter: layer.filter as any } : {}),
        paint: {
          "line-color": lineColor,
          "line-width": style.lineWidth ?? 1,
          "line-opacity": Math.min(opacity + 0.1, 1),
        },
      });

      // Circle sub-layer (points only — not polygon vertices)
      const pointColor = colorValueToExpression(
        style.pointColor ?? style.fillColor ?? "#3b82f6",
      );
      map.addLayer({
        id: `${sourceId}-circle`,
        type: "circle",
        ...baseOpts,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filter: withGeomFilter(["any", ["==", ["geometry-type"], "Point"], ["==", ["geometry-type"], "MultiPoint"]]) as any,
        paint: {
          "circle-color": pointColor,
          "circle-radius": sizeValueToExpression(style.pointRadius ?? 5, 5),
          "circle-opacity": opacity,
          "circle-stroke-width": style.lineWidth ?? 1,
          "circle-stroke-color": lineColor,
        },
      });

      // Tooltip (same pattern as GeoJSON)
      if (layer.tooltip && layer.tooltip.length > 0) {
        const isText = typeof layer.tooltip === "string";
        const columns: string[] = isText ? ["_text"] : layer.tooltip as string[];
        const subLayers = [`${sourceId}-fill`, `${sourceId}-circle`, `${sourceId}-line`];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handlers: Array<{ event: string; layer: string; handler: any }> = [];

        for (const subLayer of subLayers) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const onMove = (e: any) => {
            if (!e.features || e.features.length === 0) return;
            map.getCanvas().style.cursor = "pointer";
            if (isText) {
              setLayerTooltip({ properties: { _text: layer.tooltip as string }, columns });
            } else {
              const props = (e.features[0].properties ?? {}) as Record<string, unknown>;
              setLayerTooltip({ properties: props, columns });
            }
            const popup = layerTooltipPopupRef.current;
            if (popup) popup.setLngLat(e.lngLat).addTo(map);
          };
          const onLeave = () => {
            map.getCanvas().style.cursor = "";
            setLayerTooltip(null);
            layerTooltipPopupRef.current?.remove();
          };
          map.on("mousemove", subLayer, onMove);
          map.on("mouseleave", subLayer, onLeave);
          handlers.push({ event: "mousemove", layer: subLayer, handler: onMove });
          handlers.push({ event: "mouseleave", layer: subLayer, handler: onLeave });
        }
        layerHandlersRef.current[sourceId] = handlers;
      }

      // Click event (onLayerClick)
      {
        const clickLayers = [`${sourceId}-fill`, `${sourceId}-circle`, `${sourceId}-line`];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const clickHandlers: Array<{ event: string; layer: string; handler: any }> = [];
        for (const subLayer of clickLayers) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const onClick = (e: any) => {
            callbacksRef.current.onLayerClick?.(id, [e.lngLat.lng, e.lngLat.lat]);
          };
          map.on("click", subLayer, onClick);
          clickHandlers.push({ event: "click", layer: subLayer, handler: onClick });
        }
        const existing = layerHandlersRef.current[sourceId] ?? [];
        layerHandlersRef.current[sourceId] = [...existing, ...clickHandlers];
      }
    } catch (err) {
      console.warn(`[json-maps] Failed to add vector tile layer "${id}":`, err);
      try { removeLayer(map, id); } catch { /* ignore */ }
    }
  }

  function addRasterTileLayer(
    map: maplibregl.Map,
    id: string,
    layer: RasterTileLayerSpec,
  ) {
    const sourceId = `jm-${id}`;

    try {
      const isTileTemplate = layer.url.includes("{z}") || layer.url.includes("{x}");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sourceOpts: any = {
        type: "raster",
        tileSize: layer.tileSize ?? 256,
      };
      if (isTileTemplate) {
        sourceOpts.tiles = [layer.url];
      } else {
        sourceOpts.url = layer.url;
      }
      if (layer.minzoom != null) sourceOpts.minzoom = layer.minzoom;
      if (layer.maxzoom != null) sourceOpts.maxzoom = layer.maxzoom;
      if (layer.attribution) sourceOpts.attribution = layer.attribution;

      map.addSource(sourceId, sourceOpts);

      map.addLayer({
        id: `${sourceId}-raster`,
        type: "raster",
        source: sourceId,
        paint: {
          "raster-opacity": layer.opacity ?? 0.8,
        },
      });
    } catch (err) {
      console.warn(`[json-maps] Failed to add raster tile layer "${id}":`, err);
      try { removeLayer(map, id); } catch { /* ignore */ }
    }
  }

  function addRouteLayer(
    map: maplibregl.Map,
    id: string,
    layer: RouteLayerSpec,
  ) {
    try {
      if (layer.from && layer.to) {
        // Routing provider — fetch then render
        pendingRouteFetchRef.current.add(id);
        routingProviderRef.current({
          from: layer.from,
          to: layer.to,
          waypoints: layer.waypoints,
          profile: layer.profile,
        })
          .then((coords: [number, number][]) => {
            pendingRouteFetchRef.current.delete(id);
            // Check map still exists (not unmounted during fetch)
            if (!mapRef.current) return;
            renderRouteOnMap(map, id, layer, coords);
          })
          .catch((err: unknown) => {
            pendingRouteFetchRef.current.delete(id);
            console.warn(`[json-maps] Routing failed for "${id}", falling back to straight line:`, err);
            if (!mapRef.current) return;
            // Fallback: straight line between from/to
            const fallback = [layer.from!, ...(layer.waypoints ?? []), layer.to!];
            renderRouteOnMap(map, id, layer, fallback);
          });
      } else if (layer.coordinates) {
        renderRouteOnMap(map, id, layer, layer.coordinates);
      }
    } catch (err) {
      console.warn(`[json-maps] Failed to add route "${id}":`, err);
      try { removeLayer(map, id); } catch { /* ignore */ }
    }
  }

  function removeLayer(map: maplibregl.Map, id: string) {
    const sourceId = `jm-${id}`;

    // Remove event listeners
    for (const key of [sourceId, `${sourceId}-cluster`]) {
      const handlers = layerHandlersRef.current[key];
      if (handlers) {
        for (const h of handlers) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (map as any).off(h.event, h.layer, h.handler);
        }
        delete layerHandlersRef.current[key];
      }
    }

    const subLayers = [
      `${sourceId}-cluster-count`,
      `${sourceId}-cluster`,
      `${sourceId}-circle`,
      `${sourceId}-line`,
      `${sourceId}-fill`,
      `${sourceId}-heatmap`,
      `${sourceId}-raster`,
    ];
    for (const layerId of subLayers) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    }
    if (map.getSource(sourceId)) {
      try { map.removeSource(sourceId); } catch { /* layer still attached — safe to ignore, will be cleaned up */ }
    }
  }

  /* ---- Sync functions ---- */

  const syncMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const specMarkers = spec.markers ?? {};

    for (const id of [...markersRef.current.keys()]) {
      if (!specMarkers[id]) removeMarker(id);
    }

    for (const [id, ms] of Object.entries(specMarkers)) {
      const existing = markersRef.current.get(id);

      if (existing) {
        existing.setLngLat(ms.coordinates);
        const el = existing.getElement();
        if (el.dataset.color !== (ms.color ?? "") || el.dataset.icon !== (ms.icon ?? "")) {
          removeMarker(id);
          addMarker(map, id, ms);
        }
      } else {
        addMarker(map, id, ms);
      }
    }

    setPortalVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.markers]);

  const syncLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!map.isStyleLoaded()) {
      // Style not ready — poll via rAF until it is (one loop at a time)
      if (!pendingLayerSyncRef.current) {
        pendingLayerSyncRef.current = true;
        const check = () => {
          if (!mapRef.current || !pendingLayerSyncRef.current) return;
          if (mapRef.current.isStyleLoaded()) {
            pendingLayerSyncRef.current = false;
            syncLayersRef.current();
          } else {
            requestAnimationFrame(check);
          }
        };
        requestAnimationFrame(check);
      }
      return;
    }

    pendingLayerSyncRef.current = false;

    const specLayers = spec.layers ?? {};
    const prevSpecs = layerSpecsRef.current;

    // Remove layers no longer in spec
    for (const id of Object.keys(prevSpecs)) {
      if (!specLayers[id]) {
        removeLayer(map, id);
        delete prevSpecs[id];
      }
    }

    // Add or update layers
    for (const [id, layerSpec] of Object.entries(specLayers)) {
      const serialized = JSON.stringify(layerSpec);
      const sourceExists = !!map.getSource(`jm-${id}`);

      // Skip if spec unchanged and source exists (or OSRM fetch is in-flight)
      if (prevSpecs[id] === serialized && (sourceExists || pendingRouteFetchRef.current.has(id))) continue;

      if (sourceExists) {
        removeLayer(map, id);
      }

      if (layerSpec.type === "route") {
        addRouteLayer(map, id, layerSpec);
      } else if (layerSpec.type === "heatmap") {
        addHeatmapLayer(map, id, layerSpec);
      } else if (layerSpec.type === "mvt") {
        addVectorTileLayer(map, id, layerSpec);
      } else if (layerSpec.type === "raster") {
        addRasterTileLayer(map, id, layerSpec);
      } else {
        addGeoJsonLayer(map, id, layerSpec);
      }
      prevSpecs[id] = serialized;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.layers]);

  // Refs so basemap effect can call latest sync without re-triggering setStyle
  const syncMarkersRef = useRef(syncMarkers);
  const syncLayersRef = useRef(syncLayers);
  useEffect(() => { syncMarkersRef.current = syncMarkers; }, [syncMarkers]);
  useEffect(() => { syncLayersRef.current = syncLayers; }, [syncLayers]);

  /* ---- Effects ---- */

  // Create map once
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: resolveBasemapStyle(spec.basemap) ?? resolveBasemapStyle()!,
      center: spec.center ?? DEFAULT_CENTER,
      zoom: spec.zoom ?? DEFAULT_ZOOM,
      pitch: spec.pitch ?? 0,
      bearing: spec.bearing ?? 0,
      attributionControl: false,
    });

    // Apply globe projection if specified
    if (spec.projection === "globe") {
      map.setProjection({ type: "globe" });
    }

    // Inject CSS to strip default MapLibre popup chrome
    const styleEl = document.createElement("style");
    styleEl.textContent = `.maplibregl-popup-content{background:transparent!important;box-shadow:none!important;padding:0!important;border-radius:0!important}.maplibregl-popup-tip{display:none!important}`;
    containerRef.current.appendChild(styleEl);

    // Viewport change callback — fires on user-initiated moves only
    map.on("moveend", () => {
      if (internalMoveRef.current) return;
      const c = map.getCenter();
      callbacksRef.current.onViewportChange?.({
        center: [c.lng, c.lat],
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      });
    });

    // Sync layers after initial style load (addSource/addLayer need style ready)
    map.on("load", () => {
      setIsLoaded(true);
      if (spec.bounds) {
        map.fitBounds(spec.bounds as [number, number, number, number], {
          padding: 40,
          duration: 0,
        });
      } else if (!spec.center && spec.zoom == null && spec.markers) {
        // Auto-fit to markers only when no explicit viewport is set
        const markers = Object.values(spec.markers);
        if (markers.length > 0) {
          const lngs = markers.map((m) => m.coordinates[0]);
          const lats = markers.map((m) => m.coordinates[1]);
          let west = Math.min(...lngs);
          let south = Math.min(...lats);
          let east = Math.max(...lngs);
          let north = Math.max(...lats);
          const MIN_SPAN = 0.01; // ~1km
          if (east - west < MIN_SPAN) {
            const mid = (west + east) / 2;
            west = mid - MIN_SPAN / 2;
            east = mid + MIN_SPAN / 2;
          }
          if (north - south < MIN_SPAN) {
            const mid = (north + south) / 2;
            south = mid - MIN_SPAN / 2;
            north = mid + MIN_SPAN / 2;
          }
          map.fitBounds([west, south, east, north], {
            padding: { top: 100, bottom: 100, left: 100, right: 100 },
            maxZoom: 15,
            duration: 0,
          });
        }
      }
      syncLayersRef.current();
    });

    // Create layer tooltip popup (reused for all layers)
    const tooltipContainer = document.createElement("div");
    const tooltipPopup = new maplibregl.Popup({
      offset: 12,
      closeButton: false,
      closeOnClick: false,
      maxWidth: "none",
    }).setDOMContent(tooltipContainer);

    layerTooltipContainerRef.current = tooltipContainer;
    layerTooltipPopupRef.current = tooltipPopup;

    mapRef.current = map;

    return () => {
      for (const id of markersRef.current.keys()) removeMarker(id);
      markersRef.current.clear();
      portalsRef.current.clear();
      tooltipPopup.remove();
      layerTooltipPopupRef.current = null;
      layerTooltipContainerRef.current = null;
      layerSpecsRef.current = {};
      styleEl.remove();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track basemap to skip redundant setStyle on mount
  const prevBasemapRef = useRef(spec.basemap);

  // Update basemap — only when basemap actually changes (uses refs for sync callbacks)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Skip on mount — init effect already set the style
    if (prevBasemapRef.current === spec.basemap) return;
    prevBasemapRef.current = spec.basemap;
    const style = resolveBasemapStyle(spec.basemap);
    if (style) {
      map.setStyle(style);
      map.once("styledata", () => {
        syncMarkersRef.current();
        syncLayersRef.current();
      });
    }
  }, [spec.basemap]);

  // Update viewport
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Suppress onViewportChange for programmatic moves
    internalMoveRef.current = true;
    const resetFlag = () => { internalMoveRef.current = false; };

    if (spec.bounds) {
      map.fitBounds(
        spec.bounds as [number, number, number, number],
        { padding: 40 },
      );
      map.once("moveend", resetFlag);
      return;
    }

    map.flyTo({
      center: spec.center ?? DEFAULT_CENTER,
      zoom: spec.zoom ?? DEFAULT_ZOOM,
      pitch: spec.pitch ?? 0,
      bearing: spec.bearing ?? 0,
    });
    map.once("moveend", resetFlag);
  }, [spec.center, spec.zoom, spec.pitch, spec.bearing, spec.bounds]);

  // Update projection reactively (skip on mount — init effect handles it)
  const prevProjectionRef = useRef(spec.projection);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (prevProjectionRef.current === spec.projection) return;
    prevProjectionRef.current = spec.projection;
    const apply = () => {
      map.setProjection({ type: spec.projection === "globe" ? "globe" : "mercator" });
    };
    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once("styledata", apply);
    }
  }, [spec.projection]);

  // Sync markers
  useEffect(() => {
    syncMarkers();
  }, [syncMarkers]);

  // Sync layers (syncLayers internally polls if style isn't ready yet)
  useEffect(() => {
    syncLayers();
  }, [syncLayers]);

  /* ---- Render portals ---- */

  const entries = Array.from(portalsRef.current.entries());
  const contextValue = useMemo(() => ({ map: mapRef.current, isLoaded }), [isLoaded]);

  return (
    <MapContext.Provider value={contextValue}>
      <div ref={containerRef} className="relative w-full h-full">
        {spec.controls && (
          <MapControls
            controls={spec.controls}
            mapRef={mapRef}
            containerRef={containerRef}
            dark={spec.basemap === "dark"}
          />
        )}
        {spec.controls?.basemapSwitcher && (
          <BasemapSwitcher
            activeBasemap={spec.basemap || "light"}
            mapRef={mapRef}
            syncMarkersRef={syncMarkersRef}
            syncLayersRef={syncLayersRef}
            dark={spec.basemap === "dark"}
          />
        )}
        {spec.controls?.search && (
          <MapSearch mapRef={mapRef} dark={spec.basemap === "dark"} />
        )}
        {spec.controls?.layerSwitcher && spec.layers && Object.keys(spec.layers).length > 0 && (
          <LayerSwitcher
            layers={spec.layers}
            mapRef={mapRef}
            dark={spec.basemap === "dark"}
            position={
              typeof spec.controls.layerSwitcher === "object"
                ? spec.controls.layerSwitcher.position ?? spec.controls.position ?? "top-right"
                : spec.controls.position ?? "top-right"
            }
            controlsPosition={spec.controls.position ?? "top-right"}
          />
        )}
        {spec.legend &&
          Object.entries(spec.legend).map(([id, leg]) => {
            const layer = spec.layers?.[leg.layer];
            const geoLayer = layer && layer.type === "geojson" ? layer : null;
            return (
              <MapLegend key={id} legendSpec={leg} layerSpec={geoLayer} dark={spec.basemap === "dark"} />
            );
          })}
        {spec.widgets &&
          Object.entries(spec.widgets).map(([id, widget]) => (
            <MapWidget key={id} widget={widget} dark={spec.basemap === "dark"} />
          ))}
        {children}
      </div>
      {/* Marker portals */}
      {entries.map(([id, p]) => {
        const ms = spec.markers?.[id];
        if (!ms) return null;
        return (
          <Fragment key={id}>
            {createPortal(
              <Marker id={id} marker={ms} color={ms.color || "#3b82f6"} />,
              p.markerEl,
            )}
            {p.popupContainer &&
              ms.popup &&
              createPortal(
                <Popup id={id} marker={ms} />,
                p.popupContainer,
              )}
            {p.tooltipContainer &&
              ms.tooltip &&
              createPortal(
                <Tooltip id={id} text={ms.tooltip} />,
                p.tooltipContainer,
              )}
          </Fragment>
        );
      })}
      {/* Layer tooltip portal */}
      {layerTooltipContainerRef.current &&
        layerTooltip &&
        createPortal(
          <LayerTooltip
            properties={layerTooltip.properties}
            columns={layerTooltip.columns}
          />,
          layerTooltipContainerRef.current,
        )}
    </MapContext.Provider>
  );
}
