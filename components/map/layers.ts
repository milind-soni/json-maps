import maplibregl from "maplibre-gl";
import { PALETTES } from "@/lib/palettes";
import type {
  GeoJsonLayerSpec,
  RouteLayerSpec,
  HeatmapLayerSpec,
  VectorTileLayerSpec,
  RasterTileLayerSpec,
} from "@/lib/spec";
import type { RoutingProvider } from "@/lib/routing";
import { colorValueToExpression, sizeValueToExpression } from "./utils";

/* ------------------------------------------------------------------ */
/*  Shared types                                                       */
/* ------------------------------------------------------------------ */

export interface LayerTooltipData {
  properties: Record<string, unknown>;
  columns: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LayerHandler = { event: string; layer: string; handler: any };

export interface LayerDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  callbacksRef: React.RefObject<any>;
  layerHandlersRef: React.MutableRefObject<Record<string, LayerHandler[]>>;
  setLayerTooltip: (val: LayerTooltipData | null) => void;
  layerTooltipPopupRef: React.RefObject<maplibregl.Popup | null>;
  routingProviderRef: React.RefObject<RoutingProvider>;
  pendingRouteFetchRef: React.MutableRefObject<Set<string>>;
  mapRef: React.RefObject<maplibregl.Map | null>;
}

/* ------------------------------------------------------------------ */
/*  GeoJSON layer                                                      */
/* ------------------------------------------------------------------ */

export function addGeoJsonLayer(
  map: maplibregl.Map,
  id: string,
  layer: GeoJsonLayerSpec,
  deps: LayerDeps,
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

      const clusterHandlers: LayerHandler[] = [
        { event: "click", layer: `${sourceId}-cluster`, handler: onClusterClick },
      ];
      deps.layerHandlersRef.current[`${sourceId}-cluster`] = clusterHandlers;
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
      const handlers: LayerHandler[] = [];

      for (const subLayer of subLayers) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const onMove = (e: any) => {
          if (!e.features || e.features.length === 0) return;
          map.getCanvas().style.cursor = "pointer";
          if (isText) {
            deps.setLayerTooltip({ properties: { _text: layer.tooltip as string }, columns });
          } else {
            const props = (e.features[0].properties ?? {}) as Record<string, unknown>;
            deps.setLayerTooltip({ properties: props, columns });
          }

          const popup = deps.layerTooltipPopupRef.current;
          if (popup) {
            popup.setLngLat(e.lngLat).addTo(map);
          }
        };
        const onLeave = () => {
          map.getCanvas().style.cursor = "";
          deps.setLayerTooltip(null);
          deps.layerTooltipPopupRef.current?.remove();
        };

        map.on("mousemove", subLayer, onMove);
        map.on("mouseleave", subLayer, onLeave);
        handlers.push({ event: "mousemove", layer: subLayer, handler: onMove });
        handlers.push({ event: "mouseleave", layer: subLayer, handler: onLeave });
      }

      deps.layerHandlersRef.current[sourceId] = handlers;
    }

    // Click event (for onLayerClick callback) — on all sub-layers
    {
      const clickLayers = [
        `${sourceId}-fill`,
        `${sourceId}-circle`,
        `${sourceId}-line`,
      ];
      const clickHandlers: LayerHandler[] = [];
      for (const subLayer of clickLayers) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const onClick = (e: any) => {
          deps.callbacksRef.current.onLayerClick?.(id, [e.lngLat.lng, e.lngLat.lat]);
        };
        map.on("click", subLayer, onClick);
        clickHandlers.push({ event: "click", layer: subLayer, handler: onClick });
      }
      // Append to existing handlers (tooltip may have already set them)
      const existing = deps.layerHandlersRef.current[sourceId] ?? [];
      deps.layerHandlersRef.current[sourceId] = [...existing, ...clickHandlers];
    }
  } catch (err) {
    console.warn(`[json-maps] Failed to add layer "${id}":`, err);
    try { removeLayer(map, id, deps); } catch { /* ignore */ }
  }
}

/* ------------------------------------------------------------------ */
/*  Route layer                                                        */
/* ------------------------------------------------------------------ */

export function renderRouteOnMap(
  map: maplibregl.Map,
  id: string,
  layer: RouteLayerSpec,
  coordinates: [number, number][],
  deps: LayerDeps,
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
  const handlers: LayerHandler[] = [];

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
      deps.setLayerTooltip(tooltipData);
      const popup = deps.layerTooltipPopupRef.current;
      if (popup) popup.setLngLat(e.lngLat).addTo(map);
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
      deps.setLayerTooltip(null);
      deps.layerTooltipPopupRef.current?.remove();
    };
    map.on("mousemove", lineLayerId, onMove);
    map.on("mouseleave", lineLayerId, onLeave);
    handlers.push({ event: "mousemove", layer: lineLayerId, handler: onMove });
    handlers.push({ event: "mouseleave", layer: lineLayerId, handler: onLeave });
  }

  // Click event (for onLayerClick callback)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onClick = (e: any) => {
    deps.callbacksRef.current.onLayerClick?.(id, [e.lngLat.lng, e.lngLat.lat]);
  };
  map.on("click", lineLayerId, onClick);
  handlers.push({ event: "click", layer: lineLayerId, handler: onClick });

  if (handlers.length > 0) {
    deps.layerHandlersRef.current[sourceId] = handlers;
  }
}

export function addRouteLayer(
  map: maplibregl.Map,
  id: string,
  layer: RouteLayerSpec,
  deps: LayerDeps,
) {
  try {
    if (layer.from && layer.to) {
      // Routing provider — fetch then render
      deps.pendingRouteFetchRef.current.add(id);
      deps.routingProviderRef.current({
        from: layer.from,
        to: layer.to,
        waypoints: layer.waypoints,
        profile: layer.profile,
      })
        .then((coords: [number, number][]) => {
          deps.pendingRouteFetchRef.current.delete(id);
          // Check map still exists (not unmounted during fetch)
          if (!deps.mapRef.current) return;
          renderRouteOnMap(map, id, layer, coords, deps);
        })
        .catch((err: unknown) => {
          deps.pendingRouteFetchRef.current.delete(id);
          console.warn(`[json-maps] Routing failed for "${id}", falling back to straight line:`, err);
          if (!deps.mapRef.current) return;
          // Fallback: straight line between from/to
          const fallback = [layer.from!, ...(layer.waypoints ?? []), layer.to!];
          renderRouteOnMap(map, id, layer, fallback, deps);
        });
    } else if (layer.coordinates) {
      renderRouteOnMap(map, id, layer, layer.coordinates, deps);
    }
  } catch (err) {
    console.warn(`[json-maps] Failed to add route "${id}":`, err);
    try { removeLayer(map, id, deps); } catch { /* ignore */ }
  }
}

/* ------------------------------------------------------------------ */
/*  Heatmap layer                                                      */
/* ------------------------------------------------------------------ */

export function addHeatmapLayer(
  map: maplibregl.Map,
  id: string,
  layer: HeatmapLayerSpec,
  deps: LayerDeps,
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
    try { removeLayer(map, id, deps); } catch { /* ignore */ }
  }
}

/* ------------------------------------------------------------------ */
/*  Vector tile layer (MVT)                                            */
/* ------------------------------------------------------------------ */

export function addVectorTileLayer(
  map: maplibregl.Map,
  id: string,
  layer: VectorTileLayerSpec,
  deps: LayerDeps,
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
      const handlers: LayerHandler[] = [];

      for (const subLayer of subLayers) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const onMove = (e: any) => {
          if (!e.features || e.features.length === 0) return;
          map.getCanvas().style.cursor = "pointer";
          if (isText) {
            deps.setLayerTooltip({ properties: { _text: layer.tooltip as string }, columns });
          } else {
            const props = (e.features[0].properties ?? {}) as Record<string, unknown>;
            deps.setLayerTooltip({ properties: props, columns });
          }
          const popup = deps.layerTooltipPopupRef.current;
          if (popup) popup.setLngLat(e.lngLat).addTo(map);
        };
        const onLeave = () => {
          map.getCanvas().style.cursor = "";
          deps.setLayerTooltip(null);
          deps.layerTooltipPopupRef.current?.remove();
        };
        map.on("mousemove", subLayer, onMove);
        map.on("mouseleave", subLayer, onLeave);
        handlers.push({ event: "mousemove", layer: subLayer, handler: onMove });
        handlers.push({ event: "mouseleave", layer: subLayer, handler: onLeave });
      }
      deps.layerHandlersRef.current[sourceId] = handlers;
    }

    // Click event (onLayerClick)
    {
      const clickLayers = [`${sourceId}-fill`, `${sourceId}-circle`, `${sourceId}-line`];
      const clickHandlers: LayerHandler[] = [];
      for (const subLayer of clickLayers) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const onClick = (e: any) => {
          deps.callbacksRef.current.onLayerClick?.(id, [e.lngLat.lng, e.lngLat.lat]);
        };
        map.on("click", subLayer, onClick);
        clickHandlers.push({ event: "click", layer: subLayer, handler: onClick });
      }
      const existing = deps.layerHandlersRef.current[sourceId] ?? [];
      deps.layerHandlersRef.current[sourceId] = [...existing, ...clickHandlers];
    }
  } catch (err) {
    console.warn(`[json-maps] Failed to add vector tile layer "${id}":`, err);
    try { removeLayer(map, id, deps); } catch { /* ignore */ }
  }
}

/* ------------------------------------------------------------------ */
/*  Raster tile layer                                                  */
/* ------------------------------------------------------------------ */

export function addRasterTileLayer(
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
    try {
      const subLayers = [`${sourceId}-raster`];
      for (const layerId of subLayers) {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        try { map.removeSource(sourceId); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }
}

/* ------------------------------------------------------------------ */
/*  Remove layer                                                       */
/* ------------------------------------------------------------------ */

export function removeLayer(map: maplibregl.Map, id: string, deps: LayerDeps) {
  const sourceId = `jm-${id}`;

  // Remove event listeners
  for (const key of [sourceId, `${sourceId}-cluster`]) {
    const handlers = deps.layerHandlersRef.current[key];
    if (handlers) {
      for (const h of handlers) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (map as any).off(h.event, h.layer, h.handler);
      }
      delete deps.layerHandlersRef.current[key];
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
