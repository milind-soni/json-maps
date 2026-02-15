"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type maplibregl from "maplibre-gl";
import type { ControlsSpec } from "@/lib/spec";
import { resolveBasemapStyle } from "@/lib/spec";
import { POSITION_CLASSES, LAYER_SUB_IDS } from "./utils";

/* ------------------------------------------------------------------ */
/*  Control button                                                     */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Map controls (zoom, compass, locate, fullscreen)                   */
/* ------------------------------------------------------------------ */

export function MapControls({
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

export function BasemapSwitcher({
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

export function MapSearch({ mapRef, dark }: { mapRef: React.RefObject<maplibregl.Map | null>; dark: boolean }) {
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
/*  Layer switcher                                                     */
/* ------------------------------------------------------------------ */

function formatLayerLabel(id: string): string {
  return id
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LayerSwitcher({
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
