"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { type MapSpec, resolveBasemapStyle } from "@/lib/spec";

const DEFAULT_CENTER: [number, number] = [0, 20];
const DEFAULT_ZOOM = 1.5;

export function MapRenderer({ spec }: { spec: MapSpec }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

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
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update basemap
  useEffect(() => {
    if (!mapRef.current) return;
    const style = resolveBasemapStyle(spec.basemap);
    if (style) mapRef.current.setStyle(style);
  }, [spec.basemap]);

  // Update viewport
  useEffect(() => {
    if (!mapRef.current) return;

    if (spec.bounds) {
      mapRef.current.fitBounds(spec.bounds as [number, number, number, number], {
        padding: 40,
      });
      return;
    }

    mapRef.current.flyTo({
      center: spec.center ?? DEFAULT_CENTER,
      zoom: spec.zoom ?? DEFAULT_ZOOM,
      pitch: spec.pitch ?? 0,
      bearing: spec.bearing ?? 0,
    });
  }, [spec.center, spec.zoom, spec.pitch, spec.bearing, spec.bounds]);

  return <div ref={containerRef} className="w-full h-full" />;
}
