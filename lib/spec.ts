import type { RoutingProvider } from "./routing";

/** Content shown when a marker popup is opened. */
export interface PopupSpec {
  title?: string;
  description?: string;
  image?: string;
}

/** A map marker placed at a specific coordinate. */
export interface MarkerSpec {
  /** [longitude, latitude] position */
  coordinates: [number, number];
  /** Marker color (CSS color string, default "#3b82f6") */
  color?: string;
  /** Built-in icon name (e.g. "map-pin", "star", "coffee") */
  icon?: string;
  /** Text label displayed below the marker */
  label?: string;
  /** Tooltip text shown on hover */
  tooltip?: string;
  /** Popup content shown on click — string for simple text, or PopupSpec for rich content */
  popup?: string | PopupSpec;
  /** Allow the marker to be dragged (default false) */
  draggable?: boolean;
}

/* ---- Color system ---- */

/** Map a numeric attribute to a color gradient. */
export interface ContinuousColor {
  type: "continuous";
  /** Feature property name */
  attr: string;
  /** CartoColor palette name (e.g. "Sunset", "OrYel", "Bold") */
  palette: string;
  /** [min, max] data range for the color scale */
  domain?: [number, number];
  /** Color for features with null/missing values */
  nullColor?: string;
}

/** Map a string attribute to discrete colors. */
export interface CategoricalColor {
  type: "categorical";
  /** Feature property name */
  attr: string;
  /** CartoColor palette name (e.g. "Bold", "Pastel", "Vivid") */
  palette: string;
  /** Explicit category order (auto-detected if omitted) */
  categories?: string[];
  /** Color for features with null/missing values */
  nullColor?: string;
}

/** A color value — static CSS string, or data-driven continuous/categorical. */
export type ColorValue = string | ContinuousColor | CategoricalColor;

/* ---- Data-driven size ---- */

/** Map a numeric attribute to a size range. */
export interface ContinuousSize {
  type: "continuous";
  /** Feature property name */
  attr: string;
  /** [min, max] data range */
  domain: [number, number];
  /** [min, max] pixel size range */
  range: [number, number];
}

/** A size value — static number in pixels, or data-driven continuous. */
export type SizeValue = number | ContinuousSize;

/* ---- Layer system ---- */

/** Visual styling for GeoJSON, MVT, PMTiles, and Parquet layers. */
export interface LayerStyle {
  /** Fill color for polygons */
  fillColor?: ColorValue;
  /** Color for point features */
  pointColor?: ColorValue;
  /** Color for line features and polygon outlines */
  lineColor?: ColorValue;
  /** Line width in pixels (default 1.5) */
  lineWidth?: number;
  /** Point radius — static number or data-driven */
  pointRadius?: SizeValue;
  /** Opacity 0–1 (default 0.7) */
  opacity?: number;
}

/** Cluster configuration for point layers. */
export interface ClusterOptions {
  radius?: number;
  maxZoom?: number;
  minPoints?: number;
  /** Three colors for [small, medium, large] clusters */
  colors?: [string, string, string];
}

/** GeoJSON layer — points, lines, polygons from a URL or inline data. */
export interface GeoJsonLayerSpec {
  type: "geojson";
  /** GeoJSON URL or inline FeatureCollection */
  data: string | Record<string, unknown>;
  style?: LayerStyle;
  /** Property names to show in tooltip on hover */
  tooltip?: string | string[];
  /** Enable point clustering */
  cluster?: boolean;
  clusterOptions?: ClusterOptions;
}

/** Route line styling. */
export interface RouteStyle {
  color?: string;
  width?: number;
  opacity?: number;
  dashed?: boolean;
}

export type RouteProfile = "driving" | "walking" | "cycling";

/** Route layer — driving/walking/cycling directions via OSRM or Mapbox. */
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

/** Heatmap layer — point density visualization. */
export interface HeatmapLayerSpec {
  type: "heatmap";
  /** GeoJSON URL or inline FeatureCollection */
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

/** Vector tile layer — renders MVT tiles from a URL template. */
export interface VectorTileLayerSpec {
  type: "mvt";
  /** TileJSON URL or tile URL template with {z}/{x}/{y} placeholders */
  url: string;
  /** Source layer name within the vector tiles (required) */
  sourceLayer: string;
  /** Reuses the same style system as GeoJSON layers */
  style?: LayerStyle;
  /** Min zoom level to show this layer */
  minzoom?: number;
  /** Max zoom level to show this layer */
  maxzoom?: number;
  /** Tooltip — string for literal text, or array of property names */
  tooltip?: string | string[];
  /** MapLibre filter expression (e.g. ["==", "type", "park"]) */
  filter?: unknown[];
}

/** Raster tile layer — satellite imagery, terrain, etc. */
export interface RasterTileLayerSpec {
  type: "raster";
  /** Tile URL template with {z}/{x}/{y} placeholders, or TileJSON URL */
  url: string;
  /** Tile size in pixels (default 256) */
  tileSize?: number;
  /** Min zoom level */
  minzoom?: number;
  /** Max zoom level */
  maxzoom?: number;
  /** Opacity 0-1 (default 0.8) */
  opacity?: number;
  /** Attribution text shown on the map */
  attribution?: string;
}

/** GeoParquet layer — load .parquet files directly. */
export interface ParquetLayerSpec {
  type: "parquet";
  /** URL to a GeoParquet file */
  data: string;
  /** Geometry column name (auto-detected from GeoParquet metadata if omitted) */
  geometryColumn?: string;
  /** Reuses the same style system as GeoJSON layers */
  style?: LayerStyle;
  /** Tooltip — array of property names */
  tooltip?: string | string[];
  /** Enable point clustering */
  cluster?: boolean;
  clusterOptions?: ClusterOptions;
}

/** PMTiles layer — cloud-optimized tile archive. */
export interface PMTilesLayerSpec {
  type: "pmtiles";
  /** URL to a .pmtiles file */
  url: string;
  /** Source layer name within vector PMTiles (required for vector tiles) */
  sourceLayer?: string;
  /** Style for vector PMTiles (same as GeoJSON/MVT layers) */
  style?: LayerStyle;
  /** Min zoom level */
  minzoom?: number;
  /** Max zoom level */
  maxzoom?: number;
  /** Tooltip — string for literal text, or array of property names */
  tooltip?: string | string[];
  /** MapLibre filter expression */
  filter?: unknown[];
  /** Tile size in pixels for raster PMTiles (default 256) */
  tileSize?: number;
  /** Opacity 0-1 for raster PMTiles (default 0.8) */
  opacity?: number;
  /** Attribution text shown on the map */
  attribution?: string;
}

export type LayerSpec = GeoJsonLayerSpec | RouteLayerSpec | HeatmapLayerSpec | VectorTileLayerSpec | RasterTileLayerSpec | ParquetLayerSpec | PMTilesLayerSpec;

/* ---- Controls ---- */

export type ControlPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

/** Map UI controls — zoom buttons, compass, fullscreen, search, etc. */
export interface ControlsSpec {
  zoom?: boolean;
  compass?: boolean;
  fullscreen?: boolean;
  locate?: boolean;
  basemapSwitcher?: boolean;
  search?: boolean;
  layerSwitcher?: boolean | { position?: ControlPosition };
  position?: ControlPosition;
}

/* ---- Legend ---- */

/** Auto-generated legend from a data-driven layer. */
export interface LegendSpec {
  /** Layer ID to generate legend from */
  layer: string;
  title?: string;
  position?: ControlPosition;
}

/* ---- Widget ---- */

export interface WidgetRowSpec {
  label: string;
  value: string;
  color?: string;
}

/** SQL query config for data-driven widgets. Uses DuckDB-WASM in the browser. */
export interface SQLWidgetConfig {
  /** SQL query. Table names match layer IDs. Supports $west, $east, $south, $north, $zoom. */
  query: string;
  /** "viewport" re-runs on pan/zoom, "once" runs once on load. Default "once". */
  refreshOn?: "viewport" | "once";
  /** Debounce in ms for viewport queries. Default 0 (instant). */
  debounce?: number;
}

/** Stat card widget overlaid on the map. */
export interface WidgetSpec {
  position?: ControlPosition;
  title?: string;
  /** Supports {{column}} templates when sql is set */
  value?: string;
  /** Supports {{column}} templates when sql is set */
  description?: string;
  rows?: WidgetRowSpec[];
  /** SQL query config. When present, DuckDB-WASM is lazy-loaded. */
  sql?: SQLWidgetConfig;
}

export interface ViewportBounds {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
}

/* ---- Map spec ---- */

/**
 * The root map configuration object. Every field is optional —
 * an empty `{}` gives you a light basemap at world view.
 */
export interface MapSpec {
  /** Map style — "light", "dark", "streets", or a custom style URL */
  basemap?: "light" | "dark" | "streets" | (string & {});
  /** Map center as [longitude, latitude] */
  center?: [number, number];
  /** Zoom level 0–24 */
  zoom?: number;
  /** Camera tilt in degrees 0–85 */
  pitch?: number;
  /** Compass rotation in degrees -180–180 */
  bearing?: number;
  /** Fit map to bounding box [west, south, east, north] */
  bounds?: [number, number, number, number];
  /** Map projection — "mercator" (default) or "globe" */
  projection?: "mercator" | "globe";
  /** Named markers placed on the map */
  markers?: Record<string, MarkerSpec>;
  /** Named data layers (GeoJSON, routes, heatmaps, tiles, etc.) */
  layers?: Record<string, LayerSpec>;
  /** UI controls (zoom, compass, fullscreen, search, etc.) */
  controls?: ControlsSpec;
  /** Auto-generated legends from data-driven layers */
  legend?: Record<string, LegendSpec>;
  /** Stat card widgets overlaid on the map */
  widgets?: Record<string, WidgetSpec>;
}

/* ---- Viewport & renderer props ---- */

/** Current map viewport state returned by onViewportChange. */
export interface MapViewport {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

/* ---- Component slots ---- */

/** Props passed to custom Marker components. */
export interface MarkerComponentProps {
  id: string;
  marker: MarkerSpec;
  color: string;
}

/** Props passed to custom Popup components. */
export interface PopupComponentProps {
  id: string;
  marker: MarkerSpec;
}

/** Props passed to custom Tooltip components. */
export interface TooltipComponentProps {
  id: string;
  text: string;
}

/** Props passed to custom LayerTooltip components. */
export interface LayerTooltipComponentProps {
  properties: Record<string, unknown>;
  columns: string[];
}

/** Custom component overrides for markers, popups, and tooltips. */
export interface MapComponents {
  Marker: React.ComponentType<MarkerComponentProps>;
  Popup: React.ComponentType<PopupComponentProps>;
  Tooltip: React.ComponentType<TooltipComponentProps>;
  LayerTooltip: React.ComponentType<LayerTooltipComponentProps>;
}

/** Error object passed to the onError callback. */
export interface MapError {
  /** Layer ID that caused the error (if applicable) */
  layerId?: string;
  /** Human-readable error message */
  message: string;
}

/**
 * Props for the `<MapRenderer>` component.
 *
 * @example
 * ```tsx
 * <MapRenderer
 *   spec={spec}
 *   className="h-screen"
 *   onMapClick={(coords) => console.log(coords)}
 *   onError={(err) => console.error(err.message)}
 * />
 * ```
 */
export interface MapRendererProps {
  /** The map specification object — viewport, markers, layers, controls, etc. */
  spec: MapSpec;
  /** CSS class name applied to the map container div */
  className?: string;
  /** Inline styles applied to the map container div */
  style?: React.CSSProperties;
  /** Override built-in Marker, Popup, Tooltip, or LayerTooltip components */
  components?: Partial<MapComponents>;
  /** React children rendered inside the map container */
  children?: React.ReactNode;
  /** Routing provider for from/to routes (default: OSRM demo server) */
  routingProvider?: RoutingProvider;
  /** Fires when the user pans, zooms, or rotates the map */
  onViewportChange?: (viewport: MapViewport) => void;
  /** Fires when clicking on the map (not on a marker or layer feature) */
  onMapClick?: (coordinates: [number, number]) => void;
  /** Fires when a marker is clicked */
  onMarkerClick?: (markerId: string, coordinates: [number, number]) => void;
  onMarkerDragStart?: (markerId: string, coordinates: [number, number]) => void;
  onMarkerDrag?: (markerId: string, coordinates: [number, number]) => void;
  /** Fires when a marker drag ends — use this to update marker position */
  onMarkerDragEnd?: (markerId: string, coordinates: [number, number]) => void;
  /** Fires when a layer feature is clicked */
  onLayerClick?: (layerId: string, coordinates: [number, number]) => void;
  /** Fires when hovering over a layer feature. Passes null when leaving. */
  onLayerHover?: (layerId: string | null, coordinates: [number, number] | null, properties?: Record<string, unknown>) => void;
  /** Fires when a layer fails to load (bad URL, CORS, parse error, etc.) */
  onError?: (error: MapError) => void;
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
