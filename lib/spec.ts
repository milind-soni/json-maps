import type { RoutingProvider } from "./routing";

export interface PopupSpec {
  title?: string;
  description?: string;
  image?: string;
}

export interface MarkerSpec {
  coordinates: [number, number];
  color?: string;
  icon?: string;
  label?: string;
  tooltip?: string;
  popup?: string | PopupSpec;
  draggable?: boolean;
}

/* ---- Color system ---- */

export interface ContinuousColor {
  type: "continuous";
  attr: string;
  palette: string;
  domain?: [number, number];
  nullColor?: string;
}

export interface CategoricalColor {
  type: "categorical";
  attr: string;
  palette: string;
  categories?: string[];
  nullColor?: string;
}

export type ColorValue = string | ContinuousColor | CategoricalColor;

/* ---- Data-driven size ---- */

export interface ContinuousSize {
  type: "continuous";
  attr: string;
  domain: [number, number];
  range: [number, number];
}

export type SizeValue = number | ContinuousSize;

/* ---- Layer system ---- */

export interface LayerStyle {
  fillColor?: ColorValue;
  pointColor?: ColorValue;
  lineColor?: ColorValue;
  lineWidth?: number;
  pointRadius?: SizeValue;
  opacity?: number;
}

export interface ClusterOptions {
  radius?: number;
  maxZoom?: number;
  minPoints?: number;
  colors?: [string, string, string];
}

export interface GeoJsonLayerSpec {
  type: "geojson";
  data: string | Record<string, unknown>;
  style?: LayerStyle;
  tooltip?: string | string[];
  cluster?: boolean;
  clusterOptions?: ClusterOptions;
}

export interface RouteStyle {
  color?: string;
  width?: number;
  opacity?: number;
  dashed?: boolean;
}

export type RouteProfile = "driving" | "walking" | "cycling";

export interface RouteLayerSpec {
  type: "route";
  /** Manual coordinates — provide these OR from/to, not both */
  coordinates?: [number, number][];
  /** Start point [lng, lat] — triggers OSRM routing */
  from?: [number, number];
  /** End point [lng, lat] — triggers OSRM routing */
  to?: [number, number];
  /** Intermediate waypoints for OSRM routing */
  waypoints?: [number, number][];
  /** Routing profile (default "driving") */
  profile?: RouteProfile;
  style?: RouteStyle;
  tooltip?: string | string[];
}

export interface HeatmapLayerSpec {
  type: "heatmap";
  data: string | Record<string, unknown>;
  /** Feature property to use as weight (default: equal weight) */
  weight?: string;
  /** Pixel radius of influence per point (default: 30) */
  radius?: number;
  /** Intensity multiplier (default: 1) */
  intensity?: number;
  /** Opacity 0-1 (default: 0.8) */
  opacity?: number;
  /** CartoColor palette for the color ramp (default: "OrYel") */
  palette?: string;
}

export type LayerSpec = GeoJsonLayerSpec | RouteLayerSpec | HeatmapLayerSpec;

/* ---- Controls ---- */

export type ControlPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface ControlsSpec {
  zoom?: boolean;
  compass?: boolean;
  fullscreen?: boolean;
  locate?: boolean;
  basemapSwitcher?: boolean;
  position?: ControlPosition;
}

/* ---- Legend ---- */

export interface LegendSpec {
  layer: string;
  title?: string;
  position?: ControlPosition;
}

/* ---- Map spec ---- */

export interface MapSpec {
  basemap?: "light" | "dark" | "streets" | (string & {});
  center?: [number, number];
  zoom?: number;
  pitch?: number;
  bearing?: number;
  bounds?: [number, number, number, number];
  projection?: "mercator" | "globe";
  markers?: Record<string, MarkerSpec>;
  layers?: Record<string, LayerSpec>;
  controls?: ControlsSpec;
  legend?: Record<string, LegendSpec>;
}

/* ---- Viewport & renderer props ---- */

export interface MapViewport {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

/* ---- Component slots ---- */

export interface MarkerComponentProps {
  id: string;
  marker: MarkerSpec;
  color: string;
}

export interface PopupComponentProps {
  id: string;
  marker: MarkerSpec;
}

export interface TooltipComponentProps {
  id: string;
  text: string;
}

export interface LayerTooltipComponentProps {
  properties: Record<string, unknown>;
  columns: string[];
}

export interface MapComponents {
  Marker: React.ComponentType<MarkerComponentProps>;
  Popup: React.ComponentType<PopupComponentProps>;
  Tooltip: React.ComponentType<TooltipComponentProps>;
  LayerTooltip: React.ComponentType<LayerTooltipComponentProps>;
}

export interface MapRendererProps {
  spec: MapSpec;
  components?: Partial<MapComponents>;
  children?: React.ReactNode;
  /** Routing provider for from/to routes (default: OSRM demo server) */
  routingProvider?: RoutingProvider;
  onViewportChange?: (viewport: MapViewport) => void;
  onMarkerClick?: (markerId: string, coordinates: [number, number]) => void;
  onMarkerDragStart?: (markerId: string, coordinates: [number, number]) => void;
  onMarkerDrag?: (markerId: string, coordinates: [number, number]) => void;
  onMarkerDragEnd?: (markerId: string, coordinates: [number, number]) => void;
  onLayerClick?: (layerId: string, coordinates: [number, number]) => void;
}

export const BASEMAP_STYLES: Record<string, string> = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  streets: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
};

export function resolveBasemapStyle(basemap?: string): string | null {
  if (!basemap) return BASEMAP_STYLES.light!;
  if (BASEMAP_STYLES[basemap]) return BASEMAP_STYLES[basemap]!;
  if (basemap.startsWith("http")) return basemap;
  return null;
}
