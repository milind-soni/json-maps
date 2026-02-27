import { jsonSchema, stepCountIs, streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { generateAnimationSystemPrompt } from "./animation-catalog";

export interface AnimationGenerateHandlerOptions {
  model?: string;
  temperature?: number;
}

/**
 * Creates a POST handler for AI animation generation.
 *
 * Usage in Next.js App Router:
 * ```ts
 * import { createAnimationGenerateHandler } from "json-maps/api";
 * export const POST = createAnimationGenerateHandler();
 * export const maxDuration = 60;
 * ```
 */
export function createAnimationGenerateHandler(options?: AnimationGenerateHandlerOptions) {
  const SYSTEM_PROMPT = generateAnimationSystemPrompt();
  const modelId = options?.model ?? "claude-haiku-4-5-20251001";
  const temperature = options?.temperature ?? 0.7;

  return async function POST(req: Request): Promise<Response> {
    try {
      const { prompt, context } = await req.json();

      let userPrompt = prompt;
      if (context?.previousAnimationSpec) {
        userPrompt = `CURRENT ANIMATION:\n${JSON.stringify(context.previousAnimationSpec)}\n\nUSER REQUEST: ${prompt}\n\nOutput the complete updated AnimationSpec JSON. Modify only what the user requested.`;
      }

      const result = streamText({
        model: anthropic(modelId),
        system: SYSTEM_PROMPT,
        messages: [{ role: "user" as const, content: userPrompt }],
        temperature,
        stopWhen: stepCountIs(5),
        tools: {
          geocode: {
            description:
              "Look up coordinates for a place name or address. Returns lat/lng and display name.",
            inputSchema: jsonSchema<{ query: string }>({
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description:
                    "Place name, address, or landmark to geocode",
                },
              },
              required: ["query"],
            }),
            execute: async ({ query }: { query: string }) => {
              const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
              const res = await fetch(url, {
                headers: { "User-Agent": "factmaps/1.0" },
              });
              const data = await res.json();
              if (!data.length) return { error: "No results found" };
              return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
                display_name: data[0].display_name,
              };
            },
          },
        },
      });

      const encoder = new TextEncoder();
      const fullStream = result.fullStream;

      const stream = new ReadableStream({
        async start(controller) {
          let hasOutput = false;
          try {
            for await (const event of fullStream) {
              if (event.type === "tool-call") {
                const meta = JSON.stringify({
                  __meta: "tool-call",
                  toolName: event.toolName,
                  args: event.input,
                });
                controller.enqueue(encoder.encode(`\n${meta}\n`));
              } else if (event.type === "tool-result") {
                const meta = JSON.stringify({
                  __meta: "tool-result",
                  toolName: event.toolName,
                  result: event.output,
                });
                controller.enqueue(encoder.encode(`\n${meta}\n`));
              } else if (event.type === "text-delta") {
                hasOutput = true;
                controller.enqueue(encoder.encode(event.text));
              } else if (event.type === "error") {
                hasOutput = true;
                const msg =
                  event.error instanceof Error
                    ? event.error.message
                    : String(event.error);
                console.error("[json-maps/animation-api] Stream error event:", msg);
                controller.enqueue(
                  encoder.encode(
                    `\n{"__meta":"error","message":${JSON.stringify(msg)}}\n`,
                  ),
                );
              } else if (event.type === "finish") {
                if (hasOutput && event.totalUsage) {
                  const meta = JSON.stringify({
                    __meta: "usage",
                    promptTokens: event.totalUsage.inputTokens,
                    completionTokens: event.totalUsage.outputTokens,
                    totalTokens: event.totalUsage.totalTokens,
                  });
                  controller.enqueue(encoder.encode(`\n${meta}\n`));
                }
              }
            }

            if (!hasOutput) {
              console.error("[json-maps/animation-api] Stream produced no output");
              controller.enqueue(
                encoder.encode(
                  `\n{"__meta":"error","message":"Animation generation failed — no output produced. Check API key."}\n`,
                ),
              );
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[json-maps/animation-api] Stream error:", msg);
            controller.enqueue(
              encoder.encode(
                `\n{"__meta":"error","message":${JSON.stringify(msg)}}\n`,
              ),
            );
          }
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[json-maps/animation-api] Route error:", msg);
      return Response.json({ message: msg }, { status: 500 });
    }
  };
}
