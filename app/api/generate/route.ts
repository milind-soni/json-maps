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

Available basemaps:
- "light" — clean light theme (CARTO Positron)
- "dark" — dark theme (CARTO Dark Matter)
- "streets" — street-level detail (CARTO Voyager)

Rules:
1. Output ONLY valid JSONL lines. No prose, no markdown, no explanation.
2. Each line must be a valid JSON object with "op", "path", and "value" fields.
3. Use "replace" op for changing existing fields, "add" for new fields.
4. The path uses JSON Pointer syntax: "/basemap", "/center", "/zoom", "/pitch", "/bearing", "/bounds".
5. When the user asks to show a location, set center to [longitude, latitude] and appropriate zoom.
6. When changing themes/basemap, only change the basemap field.
7. For city-level views use zoom 10-13, neighborhood zoom 14-16, street zoom 17-19.
8. Use realistic coordinates. Common examples:
   - New York: [-73.98, 40.75]
   - San Francisco: [-122.41, 37.77]
   - London: [-0.12, 51.50]
   - Tokyo: [139.69, 35.68]
   - Paris: [2.35, 48.85]
   - Sydney: [151.21, -33.87]
   - Mumbai: [72.87, 19.07]
   - Bangalore: [77.59, 12.97]
   - Dubai: [55.27, 25.20]

Example output for "Show me Tokyo at night with a tilted view":
{"op":"replace","path":"/basemap","value":"dark"}
{"op":"replace","path":"/center","value":[139.69,35.68]}
{"op":"replace","path":"/zoom","value":12}
{"op":"replace","path":"/pitch","value":45}
{"op":"replace","path":"/bearing","value":0}`;

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
