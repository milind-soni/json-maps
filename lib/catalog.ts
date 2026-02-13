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
  type: { description: '"geojson" (required)' },
  data: {
    description:
      "URL string to a GeoJSON file OR inline GeoJSON object (required)",
  },
  style: {
    description: "styling options",
    children: LAYER_STYLE_FIELDS,
  },
  tooltip: {
    description:
      'array of property names to show on hover, e.g. ["name", "population"]',
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
  markers: {
    description: "named map of markers, each with:",
    children: MARKER_FIELDS,
  },
  layers: {
    description: "named map of GeoJSON layers, each with:",
    children: LAYER_FIELDS,
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
  "When adding markers for landmarks, include a label, a tooltip for hover, and a rich popup object with title and description.",
  "Use varied colors for different markers to make them distinguishable.",
  'For layers, use "/layers/<id>" to add GeoJSON layers. Use well-known public GeoJSON URLs when possible.',
  "When adding layers with data-driven color, always include the domain range for continuous palettes.",
  "Include tooltip arrays for layers so users can inspect features on hover.",
  'When adding controls, use "/controls" path. Default shows zoom + compass at top-right. Only add controls when user requests interactive UI elements.',
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
{"op":"replace","path":"/center","value":[139.69,35.68]}
{"op":"replace","path":"/zoom","value":12}
{"op":"replace","path":"/pitch","value":45}
{"op":"add","path":"/markers/tokyo-tower","value":{"coordinates":[139.7454,35.6586],"color":"#e74c3c","label":"Tokyo Tower","tooltip":"Observation tower · Minato","popup":{"title":"Tokyo Tower","description":"333m tall communications and observation tower, inspired by the Eiffel Tower"}}}
{"op":"add","path":"/markers/shibuya","value":{"coordinates":[139.7013,35.6580],"color":"#3498db","label":"Shibuya Crossing","tooltip":"Iconic scramble crossing · Shibuya","popup":{"title":"Shibuya Crossing","description":"World's busiest pedestrian crossing with up to 3,000 people per light change"}}}
{"op":"add","path":"/markers/senso-ji","value":{"coordinates":[139.7966,35.7148],"color":"#f39c12","label":"Senso-ji","tooltip":"Buddhist temple · Asakusa","popup":{"title":"Senso-ji","description":"Tokyo's oldest temple, built in 645 AD. The iconic Kaminarimon gate is a symbol of Asakusa."}}}`,
  },
  {
    prompt: "Show recent earthquakes",
    output: `{"op":"replace","path":"/basemap","value":"dark"}
{"op":"replace","path":"/center","value":[-120,37]}
{"op":"replace","path":"/zoom","value":3}
{"op":"add","path":"/layers/quakes","value":{"type":"geojson","data":"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson","style":{"pointColor":{"type":"continuous","attr":"mag","palette":"OrYel","domain":[0,8]},"pointRadius":4,"opacity":0.8},"tooltip":["place","mag","time"]}}`,
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
