"use client";

import { createContext, useContext } from "react";
import type maplibregl from "maplibre-gl";

export interface MapContextValue {
  map: maplibregl.Map | null;
  isLoaded: boolean;
}

export const MapContext = createContext<MapContextValue | null>(null);

export function useMap(): MapContextValue {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error("useMap must be used within <MapRenderer>");
  return ctx;
}
