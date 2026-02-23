import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { generateSystemPrompt } from "@/lib/catalog";
import { buildUserPrompt } from "@/lib/prompt";
import { fetchPMTilesMeta } from "@/lib/pmtiles-meta";

export const maxDuration = 30;

const SYSTEM_PROMPT = generateSystemPrompt();

/** Extract .pmtiles URLs from text */
function extractPMTilesUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s"'<>]+\.pmtiles/gi);
  return matches ? [...new Set(matches)] : [];
}

/** Fetch PMTiles metadata and format as context for the AI */
async function buildPMTilesContext(urls: string[]): Promise<string> {
  const parts: string[] = [];
  for (const url of urls.slice(0, 3)) {
    try {
      const meta = await fetchPMTilesMeta(url);
      const lines: string[] = [`PMTiles metadata for ${url}:`];
      lines.push(`  Type: ${meta.tileType}`);
      if (meta.bounds) lines.push(`  Bounds: [${meta.bounds.join(", ")}]`);
      if (meta.center) lines.push(`  Center: [${meta.center.join(", ")}]`);
      lines.push(`  Zoom: ${meta.minZoom}-${meta.maxZoom}`);
      for (const layer of meta.layers) {
        lines.push(`  Source layer: "${layer.id}"`);
        const fieldNames = Object.keys(layer.fields);
        if (fieldNames.length > 0) {
          lines.push(`  Fields: ${fieldNames.join(", ")}`);
        }
      }
      parts.push(lines.join("\n"));
    } catch {
      // Skip URLs we can't read
    }
  }
  return parts.join("\n\n");
}

export async function POST(req: Request) {
  const { prompt, context } = await req.json();

  // Enrich prompt with PMTiles metadata if URLs are detected
  let enrichedPrompt = prompt as string;
  const pmtilesUrls = extractPMTilesUrls(prompt);
  if (pmtilesUrls.length > 0) {
    const metaContext = await buildPMTilesContext(pmtilesUrls);
    if (metaContext) {
      enrichedPrompt = `${prompt}\n\n${metaContext}`;
    }
  }

  const userPrompt = buildUserPrompt(enrichedPrompt, context?.previousSpec);

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
