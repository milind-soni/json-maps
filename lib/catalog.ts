import { PALETTES } from "./palettes";
import { BASEMAP_STYLES } from "./spec";

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
      'lucide icon name in kebab-case (e.g. "coffee", "hotel", "utensils", "landmark", "train", "plane", "hospital", "school", "church", "shopping-cart", "fuel", "parking-meter", "tree-pine", "mountain", "waves", "music", "camera", "heart", "star", "flag", "map-pin", "building-2", "warehouse", "factory", "tent", "bike", "ship", "bus", "car")',
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
  glow: { description: "boolean — adds colored pulse ring and glow shadow" },
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
  type: { description: '"geojson" or "route" (required)' },
  data: {
    description:
      '(geojson only) URL string to a GeoJSON file OR inline GeoJSON object',
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
      'geojson: array of property names to show on hover, e.g. ["name", "population"]. route: string shown on hover, e.g. "Walking route · 2.5 km"',
  },
  cluster: {
    description: "(geojson only) boolean — enable point clustering (default false)",
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
  controls: {
    description: "map UI controls overlay",
    children: {
      zoom: { description: "show zoom in/out buttons (default true)" },
      compass: { description: "show compass/north arrow (default true)" },
      fullscreen: { description: "show fullscreen toggle (default false)" },
      locate: { description: "show locate-me button (default false)" },
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
  'When markers represent specific categories (restaurants, hotels, parks, etc.), use the icon field with a relevant lucide icon name (kebab-case). For generic location pins, omit icon to use the default dot.',
  'For layers, use "/layers/<id>" to add GeoJSON layers. Use well-known public GeoJSON URLs when possible.',
  "When adding layers with data-driven color, always include the domain range for continuous palettes.",
  "Include tooltip arrays for layers so users can inspect features on hover.",
  'When adding controls, use "/controls" path. Default shows zoom + compass at top-right. Only add controls when user requests interactive UI elements.',
  'For routes, use type "route" with EITHER a coordinates array of [lng, lat] pairs for manual paths, OR from/to fields for OSRM auto-routing that follows real roads. Use profile "driving", "walking", or "cycling" (default "driving"). Add waypoints array for intermediate stops. Optional style (color, width, opacity, dashed).',
  "When the user asks for clustering, set cluster: true on the geojson layer. Optionally include clusterOptions for radius, maxZoom, colors.",
  'When adding a legend, use "/legend/<id>" with layer (the layer ID to derive from) and optional title. Only add legend when the layer has data-driven color. Legend titles should be short and descriptive (e.g. "Magnitude", "Population") — never include palette names or color scheme names in the title.',
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
{"op":"add","path":"/markers/tokyo-tower","value":{"coordinates":[139.7454,35.6586],"color":"#e74c3c","icon":"tower-control","tooltip":"Tokyo Tower · Minato","popup":{"title":"Tokyo Tower","description":"333m tall communications and observation tower, inspired by the Eiffel Tower"}}}
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
