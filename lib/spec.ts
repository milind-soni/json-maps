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
  tooltip?: string[];
  cluster?: boolean;
  clusterOptions?: ClusterOptions;
}

export interface RouteStyle {
  color?: string;
  width?: number;
  opacity?: number;
  dashed?: boolean;
}

export interface RouteLayerSpec {
  type: "route";
  coordinates: [number, number][];
  style?: RouteStyle;
}

export type LayerSpec = GeoJsonLayerSpec | RouteLayerSpec;

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
  markers?: Record<string, MarkerSpec>;
  layers?: Record<string, LayerSpec>;
  controls?: ControlsSpec;
  legend?: Record<string, LegendSpec>;
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
