"use client";

import { Fragment, useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  type MapSpec,
  type MarkerSpec,
  type LayerSpec,
  type ColorValue,
  type SizeValue,
  resolveBasemapStyle,
} from "@/lib/spec";
import { PALETTES } from "@/lib/palettes";

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

function MarkerDot({ color, label }: { color: string; label?: string }) {
  return (
    <>
      <div
        className="h-4 w-4 rounded-full border-2 border-white shadow-lg transition-transform duration-150 hover:scale-[1.3]"
        style={{ background: color }}
      />
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

    const el = document.createElement("div");
    el.style.cssText = "width:16px;height:16px;cursor:pointer;";
    el.dataset.color = color;

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
    layer: LayerSpec,
  ) {
    const sourceId = `jm-${id}`;

    try {
      const style = layer.style ?? {};
      const opacity = style.opacity ?? 0.8;

      map.addSource(sourceId, {
        type: "geojson",
        data: layer.data as string | GeoJSON.GeoJSON,
      });

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

      // Circle layer (points)
      const pointColor = colorValueToExpression(
        style.pointColor ?? style.fillColor ?? "#3b82f6",
      );
      map.addLayer({
        id: `${sourceId}-circle`,
        type: "circle",
        source: sourceId,
        filter: [
          "any",
          ["==", ["geometry-type"], "Point"],
          ["==", ["geometry-type"], "MultiPoint"],
        ],
        paint: {
          "circle-color": pointColor,
          "circle-radius": sizeValueToExpression(style.pointRadius ?? 5, 5),
          "circle-opacity": opacity,
          "circle-stroke-width": style.lineWidth ?? 1,
          "circle-stroke-color": lineColor,
        },
      });

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
      // Clean up partial state if source was added but layers failed
      try { removeGeoJsonLayer(map, id); } catch { /* ignore */ }
    }
  }

  function removeGeoJsonLayer(map: maplibregl.Map, id: string) {
    const sourceId = `jm-${id}`;

    // Remove event listeners first
    const handlers = layerHandlersRef.current[sourceId];
    if (handlers) {
      for (const h of handlers) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (map as any).off(h.event, h.layer, h.handler);
      }
      delete layerHandlersRef.current[sourceId];
    }

    const subLayers = [
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
        if (existing.getElement().dataset.color !== (ms.color ?? "")) {
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
        removeGeoJsonLayer(map, id);
        delete prevSpecs[id];
      }
    }

    // Add or update layers
    for (const [id, layerSpec] of Object.entries(specLayers)) {
      const serialized = JSON.stringify(layerSpec);
      const sourceExists = !!map.getSource(`jm-${id}`);

      if (prevSpecs[id] === serialized && sourceExists) continue;

      if (sourceExists) {
        removeGeoJsonLayer(map, id);
      }

      addGeoJsonLayer(map, id, layerSpec);
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

    mapRef.current.flyTo({
      center: spec.center ?? DEFAULT_CENTER,
      zoom: spec.zoom ?? DEFAULT_ZOOM,
      pitch: spec.pitch ?? 0,
      bearing: spec.bearing ?? 0,
    });
  }, [spec.center, spec.zoom, spec.pitch, spec.bearing, spec.bounds]);

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
      <div ref={containerRef} className="w-full h-full" />
      {/* Marker portals */}
      {entries.map(([id, p]) => {
        const ms = spec.markers?.[id];
        if (!ms) return null;
        return (
          <Fragment key={id}>
            {createPortal(
              <MarkerDot color={ms.color || "#3b82f6"} label={ms.label} />,
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
