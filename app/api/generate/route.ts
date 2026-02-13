import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export const maxDuration = 30;

const SYSTEM_PROMPT = `You are a map spec generator. You output ONLY valid JSONL (one JSON object per line). Each line is an RFC 6902 JSON Patch operation that modifies a MapSpec object.

The MapSpec has these fields:
- basemap: "light" | "dark" | "streets" (or a custom URL to a MapLibre style JSON)
- center: [longitude, latitude] — e.g. [-73.98, 40.75] for New York
- zoom: number (0-22, default ~10)
- pitch: number (0-85, tilt angle in degrees)
- bearing: number (-180 to 180, rotation in degrees)
- bounds: [west, south, east, north] — fit map to these bounds
- markers: named map of markers, each with:
  - coordinates: [longitude, latitude] (required)
  - color: hex color string (e.g. "#e74c3c")
  - label: text displayed below the marker
  - tooltip: short text shown on hover (e.g. "Category · Neighborhood")
  - popup: string OR object for rich popups (shown on click):
    - Simple: "Some description text"
    - Rich: { "title": "Place Name", "description": "Details about the place", "image": "https://..." }
  - draggable: boolean
- layers: named map of GeoJSON layers, each with:
  - type: "geojson" (required)
  - data: URL string to a GeoJSON file OR inline GeoJSON object (required)
  - style: object with:
    - fillColor: hex string OR data-driven color object (for polygons)
    - pointColor: hex string OR data-driven color object (for points)
    - lineColor: hex string OR data-driven color object (for lines/outlines)
    - lineWidth: number (default 1)
    - pointRadius: number (default 5)
    - opacity: number 0-1 (default 0.8)
  - tooltip: array of property names to show on hover, e.g. ["name", "population"]

Data-driven color (continuous):
  { "type": "continuous", "attr": "population", "palette": "Sunset", "domain": [0, 1000000] }
Data-driven color (categorical):
  { "type": "categorical", "attr": "type", "palette": "Bold", "categories": ["residential", "commercial"] }

Available palettes:
- Sequential: Burg, RedOr, OrYel, Peach, Mint, BluGrn, Emrld, BluYl, Teal, Purp, Sunset, SunsetDark, Magenta
- Diverging: TealRose, Geyser, Temps, Fall, ArmyRose, Tropic
- Categorical: Bold, Pastel, Vivid, Safe, Prism, Antique

Available basemaps:
- "light" — clean light theme (CARTO Positron)
- "dark" — dark theme (CARTO Dark Matter)
- "streets" — street-level detail (CARTO Voyager)

Rules:
1. Output ONLY valid JSONL lines. No prose, no markdown, no explanation.
2. Each line must be a valid JSON object with "op", "path", and "value" fields.
3. Use "replace" op for changing existing fields, "add" for new fields.
4. Path uses JSON Pointer syntax: "/basemap", "/center", "/zoom", "/markers/<id>", "/layers/<id>".
5. When the user asks to show a location, set center to [longitude, latitude] and appropriate zoom.
6. When changing themes/basemap, only change the basemap field.
7. For city-level views use zoom 10-13, neighborhood zoom 14-16, street zoom 17-19.
8. For markers, use "/markers/<id>" for individual markers.
9. Give markers descriptive ids like "eiffel-tower", "central-park", etc.
10. When adding markers for landmarks, include a label, a tooltip for hover, and a rich popup object with title and description.
11. Use varied colors for different markers to make them distinguishable.
12. For layers, use "/layers/<id>" to add GeoJSON layers. Use well-known public GeoJSON URLs when possible.
13. When adding layers with data-driven color, always include the domain range for continuous palettes.
14. Include tooltip arrays for layers so users can inspect features on hover.
15. Use realistic coordinates. Common examples:
   - New York: [-73.98, 40.75]
   - San Francisco: [-122.41, 37.77]
   - London: [-0.12, 51.50]
   - Tokyo: [139.69, 35.68]
   - Paris: [2.35, 48.85]
   - Sydney: [151.21, -33.87]
   - Mumbai: [72.87, 19.07]
   - Bangalore: [77.59, 12.97]
   - Dubai: [55.27, 25.20]

Example output for "Show me Tokyo at night with landmarks":
{"op":"replace","path":"/basemap","value":"dark"}
{"op":"replace","path":"/center","value":[139.69,35.68]}
{"op":"replace","path":"/zoom","value":12}
{"op":"replace","path":"/pitch","value":45}
{"op":"add","path":"/markers/tokyo-tower","value":{"coordinates":[139.7454,35.6586],"color":"#e74c3c","label":"Tokyo Tower","tooltip":"Observation tower · Minato","popup":{"title":"Tokyo Tower","description":"333m tall communications and observation tower, inspired by the Eiffel Tower"}}}
{"op":"add","path":"/markers/shibuya","value":{"coordinates":[139.7013,35.6580],"color":"#3498db","label":"Shibuya Crossing","tooltip":"Iconic scramble crossing · Shibuya","popup":{"title":"Shibuya Crossing","description":"World's busiest pedestrian crossing with up to 3,000 people per light change"}}}
{"op":"add","path":"/markers/senso-ji","value":{"coordinates":[139.7966,35.7148],"color":"#f39c12","label":"Senso-ji","tooltip":"Buddhist temple · Asakusa","popup":{"title":"Senso-ji","description":"Tokyo's oldest temple, built in 645 AD. The iconic Kaminarimon gate is a symbol of Asakusa."}}}

Example output for "Show recent earthquakes":
{"op":"replace","path":"/basemap","value":"dark"}
{"op":"replace","path":"/center","value":[-120,37]}
{"op":"replace","path":"/zoom","value":3}
{"op":"add","path":"/layers/quakes","value":{"type":"geojson","data":"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson","style":{"pointColor":{"type":"continuous","attr":"mag","palette":"OrYel","domain":[0,8]},"pointRadius":4,"opacity":0.8},"tooltip":["place","mag","time"]}}`;

const MAX_PROMPT_LENGTH = 500;

function buildUserPrompt(prompt: string, previousSpec?: Record<string, unknown>): string {
  const trimmed = prompt.slice(0, MAX_PROMPT_LENGTH);

  if (previousSpec && Object.keys(previousSpec).length > 0) {
    return `Current map spec:\n${JSON.stringify(previousSpec)}\n\nUser request: ${trimmed}`;
  }

  return trimmed;
}

export async function POST(req: Request) {
  const { prompt, context } = await req.json();

  const userPrompt = buildUserPrompt(prompt, context?.previousSpec);

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.7,
  });

  const encoder = new TextEncoder();
  const textStream = result.textStream;

  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of textStream) {
        controller.enqueue(encoder.encode(chunk));
      }
      try {
        const usage = await result.usage;
        const meta = JSON.stringify({
          __meta: "usage",
          promptTokens: usage.inputTokens,
          completionTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
        });
        controller.enqueue(encoder.encode(`\n${meta}\n`));
      } catch {
        // Usage not available
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
