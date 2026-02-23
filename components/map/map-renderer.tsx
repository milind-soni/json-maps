"use client";

import { Fragment, useEffect, useRef, useCallback, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapRendererProps, MarkerSpec } from "@/lib/spec";
import { resolveBasemapStyle } from "@/lib/spec";
import { osrmProvider } from "@/lib/routing";

import { MapContext } from "./map-context";
import { DefaultMarker, DefaultPopup, DefaultTooltip, DefaultLayerTooltip } from "./defaults";
import { MapControls, BasemapSwitcher, MapSearch, LayerSwitcher } from "./controls";
import { MapLegend, MapWidgets } from "./overlays";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "./utils";
import {
  addGeoJsonLayer,
  addRouteLayer,
  addHeatmapLayer,
  addVectorTileLayer,
  addRasterTileLayer,
  addParquetLayer,
  addPMTilesLayer,
  removeLayer,
  type LayerDeps,
  type LayerTooltipData,
  type LayerHandler,
} from "./layers";

const defaultRoutingProvider = osrmProvider();

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
  const layerHandlersRef = useRef<Record<string, LayerHandler[]>>({});
  const pendingRouteFetchRef = useRef<Set<string>>(new Set());
  const layerTooltipPopupRef = useRef<maplibregl.Popup | null>(null);
  const layerTooltipContainerRef = useRef<HTMLDivElement | null>(null);
  const [layerTooltip, setLayerTooltip] = useState<LayerTooltipData | null>(null);

  // Keep routing provider in a ref so async callbacks use the latest one
  const routingProviderRef = useRef(routingProvider);
  routingProviderRef.current = routingProvider;

  // Layer dependencies bag — passed to layer functions instead of closures
  const layerDeps: LayerDeps = {
    callbacksRef,
    layerHandlersRef,
    setLayerTooltip,
    layerTooltipPopupRef,
    routingProviderRef,
    pendingRouteFetchRef,
    mapRef,
  };

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
        removeLayer(map, id, layerDeps);
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
        removeLayer(map, id, layerDeps);
      }

      if (layerSpec.type === "route") {
        addRouteLayer(map, id, layerSpec, layerDeps);
      } else if (layerSpec.type === "heatmap") {
        addHeatmapLayer(map, id, layerSpec, layerDeps);
      } else if (layerSpec.type === "mvt") {
        addVectorTileLayer(map, id, layerSpec, layerDeps);
      } else if (layerSpec.type === "raster") {
        addRasterTileLayer(map, id, layerSpec);
      } else if (layerSpec.type === "parquet") {
        addParquetLayer(map, id, layerSpec, layerDeps);
      } else if (layerSpec.type === "pmtiles") {
        addPMTilesLayer(map, id, layerSpec, layerDeps);
      } else {
        addGeoJsonLayer(map, id, layerSpec, layerDeps);
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

    // Apply globe projection if specified (must wait for style to load)
    if (spec.projection === "globe") {
      const applyGlobe = () => map.setProjection({ type: "globe" });
      if (map.isStyleLoaded()) applyGlobe();
      else map.once("style.load", applyGlobe);
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
        {spec.widgets && <MapWidgets widgets={spec.widgets} dark={spec.basemap === "dark"} />}
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
