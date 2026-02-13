"use client";

import { Fragment, useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  type MapSpec,
  type MarkerSpec,
  type GeoJsonLayerSpec,
  type RouteLayerSpec,
  type ControlsSpec,
  type LegendSpec,
  type ColorValue,
  type ContinuousColor,
  type CategoricalColor,
  type SizeValue,
  resolveBasemapStyle,
} from "@/lib/spec";
import { PALETTES } from "@/lib/palettes";
import { DynamicIcon } from "lucide-react/dynamic";

const DEFAULT_CENTER: [number, number] = [0, 20];
const DEFAULT_ZOOM = 1.5;

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

function MarkerDot({ color, icon, label }: { color: string; icon?: string; label?: string }) {
  return (
    <>
      {icon ? (
        <div
          className="flex items-center justify-center w-7 h-7 rounded-full border-2 border-white shadow-lg transition-transform duration-150 hover:scale-[1.15]"
          style={{ background: color }}
        >
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <DynamicIcon name={icon as any} size={16} color="#ffffff" strokeWidth={2.5} />
        </div>
      ) : (
        <div
          className="h-4 w-4 rounded-full border-2 border-white shadow-lg transition-transform duration-150 hover:scale-[1.3]"
          style={{ background: color }}
        />
      )}
      {label && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap text-[10px] font-medium pointer-events-none"
          style={{
            textShadow:
              "0 0 4px rgba(255,255,255,0.9), 0 0 4px rgba(255,255,255,0.9)",
          }}
        >
          {label}
        </div>
      )}
    </>
  );
}

function PopupContent({ markerSpec }: { markerSpec: MarkerSpec }) {
  const popup = markerSpec.popup;
  if (!popup) return null;

  const isRich = typeof popup === "object";
  const title = isRich ? popup.title : markerSpec.label;
  const description = isRich ? popup.description : popup;
  const image = isRich ? popup.image : undefined;

  return (
    <div className="relative rounded-md border border-border bg-popover text-popover-foreground shadow-md overflow-hidden max-w-[260px]">
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

function TooltipContent({ text }: { text: string }) {
  return (
    <div className="rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md whitespace-nowrap">
      {text}
    </div>
  );
}

interface LayerTooltipData {
  properties: Record<string, unknown>;
  columns: string[];
}

function LayerTooltipContent({ properties, columns }: LayerTooltipData) {
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
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center w-[29px] h-[29px] bg-white hover:bg-gray-100 text-gray-700 border-0 cursor-pointer transition-colors duration-150"
    >
      {children}
    </button>
  );
}

function MapControls({
  controls,
  mapRef,
  containerRef,
}: {
  controls: ControlsSpec;
  mapRef: React.RefObject<maplibregl.Map | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
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

  return (
    <div className={`absolute ${posClass} z-10 flex flex-col gap-1.5`}>
      {/* Zoom controls */}
      {showZoom && (
        <div className="rounded-md overflow-hidden shadow-md divide-y divide-gray-200 border border-gray-200">
          <ControlButton
            onClick={() => mapRef.current?.zoomIn()}
            title="Zoom in"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="7" y1="2" x2="7" y2="12" />
              <line x1="2" y1="7" x2="12" y2="7" />
            </svg>
          </ControlButton>
          <ControlButton
            onClick={() => mapRef.current?.zoomOut()}
            title="Zoom out"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="2" y1="7" x2="12" y2="7" />
            </svg>
          </ControlButton>
        </div>
      )}

      {/* Compass */}
      {showCompass && (
        <div className="rounded-md overflow-hidden shadow-md border border-gray-200">
          <ControlButton
            onClick={() => mapRef.current?.easeTo({ bearing: 0, pitch: 0 })}
            title="Reset bearing"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              style={{ transform: `rotate(${-bearing}deg)`, transition: "transform 0.2s" }}
            >
              <polygon points="7,1 9,7 7,6 5,7" fill="#e74c3c" />
              <polygon points="7,13 5,7 7,8 9,7" fill="#94a3b8" />
            </svg>
          </ControlButton>
        </div>
      )}

      {/* Locate */}
      {controls.locate && (
        <div className="rounded-md overflow-hidden shadow-md border border-gray-200">
          <ControlButton
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
        <div className="rounded-md overflow-hidden shadow-md border border-gray-200">
          <ControlButton
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

export function MapRenderer({ spec }: { spec: MapSpec }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const portalsRef = useRef<Map<string, MarkerPortals>>(new Map());
  const [, setPortalVersion] = useState(0);

  // Layer tracking
  const pendingLayerSyncRef = useRef(false);
  const layerSpecsRef = useRef<Record<string, string>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerHandlersRef = useRef<Record<string, Array<{ event: string; layer: string; handler: any }>>>({});
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
    el.style.cssText = hasIcon
      ? "width:28px;height:28px;cursor:pointer;"
      : "width:16px;height:16px;cursor:pointer;";
    el.dataset.color = color;
    if (ms.icon) el.dataset.icon = ms.icon;

    const marker = new maplibregl.Marker({
      element: el,
      anchor: "center",
      draggable: ms.draggable ?? false,
    })
      .setLngLat(ms.coordinates)
      .addTo(map);

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
        tooltipPopup.setLngLat(ms.coordinates).addTo(map);
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
        const columns = layer.tooltip;
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
            const props = (e.features[0].properties ?? {}) as Record<
              string,
              unknown
            >;
            map.getCanvas().style.cursor = "pointer";
            setLayerTooltip({ properties: props, columns });

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
    } catch (err) {
      console.warn(`[json-maps] Failed to add layer "${id}":`, err);
      try { removeLayer(map, id); } catch { /* ignore */ }
    }
  }

  function addRouteLayer(
    map: maplibregl.Map,
    id: string,
    layer: RouteLayerSpec,
  ) {
    const sourceId = `jm-${id}`;

    try {
      const style = layer.style ?? {};

      map.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: layer.coordinates },
        },
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
    ];
    for (const layerId of subLayers) {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    }
    if (map.getSource(sourceId)) map.removeSource(sourceId);
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

      if (prevSpecs[id] === serialized && sourceExists) continue;

      if (sourceExists) {
        removeLayer(map, id);
      }

      if (layerSpec.type === "route") {
        addRouteLayer(map, id, layerSpec);
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

    // Sync layers after initial style load (addSource/addLayer need style ready)
    map.on("load", () => {
      if (spec.bounds) {
        map.fitBounds(spec.bounds as [number, number, number, number], {
          padding: 40,
          duration: 0,
        });
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
    if (!mapRef.current) return;

    if (spec.bounds) {
      mapRef.current.fitBounds(
        spec.bounds as [number, number, number, number],
        { padding: 40 },
      );
      return;
    }

    if (spec.center) {
      mapRef.current.flyTo({
        center: spec.center,
        zoom: spec.zoom ?? DEFAULT_ZOOM,
        pitch: spec.pitch ?? 0,
        bearing: spec.bearing ?? 0,
      });
      return;
    }

    // Auto-fit to markers when no explicit viewport is set
    const markers = spec.markers ? Object.values(spec.markers) : [];
    if (markers.length > 0) {
      const lngs = markers.map((m) => m.coordinates[0]);
      const lats = markers.map((m) => m.coordinates[1]);
      const bounds: [number, number, number, number] = [
        Math.min(...lngs), Math.min(...lats),
        Math.max(...lngs), Math.max(...lats),
      ];
      mapRef.current.fitBounds(bounds, {
        padding: 80,
        maxZoom: 14,
      });
      return;
    }

    mapRef.current.flyTo({
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: spec.pitch ?? 0,
      bearing: spec.bearing ?? 0,
    });
  }, [spec.center, spec.zoom, spec.pitch, spec.bearing, spec.bounds, spec.markers]);

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

  return (
    <>
      <div ref={containerRef} className="relative w-full h-full">
        {spec.controls && (
          <MapControls
            controls={spec.controls}
            mapRef={mapRef}
            containerRef={containerRef}
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
      </div>
      {/* Marker portals */}
      {entries.map(([id, p]) => {
        const ms = spec.markers?.[id];
        if (!ms) return null;
        return (
          <Fragment key={id}>
            {createPortal(
              <MarkerDot color={ms.color || "#3b82f6"} icon={ms.icon} label={ms.label} />,
              p.markerEl,
            )}
            {p.popupContainer &&
              ms.popup &&
              createPortal(
                <PopupContent markerSpec={ms} />,
                p.popupContainer,
              )}
            {p.tooltipContainer &&
              ms.tooltip &&
              createPortal(
                <TooltipContent text={ms.tooltip} />,
                p.tooltipContainer,
              )}
          </Fragment>
        );
      })}
      {/* Layer tooltip portal */}
      {layerTooltipContainerRef.current &&
        layerTooltip &&
        createPortal(
          <LayerTooltipContent
            properties={layerTooltip.properties}
            columns={layerTooltip.columns}
          />,
          layerTooltipContainerRef.current,
        )}
    </>
  );
}
