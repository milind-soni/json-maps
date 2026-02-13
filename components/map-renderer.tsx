"use client";

import { Fragment, useEffect, useRef, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  type MapSpec,
  type MarkerSpec,
  resolveBasemapStyle,
} from "@/lib/spec";

const DEFAULT_CENTER: [number, number] = [0, 20];
const DEFAULT_ZOOM = 1.5;

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

  function addMarker(map: maplibregl.Map, id: string, ms: MarkerSpec) {
    const color = ms.color || "#3b82f6";

    // 16×16 anchor box — MapLibre uses this for positioning
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

    // Click popup
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

    // Hover tooltip
    if (ms.tooltip) {
      const container = document.createElement("div");
      const tooltipPopup = new maplibregl.Popup({
        offset: 16,
        closeButton: false,
        closeOnClick: false,
        maxWidth: "none",
      }).setDOMContent(container);

      el.addEventListener("mouseenter", () => {
        // Don't show tooltip if popup is already open
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

  const syncMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const specMarkers = spec.markers ?? {};

    // Remove markers no longer in spec
    for (const id of [...markersRef.current.keys()]) {
      if (!specMarkers[id]) removeMarker(id);
    }

    // Add or update
    for (const [id, ms] of Object.entries(specMarkers)) {
      const existing = markersRef.current.get(id);

      if (existing) {
        existing.setLngLat(ms.coordinates);
        // Recreate if color changed
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

    if (spec.bounds) {
      map.on("load", () => {
        map.fitBounds(spec.bounds as [number, number, number, number], {
          padding: 40,
          duration: 0,
        });
      });
    }

    mapRef.current = map;

    return () => {
      for (const id of markersRef.current.keys()) removeMarker(id);
      markersRef.current.clear();
      portalsRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update basemap
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const style = resolveBasemapStyle(spec.basemap);
    if (style) {
      map.setStyle(style);
      map.once("styledata", () => syncMarkers());
    }
  }, [spec.basemap, syncMarkers]);

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

  /* ---- Render portals ---- */

  const entries = Array.from(portalsRef.current.entries());

  return (
    <>
      <div ref={containerRef} className="w-full h-full" />
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
    </>
  );
}
