import { z } from "zod";

/* ---- Palettes & Icons ---- */

const PALETTE_NAMES = [
  "Burg", "RedOr", "OrYel", "Peach", "PinkYl", "Mint", "BluGrn",
  "DarkMint", "Emrld", "BluYl", "Teal", "Purp", "Sunset", "SunsetDark",
  "Magenta", "TealRose", "Geyser", "Temps", "Fall", "ArmyRose", "Tropic",
  "Bold", "Pastel", "Antique", "Vivid", "Prism", "Safe",
] as const;

const ICON_NAMES = [
  "map-pin", "star", "heart", "flag", "coffee", "utensils", "hotel",
  "building-2", "tree-pine", "mountain", "plane", "train", "car", "ship",
  "bus", "truck", "church", "shopping-cart", "camera", "landmark", "tent",
] as const;

/* ---- Popup ---- */

const PopupSchema = z.union([
  z.string().describe("Simple text popup shown on click"),
  z.object({
    title: z.string().optional().describe("Place name"),
    description: z.string().optional().describe("Details about the place"),
    image: z.string().optional().describe("Image URL"),
  }).describe("Rich popup with title, description, and optional image"),
]);

/* ---- Marker ---- */

const MarkerSchema = z.object({
  coordinates: z.tuple([z.number(), z.number()]).describe("[longitude, latitude]"),
  color: z.string().optional().describe('Hex color (e.g. "#e74c3c")'),
  icon: z.enum(ICON_NAMES).optional().describe("Icon name in kebab-case"),
  label: z.string().optional().describe("Text displayed below the marker"),
  tooltip: z.string().optional().describe("Short text shown on hover"),
  popup: PopupSchema.optional(),
  draggable: z.boolean().optional().describe("Allow user to drag the marker"),
}).describe("A map marker at a specific location");

/* ---- Color system ---- */

const ContinuousColorSchema = z.object({
  type: z.literal("continuous"),
  attr: z.string().describe("Feature property name to color by"),
  palette: z.enum(PALETTE_NAMES).describe("Color palette name"),
  domain: z.tuple([z.number(), z.number()]).optional().describe("[min, max] data range"),
  nullColor: z.string().optional().describe("Color for features with no data"),
}).describe("Continuous color ramp based on a numeric property");

const CategoricalColorSchema = z.object({
  type: z.literal("categorical"),
  attr: z.string().describe("Feature property name to color by"),
  palette: z.enum(PALETTE_NAMES).describe("Color palette name"),
  categories: z.array(z.string()).optional().describe("Category values in palette order"),
  nullColor: z.string().optional().describe("Color for unmatched categories"),
}).describe("Categorical colors based on a string property");

const ColorValueSchema = z.union([
  z.string().describe("Static hex color"),
  ContinuousColorSchema,
  CategoricalColorSchema,
]);

/* ---- Data-driven size ---- */

const ContinuousSizeSchema = z.object({
  type: z.literal("continuous"),
  attr: z.string().describe("Feature property name"),
  domain: z.tuple([z.number(), z.number()]).describe("[min, max] data range"),
  range: z.tuple([z.number(), z.number()]).describe("[min, max] pixel size"),
}).describe("Data-driven size based on a numeric property");

const SizeValueSchema = z.union([
  z.number().describe("Static size in pixels"),
  ContinuousSizeSchema,
]);

/* ---- Layer style ---- */

const LayerStyleSchema = z.object({
  fillColor: ColorValueSchema.optional().describe("Fill color for polygons"),
  pointColor: ColorValueSchema.optional().describe("Color for points"),
  lineColor: ColorValueSchema.optional().describe("Color for lines and outlines"),
  lineWidth: z.number().optional().describe("Line width in pixels (default 1)"),
  pointRadius: SizeValueSchema.optional().describe("Point radius in pixels (default 5)"),
  opacity: z.number().min(0).max(1).optional().describe("Layer opacity 0-1 (default 0.8)"),
});

/* ---- Cluster options ---- */

const ClusterOptionsSchema = z.object({
  radius: z.number().optional().describe("Cluster radius in pixels (default 50)"),
  maxZoom: z.number().optional().describe("Max zoom to cluster at (default 14)"),
  minPoints: z.number().optional().describe("Minimum points per cluster (default 2)"),
  colors: z.tuple([z.string(), z.string(), z.string()]).optional()
    .describe('3-color array for small/medium/large clusters (default ["#22c55e","#eab308","#ef4444"])'),
});

/* ---- Layer types ---- */

const GeoJsonLayerSchema = z.object({
  type: z.literal("geojson"),
  data: z.union([z.string(), z.record(z.string(), z.unknown())])
    .describe("URL to a GeoJSON file OR inline GeoJSON object"),
  style: LayerStyleSchema.optional(),
  tooltip: z.union([z.string(), z.array(z.string())]).optional()
    .describe("Literal hover text OR array of feature property names to display"),
  cluster: z.boolean().optional().describe("Enable point clustering"),
  clusterOptions: ClusterOptionsSchema.optional(),
}).describe("GeoJSON layer — polygons, lines, or points from a URL or inline data");

const RouteStyleSchema = z.object({
  color: z.string().optional().describe("Route line color"),
  width: z.number().optional().describe("Route line width (default 3)"),
  opacity: z.number().min(0).max(1).optional(),
  dashed: z.boolean().optional().describe("Dashed line style"),
});

const RouteLayerSchema = z.object({
  type: z.literal("route"),
  coordinates: z.array(z.tuple([z.number(), z.number()])).optional()
    .describe("Manual path as array of [lng, lat] pairs — use this OR from/to"),
  from: z.tuple([z.number(), z.number()]).optional()
    .describe("Start point [lng, lat] — triggers OSRM auto-routing"),
  to: z.tuple([z.number(), z.number()]).optional()
    .describe("End point [lng, lat] — triggers OSRM auto-routing"),
  waypoints: z.array(z.tuple([z.number(), z.number()])).optional()
    .describe("Intermediate waypoints for routing"),
  profile: z.enum(["driving", "walking", "cycling"]).optional()
    .describe('Routing profile (default "driving")'),
  style: RouteStyleSchema.optional(),
  tooltip: z.union([z.string(), z.array(z.string())]).optional(),
}).describe("Route layer — auto-routed via OSRM or manual coordinate path");

const HeatmapLayerSchema = z.object({
  type: z.literal("heatmap"),
  data: z.union([z.string(), z.record(z.string(), z.unknown())])
    .describe("URL or inline GeoJSON of Point features"),
  weight: z.string().optional().describe('Feature property for point weight (e.g. "mag")'),
  radius: z.number().optional().describe("Pixel radius per point (default 30)"),
  intensity: z.number().optional().describe("Intensity multiplier (default 1)"),
  opacity: z.number().min(0).max(1).optional().describe("Opacity 0-1 (default 0.8)"),
  palette: z.enum(PALETTE_NAMES).optional().describe('Color ramp palette (default "OrYel")'),
}).describe("Heatmap layer — density visualization of point data");

const VectorTileLayerSchema = z.object({
  type: z.literal("mvt"),
  url: z.string().describe("Tile URL with {z}/{x}/{y} placeholders or TileJSON URL"),
  sourceLayer: z.string().describe("Source layer name within the vector tiles"),
  style: LayerStyleSchema.optional(),
  minzoom: z.number().optional(),
  maxzoom: z.number().optional(),
  tooltip: z.union([z.string(), z.array(z.string())]).optional(),
  filter: z.array(z.unknown()).optional().describe('MapLibre filter (e.g. ["==", "type", "park"])'),
}).describe("Vector tile layer (MVT) — styled features from tile server. Do NOT use for .pmtiles URLs — use type 'pmtiles' instead");

const RasterTileLayerSchema = z.object({
  type: z.literal("raster"),
  url: z.string().describe("Tile URL with {z}/{x}/{y} placeholders"),
  tileSize: z.number().optional().describe("Tile size in pixels (default 256)"),
  minzoom: z.number().optional(),
  maxzoom: z.number().optional(),
  opacity: z.number().min(0).max(1).optional().describe("Opacity (default 0.8)"),
  attribution: z.string().optional().describe("Attribution text"),
}).describe("Raster tile layer — satellite imagery, terrain, etc.");

const ParquetLayerSchema = z.object({
  type: z.literal("parquet"),
  data: z.string().describe("URL to a GeoParquet file"),
  geometryColumn: z.string().optional().describe("Geometry column name (auto-detected if omitted)"),
  style: LayerStyleSchema.optional(),
  tooltip: z.union([z.string(), z.array(z.string())]).optional(),
  cluster: z.boolean().optional(),
  clusterOptions: ClusterOptionsSchema.optional(),
}).describe("GeoParquet layer — load and render parquet spatial data");

const PMTilesLayerSchema = z.object({
  type: z.literal("pmtiles"),
  url: z.string().describe("URL to a .pmtiles file (e.g. https://example.com/data.pmtiles)"),
  sourceLayer: z.string().optional().describe("Source layer name within vector PMTiles (required for vector tiles)"),
  style: LayerStyleSchema.optional(),
  minzoom: z.number().optional(),
  maxzoom: z.number().optional(),
  tooltip: z.union([z.string(), z.array(z.string())]).optional(),
  filter: z.array(z.unknown()).optional().describe('MapLibre filter expression'),
  tileSize: z.number().optional().describe("Tile size in pixels for raster PMTiles (default 256)"),
  opacity: z.number().min(0).max(1).optional().describe("Opacity for raster PMTiles (default 0.8)"),
  attribution: z.string().optional().describe("Attribution text"),
}).describe("PMTiles layer — ALWAYS use this type for any .pmtiles URL. Cloud-optimized single-file tile archive (vector or raster), no tile server needed");

const LayerSchema = z.union([
  GeoJsonLayerSchema,
  RouteLayerSchema,
  HeatmapLayerSchema,
  VectorTileLayerSchema,
  RasterTileLayerSchema,
  ParquetLayerSchema,
  PMTilesLayerSchema,
]);

/* ---- Controls ---- */

const PositionSchema = z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]);

const ControlsSchema = z.object({
  zoom: z.boolean().optional().describe("Zoom in/out buttons"),
  compass: z.boolean().optional().describe("Compass/north arrow"),
  fullscreen: z.boolean().optional().describe("Fullscreen toggle"),
  locate: z.boolean().optional().describe("Locate-me button"),
  basemapSwitcher: z.boolean().optional().describe("Light/dark/streets toggle"),
  search: z.boolean().optional().describe("Geocoding search bar"),
  layerSwitcher: z.union([
    z.boolean(),
    z.object({ position: PositionSchema.optional() }),
  ]).optional().describe("Layer visibility toggle panel"),
  position: PositionSchema.optional().describe('Controls position (default "top-right")'),
}).describe("Map UI controls");

/* ---- Legend ---- */

const LegendSchema = z.object({
  layer: z.string().describe("ID of the layer to derive legend from"),
  title: z.string().optional().describe("Legend title"),
  position: PositionSchema.optional().describe('Position (default "bottom-left")'),
});

/* ---- Widget ---- */

const WidgetRowSchema = z.object({
  label: z.string(),
  value: z.string(),
  color: z.string().optional(),
});

const WidgetSchema = z.object({
  position: PositionSchema.optional().describe('Position (default "top-left")'),
  title: z.string().optional().describe("Small uppercase label"),
  value: z.string().optional().describe('Large prominent number (e.g. "2,847")'),
  description: z.string().optional().describe("Subtitle below the value"),
  rows: z.array(WidgetRowSchema).optional().describe("Key-value rows in the card"),
}).describe("Overlay stat card / info widget");

/* ---- MapSpec ---- */

export const MapSpecSchema = z.object({
  basemap: z.string().optional()
    .describe('"light", "dark", "streets", or a custom MapLibre style URL'),
  center: z.tuple([z.number(), z.number()]).optional()
    .describe("[longitude, latitude] — e.g. [-73.98, 40.75] for New York"),
  zoom: z.number().min(0).max(24).optional()
    .describe("Zoom level 0-24 (city ~11, neighborhood ~14, street ~17)"),
  pitch: z.number().min(0).max(85).optional()
    .describe("Tilt angle in degrees (0-85)"),
  bearing: z.number().optional()
    .describe("Rotation in degrees"),
  bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional()
    .describe("[west, south, east, north] — fit map to these bounds"),
  projection: z.enum(["mercator", "globe"]).optional()
    .describe('"mercator" (default) or "globe" for 3D sphere at low zoom'),
  markers: z.record(z.string(), MarkerSchema).optional()
    .describe("Named map of markers — keys are descriptive IDs like 'eiffel-tower'"),
  layers: z.record(z.string(), LayerSchema).optional()
    .describe("Named map of data layers (geojson, route, heatmap, mvt, raster, parquet, pmtiles)"),
  controls: ControlsSchema.optional(),
  legend: z.record(z.string(), LegendSchema).optional()
    .describe("Named map of legend overlays"),
  widgets: z.record(z.string(), WidgetSchema).optional()
    .describe("Named map of stat card overlays"),
});

export type MapSpec = z.infer<typeof MapSpecSchema>;
