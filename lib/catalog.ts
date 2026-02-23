import { PALETTES } from "./palettes";
import { BASEMAP_STYLES } from "./spec";
import { generateRegistrySummary } from "./data-registry";

/**
 * Catalog-driven system prompt generation.
 *
 * The prompt is assembled from structured definitions so it stays in sync
 * with the actual schema. When you add a field to MapSpec + spec-schema.ts,
 * add its description here and the AI prompt updates automatically.
 */

/* ---- Field definitions ---- */

interface FieldDef {
  description: string;
  children?: Record<string, FieldDef>;
}

const MARKER_FIELDS: Record<string, FieldDef> = {
  coordinates: { description: "[longitude, latitude] (required)" },
  color: { description: 'hex color string (e.g. "#e74c3c")' },
  icon: {
    description:
      'icon name in kebab-case. Supported: "map-pin", "star", "heart", "flag", "coffee", "utensils", "hotel", "building-2", "tree-pine", "mountain", "plane", "train", "car", "ship", "bus", "truck", "church", "shopping-cart", "camera", "landmark", "tent". Only use these exact names.',
  },
  label: { description: "text displayed below the marker" },
  tooltip: {
    description:
      'short text shown on hover (e.g. "Category · Neighborhood")',
  },
  popup: {
    description: "string OR rich popup object (shown on click)",
    children: {
      title: { description: "place name" },
      description: { description: "details about the place" },
      image: { description: "image URL" },
    },
  },
  draggable: { description: "boolean" },
};

const LAYER_STYLE_FIELDS: Record<string, FieldDef> = {
  fillColor: {
    description: "hex string OR data-driven color object (for polygons)",
  },
  pointColor: {
    description: "hex string OR data-driven color object (for points)",
  },
  lineColor: {
    description:
      "hex string OR data-driven color object (for lines/outlines)",
  },
  lineWidth: { description: "number (default 1)" },
  pointRadius: {
    description: "number OR data-driven size object (default 5)",
  },
  opacity: { description: "number 0-1 (default 0.8)" },
};

const LAYER_FIELDS: Record<string, FieldDef> = {
  type: { description: '"geojson", "route", "heatmap", "mvt" (vector tiles), "raster" (tile imagery), "parquet" (GeoParquet files), or "pmtiles" (PMTiles archives) (required)' },
  data: {
    description:
      '(geojson) URL string to a GeoJSON file OR inline GeoJSON object. (parquet) URL to a GeoParquet file.',
  },
  coordinates: {
    description:
      '(route only) array of [longitude, latitude] pairs defining the line path. Use this OR from/to, not both.',
  },
  from: {
    description:
      '(route only) start point [longitude, latitude] — triggers OSRM auto-routing. Use with "to".',
  },
  to: {
    description:
      '(route only) end point [longitude, latitude] — triggers OSRM auto-routing. Use with "from".',
  },
  waypoints: {
    description:
      '(route only) intermediate waypoints for OSRM routing, e.g. [[lng, lat], [lng, lat]]',
  },
  profile: {
    description:
      '(route only) OSRM routing profile: "driving" | "walking" | "cycling" (default "driving")',
  },
  style: {
    description: "styling options (geojson: full LayerStyle, route: color/width/opacity/dashed)",
    children: LAYER_STYLE_FIELDS,
  },
  tooltip: {
    description:
      'string for literal hover text (e.g. "Walking route · 2.5 km"), or array of feature property names to show on hover (e.g. ["name", "population"])',
  },
  weight: {
    description:
      '(heatmap only) feature property name to use as point weight (e.g. "mag"). If omitted, all points have equal weight.',
  },
  radius: {
    description: "(heatmap only) pixel radius of influence per point (default 30)",
  },
  intensity: {
    description: "(heatmap only) intensity multiplier (default 1). Increase for sparse data.",
  },
  palette: {
    description:
      '(heatmap only) CartoColor palette for the color ramp (default "OrYel"). Good choices: OrYel, Sunset, Burg, RedOr, Teal.',
  },
  geometryColumn: {
    description: '(parquet only) geometry column name — auto-detected from GeoParquet metadata if omitted (default "geometry")',
  },
  cluster: {
    description: "(geojson/parquet) boolean — enable point clustering (default false)",
  },
  clusterOptions: {
    description: "(geojson only) clustering configuration",
    children: {
      radius: { description: "cluster radius in pixels (default 50)" },
      maxZoom: { description: "max zoom to cluster at (default 14)" },
      minPoints: { description: "minimum points per cluster (default 2)" },
      colors: { description: '3-color array for small/medium/large clusters (default ["#22c55e","#eab308","#ef4444"])' },
    },
  },
  url: {
    description:
      '(mvt/raster) tile URL template with {z}/{x}/{y} placeholders. (pmtiles) URL to a .pmtiles file. IMPORTANT: if the URL ends in .pmtiles, ALWAYS use type "pmtiles", never "mvt" or "raster".',
  },
  sourceLayer: {
    description:
      '(mvt, required) name of the source layer within vector tiles. (pmtiles) required for vector PMTiles, omit for raster PMTiles.',
  },
  filter: {
    description:
      '(mvt/pmtiles) MapLibre filter expression to filter features (e.g. ["==", "type", "park"])',
  },
  tileSize: {
    description: "(raster/pmtiles) tile size in pixels (default 256)",
  },
  attribution: {
    description: "(raster/pmtiles) attribution text shown on the map",
  },
  minzoom: {
    description: "(mvt/raster/pmtiles) minimum zoom level to show this layer (0-24)",
  },
  maxzoom: {
    description: "(mvt/raster/pmtiles) maximum zoom level to show this layer (0-24)",
  },
};

const SPEC_FIELDS: Record<string, FieldDef> = {
  basemap: {
    description:
      '"light" | "dark" | "streets" (or a custom URL to a MapLibre style JSON)',
  },
  center: {
    description:
      "[longitude, latitude] — e.g. [-73.98, 40.75] for New York",
  },
  zoom: { description: "number (0-24, default ~10)" },
  pitch: { description: "number (0-85, tilt angle in degrees)" },
  bearing: { description: "number (-180 to 180, rotation in degrees)" },
  bounds: {
    description: "[west, south, east, north] — fit map to these bounds",
  },
  projection: {
    description:
      '"mercator" | "globe" — map projection (default "mercator", "globe" shows 3D sphere at low zoom)',
  },
  markers: {
    description: "named map of markers, each with:",
    children: MARKER_FIELDS,
  },
  layers: {
    description: "named map of layers (geojson or route), each with:",
    children: LAYER_FIELDS,
  },
  legend: {
    description: "named map of legend overlays, each with:",
    children: {
      layer: { description: "ID of the layer to derive legend from (required)" },
      title: { description: "legend title (defaults to layer ID)" },
      position: {
        description:
          '"top-left" | "top-right" | "bottom-left" | "bottom-right" (default "bottom-left")',
      },
    },
  },
  widgets: {
    description: "named map of overlay cards displayed on top of the map, each with:",
    children: {
      position: {
        description:
          '"top-left" | "top-right" | "bottom-left" | "bottom-right" (default "top-left")',
      },
      title: { description: "small uppercase label at the top of the card" },
      value: { description: "large prominent number or stat (e.g. \"2,847\")" },
      description: { description: "subtitle text below the value" },
      rows: {
        description: "array of { label, value, color? } key-value rows displayed in the card",
      },
      sql: {
        description: "SQL query config — when set, DuckDB-WASM runs queries against layer data in-browser",
        children: {
          query: { description: 'SQL query string. Table names = layer IDs (always double-quote them). Each table has all feature properties plus lng, lat, and geometry (GeoJSON string). Use $west, $east, $south, $north, $zoom for viewport bounds. DuckDB spatial is loaded — use ST_GeomFromGeoJSON(geometry) for spatial ops. IMPORTANT: for area/distance on lat/lng data, use ST_Area_Spheroid (returns m²) not ST_Area (returns degrees²). E.g. "SELECT COUNT(*) as count FROM \"quakes\" WHERE lng BETWEEN $west AND $east"' },
          refreshOn: { description: '"viewport" (re-runs on pan/zoom) or "once" (runs once on load). Default "once".' },
          debounce: { description: "debounce in ms for viewport queries. Default 0 (instant updates while panning)." },
        },
      },
    },
  },
  controls: {
    description: "map UI controls overlay",
    children: {
      zoom: { description: "show zoom in/out buttons (default true)" },
      compass: { description: "show compass/north arrow (default true)" },
      fullscreen: { description: "show fullscreen toggle (default false)" },
      locate: { description: "show locate-me button (default false)" },
      basemapSwitcher: { description: "show light/dark/streets toggle (default false)" },
      search: { description: "show geocoding search bar to find places (default false)" },
      layerSwitcher: { description: 'true OR { position?: "top-left"|"top-right"|"bottom-left"|"bottom-right" } — show layer visibility toggle panel. Panel opens downward from top corners, upward from bottom corners. Defaults to controls position.' },
      position: {
        description:
          '"top-left" | "top-right" | "bottom-left" | "bottom-right" (default "top-right")',
      },
    },
  },
};

/* ---- Prompt assembly ---- */

function formatFields(
  fields: Record<string, FieldDef>,
  indent = 0,
): string[] {
  const prefix = "  ".repeat(indent) + "- ";
  const lines: string[] = [];
  for (const [name, def] of Object.entries(fields)) {
    lines.push(`${prefix}${name}: ${def.description}`);
    if (def.children) {
      lines.push(...formatFields(def.children, indent + 1));
    }
  }
  return lines;
}

function formatPalettes(): string[] {
  // Group palettes by type based on known categories
  const sequential = [
    "Burg", "RedOr", "OrYel", "Peach", "PinkYl", "Mint", "BluGrn",
    "DarkMint", "Emrld", "BluYl", "Teal", "Purp", "Sunset", "SunsetDark",
    "Magenta",
  ];
  const diverging = [
    "TealRose", "Geyser", "Temps", "Fall", "ArmyRose", "Tropic",
  ];
  const categorical = ["Bold", "Pastel", "Antique", "Vivid", "Prism", "Safe"];

  // Only include palettes that actually exist in PALETTES
  const filter = (names: string[]) =>
    names.filter((n) => n in PALETTES);

  return [
    `- Sequential: ${filter(sequential).join(", ")}`,
    `- Diverging: ${filter(diverging).join(", ")}`,
    `- Categorical: ${filter(categorical).join(", ")}`,
  ];
}

function formatBasemaps(): string[] {
  const descriptions: Record<string, string> = {
    light: "clean light theme (CARTO Positron)",
    dark: "dark theme (CARTO Dark Matter)",
    streets: "street-level detail (CARTO Voyager)",
  };

  return Object.keys(BASEMAP_STYLES).map(
    (name) =>
      `- "${name}" — ${descriptions[name] ?? name}`,
  );
}

/* ---- Data-driven values documentation ---- */

const DATA_DRIVEN_DOCS = `Data-driven color (continuous):
  { "type": "continuous", "attr": "population", "palette": "Sunset", "domain": [0, 1000000] }
Data-driven color (categorical):
  { "type": "categorical", "attr": "type", "palette": "Bold", "categories": ["residential", "commercial"] }
Data-driven size (continuous):
  { "type": "continuous", "attr": "mag", "domain": [0, 8], "range": [2, 12] }`;

/* ---- Rules ---- */

const BASE_RULES = [
  "Output ONLY valid JSONL lines. No prose, no markdown, no explanation.",
  'Each line must be a valid JSON object with "op", "path", and "value" fields.',
  'Use "replace" op for changing existing fields, "add" for new fields.',
  'Path uses JSON Pointer syntax: "/basemap", "/center", "/zoom", "/markers/<id>", "/layers/<id>".',
  "When the user asks to show a location, set center to [longitude, latitude] and appropriate zoom.",
  "When changing themes/basemap, only change the basemap field.",
  "For city-level views use zoom 10-13, neighborhood zoom 14-16, street zoom 17-19.",
  'For markers, use "/markers/<id>" for individual markers.',
  'Give markers descriptive ids like "eiffel-tower", "central-park", etc.',
  "When adding markers for landmarks, include a tooltip for hover and a rich popup object with title and description. Only add a label if the user explicitly asks for permanent text below markers.",
  "Use varied colors for different markers to make them distinguishable.",
  'When markers represent specific categories (restaurants, hotels, parks, etc.), use the icon field with a supported icon name (kebab-case). For generic location pins, omit icon to use the default dot.',
  'For layers, use "/layers/<id>" to add GeoJSON layers. Use well-known public GeoJSON URLs when possible.',
  "When adding layers with data-driven color, always include the domain range for continuous palettes. For categorical color, ALWAYS include the categories array with the expected values — without it the colors will not vary.",
  "Include tooltip arrays for layers so users can inspect features on hover.",
  'When adding controls, use "/controls" path. Default shows zoom + compass at top-right. Only add controls when user requests interactive UI elements.',
  'For routes, use type "route" with EITHER a coordinates array of [lng, lat] pairs for manual paths, OR from/to fields for OSRM auto-routing that follows real roads. Use profile "driving", "walking", or "cycling" (default "driving"). Add waypoints array for intermediate stops. Optional style (color, width, opacity, dashed).',
  "When the user asks for clustering, set cluster: true on the geojson layer. Optionally include clusterOptions for radius, maxZoom, colors.",
  'For heatmaps, use type "heatmap" with a GeoJSON data source of Point features. Set weight to a numeric property for weighted density (e.g. "mag" for earthquake magnitude). Adjust radius (default 30) and intensity (default 1) for visual density. Use a sequential palette like OrYel, Sunset, or Burg.',
  'For vector tiles (MVT), use type "mvt" with a tile URL template containing {z}/{x}/{y} or a TileJSON URL. Always specify sourceLayer (the layer name inside the tiles). For Fused (fused.io) or udf.ai tile URLs, always use sourceLayer "udf". Style with the same LayerStyle system as GeoJSON (fillColor, lineColor, pointColor). Support data-driven color and tooltips from tile feature properties.',
  'For raster tiles (satellite imagery, terrain, etc.), use type "raster" with a tile URL template containing {z}/{x}/{y}. Set tileSize (default 256) and opacity. These are image tiles — no feature properties or tooltips.',
  'IMPORTANT: For PMTiles (.pmtiles files), ALWAYS use type "pmtiles". Never use "mvt" or "raster" for .pmtiles URLs. PMTiles is a cloud-optimized single-file tile archive — set url to the .pmtiles URL. For vector PMTiles, set sourceLayer to the layer name inside the archive. For raster PMTiles, omit sourceLayer. Style, tooltip, and filter work the same as MVT layers. When PMTiles metadata is provided in the prompt (source layer names, field names, bounds, center), USE it — set sourceLayer to the actual layer name, tooltip to actual field names, and center/zoom to match the data bounds.',
  'IMPORTANT: When the user provides a URL containing "parquet" (either ending in .parquet OR with dtype_out_vector=parquet as a query parameter), ALWAYS use type "parquet". Keep the URL exactly as given — do not modify the URL, path, or query parameters. For Fused/udf.ai URLs with dtype_out_vector=parquet, use the full URL as-is. Do NOT set center or zoom for parquet layers — the map auto-fits to the data bounds after loading. The geometry column is auto-detected from GeoParquet metadata. Style, tooltip, and clustering work the same as GeoJSON layers.',
  'When adding a legend, use "/legend/<id>" with layer (the layer ID to derive from) and optional title. Only add legend when the layer has data-driven color. Legend titles should be short and descriptive (e.g. "Magnitude", "Population") — never include palette names or color scheme names in the title.',
  'For widgets (stat cards / info overlays), use "/widgets/<id>". Include title (small label), value (big number), description (subtitle), and/or rows (key-value pairs). Use position to place them. Only add widgets when the user asks for dashboard-style overlays or stats on the map.',
  'For SQL-powered widgets, add a sql field with query and refreshOn. Table names in the query must match layer IDs. IMPORTANT: Always double-quote table names in SQL (e.g. FROM "india-states", FROM "quakes") — layer IDs often contain hyphens which DuckDB interprets as minus. Use {{column}} templates in value/description/rows to display query results. Use refreshOn "viewport" for live-updating stats as the user pans/zooms, and $west/$east/$south/$north/$zoom for viewport filtering in WHERE clauses. DuckDB-WASM loads lazily — only when a widget has sql.',
];

const COORDINATE_EXAMPLES = [
  "New York: [-73.98, 40.75]",
  "San Francisco: [-122.41, 37.77]",
  "London: [-0.12, 51.50]",
  "Tokyo: [139.69, 35.68]",
  "Paris: [2.35, 48.85]",
  "Sydney: [151.21, -33.87]",
  "Mumbai: [72.87, 19.07]",
  "Bangalore: [77.59, 12.97]",
  "Dubai: [55.27, 25.20]",
];

/* ---- Examples ---- */

const EXAMPLES: Array<{ prompt: string; output: string }> = [
  {
    prompt: "Show me Tokyo at night with landmarks",
    output: `{"op":"replace","path":"/basemap","value":"dark"}
{"op":"replace","path":"/center","value":[139.75,35.68]}
{"op":"replace","path":"/zoom","value":11}
{"op":"replace","path":"/pitch","value":45}
{"op":"add","path":"/markers/tokyo-tower","value":{"coordinates":[139.7454,35.6586],"color":"#e74c3c","icon":"landmark","tooltip":"Tokyo Tower · Minato","popup":{"title":"Tokyo Tower","description":"333m tall communications and observation tower, inspired by the Eiffel Tower"}}}
{"op":"add","path":"/markers/shibuya","value":{"coordinates":[139.7013,35.6580],"color":"#3498db","tooltip":"Shibuya Crossing · Shibuya","popup":{"title":"Shibuya Crossing","description":"World's busiest pedestrian crossing with up to 3,000 people per light change"}}}
{"op":"add","path":"/markers/senso-ji","value":{"coordinates":[139.7966,35.7148],"color":"#f39c12","icon":"church","tooltip":"Senso-ji · Asakusa","popup":{"title":"Senso-ji","description":"Tokyo's oldest temple, built in 645 AD. The iconic Kaminarimon gate is a symbol of Asakusa."}}}`,
  },
  {
    prompt: "Show recent earthquakes",
    output: `{"op":"replace","path":"/basemap","value":"dark"}
{"op":"replace","path":"/center","value":[-120,37]}
{"op":"replace","path":"/zoom","value":3}
{"op":"add","path":"/layers/quakes","value":{"type":"geojson","data":"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson","style":{"pointColor":{"type":"continuous","attr":"mag","palette":"OrYel","domain":[0,8]},"pointRadius":4,"opacity":0.8},"tooltip":["place","mag","time"]}}`,
  },
  {
    prompt: "Show a driving route from Times Square to Central Park",
    output: `{"op":"replace","path":"/center","value":[-73.975,40.765]}
{"op":"replace","path":"/zoom","value":14}
{"op":"add","path":"/markers/times-square","value":{"coordinates":[-73.9855,40.7580],"color":"#e74c3c","icon":"star","tooltip":"Times Square","popup":{"title":"Times Square","description":"The iconic intersection and entertainment hub of Midtown Manhattan"}}}
{"op":"add","path":"/markers/central-park","value":{"coordinates":[-73.9654,40.7829],"color":"#22c55e","icon":"tree-pine","tooltip":"Central Park","popup":{"title":"Central Park","description":"843-acre urban park in the heart of Manhattan"}}}
{"op":"add","path":"/layers/driving-route","value":{"type":"route","from":[-73.9855,40.7580],"to":[-73.9654,40.7829],"profile":"driving","style":{"color":"#3b82f6","width":4},"tooltip":"Driving route · Times Square → Central Park"}}`,
  },
  {
    prompt: "Show earthquake heatmap",
    output: `{"op":"replace","path":"/basemap","value":"dark"}
{"op":"replace","path":"/center","value":[-120,37]}
{"op":"replace","path":"/zoom","value":3}
{"op":"add","path":"/layers/quake-heat","value":{"type":"heatmap","data":"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson","weight":"mag","radius":25,"intensity":1.5,"palette":"Sunset"}}`,
  },
  {
    prompt: "Open this https://example.com/data.parquet",
    output: `{"op":"add","path":"/layers/data","value":{"type":"parquet","data":"https://example.com/data.parquet","style":{"fillColor":"#3b82f6","pointColor":"#3b82f6","opacity":0.7}}}`,
  },
  {
    prompt: "Open this https://unstable.udf.ai/fsh_abc123/run?dtype_out_vector=parquet in yellow",
    output: `{"op":"add","path":"/layers/data","value":{"type":"parquet","data":"https://unstable.udf.ai/fsh_abc123/run?dtype_out_vector=parquet","style":{"fillColor":"#eab308","pointColor":"#eab308","opacity":0.7}}}`,
  },
  {
    prompt: "Show Overture buildings in London",
    output: `{"op":"replace","path":"/basemap","value":"dark"}
{"op":"replace","path":"/center","value":[-0.12,51.50]}
{"op":"replace","path":"/zoom","value":13}
{"op":"add","path":"/layers/overture-buildings","value":{"type":"mvt","url":"https://unstable.udf.ai/fsh_2hMoO790LkKZoVGGytJRfG/run/tiles/{z}/{x}/{y}?dtype_out_vector=mvt","sourceLayer":"udf","style":{"fillColor":"#3b82f6","lineColor":"#1e3a5f","opacity":0.6},"tooltip":["name","class","subtype"]}}
{"op":"replace","path":"/controls","value":{"zoom":true,"layerSwitcher":true}}`,
  },
  {
    prompt: "Show earthquake dashboard with live stats",
    output: `{"op":"replace","path":"/basemap","value":"dark"}
{"op":"replace","path":"/center","value":[-120,37]}
{"op":"replace","path":"/zoom","value":3}
{"op":"add","path":"/layers/quakes","value":{"type":"geojson","data":"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson","style":{"pointColor":{"type":"continuous","attr":"mag","palette":"OrYel","domain":[0,8]},"pointRadius":4,"opacity":0.8},"tooltip":["place","mag","time"]}}
{"op":"add","path":"/widgets/stats","value":{"position":"top-left","title":"Earthquakes in View","sql":{"query":"SELECT COUNT(*) as count, ROUND(AVG(mag),1) as avg_mag, ROUND(MAX(mag),1) as max_mag FROM quakes WHERE lng BETWEEN $west AND $east AND lat BETWEEN $south AND $north","refreshOn":"viewport"},"value":"{{count}}","description":"Avg: {{avg_mag}} · Max: {{max_mag}}"}}
{"op":"add","path":"/legend/quake-legend","value":{"layer":"quakes","title":"Magnitude"}}`,
  },
  {
    prompt: "Show this https://data.source.coop/fiboa/us-usda-cropland/us_usda_cropland.pmtiles",
    output: `{"op":"replace","path":"/center","value":[-98,39]}
{"op":"replace","path":"/zoom","value":5}
{"op":"add","path":"/layers/cropland","value":{"type":"pmtiles","url":"https://data.source.coop/fiboa/us-usda-cropland/us_usda_cropland.pmtiles","sourceLayer":"us_usda_cropland","style":{"fillColor":{"type":"categorical","attr":"crop:name","palette":"Bold","categories":["Corn","Soybeans","Winter Wheat","Cotton","Alfalfa","Spring Wheat","Sorghum","Rice","Peanuts","Sunflower"]},"opacity":0.7},"tooltip":["crop:name","administrative_area_level_2"]}}`,
  },
];

/* ---- Public API ---- */

export interface SystemPromptOptions {
  customRules?: string[];
}

export function generateSystemPrompt(
  options: SystemPromptOptions = {},
): string {
  const { customRules = [] } = options;
  const lines: string[] = [];

  // Intro
  lines.push(
    "You are a map spec generator. You output ONLY valid JSONL (one JSON object per line). Each line is an RFC 6902 JSON Patch operation that modifies a MapSpec object.",
  );
  lines.push("");

  // Schema
  lines.push("The MapSpec has these fields:");
  lines.push(...formatFields(SPEC_FIELDS));
  lines.push("");

  // Data-driven values
  lines.push(DATA_DRIVEN_DOCS);
  lines.push("");

  // Palettes
  lines.push("Available palettes:");
  lines.push(...formatPalettes());
  lines.push("");

  // Basemaps
  lines.push("Available basemaps:");
  lines.push(...formatBasemaps());
  lines.push("");

  // Data sources from registry
  lines.push(generateRegistrySummary());
  lines.push("");

  // Rules
  lines.push("Rules:");
  const allRules = [...BASE_RULES, ...customRules];
  allRules.forEach((rule, i) => {
    lines.push(`${i + 1}. ${rule}`);
  });

  // Coordinate examples (appended to last rule)
  lines.push(
    `${allRules.length + 1}. Use realistic coordinates. Common examples:`,
  );
  for (const ex of COORDINATE_EXAMPLES) {
    lines.push(`   - ${ex}`);
  }
  lines.push("");

  // Examples
  for (const ex of EXAMPLES) {
    lines.push(`Example output for "${ex.prompt}":`);
    lines.push(ex.output);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
