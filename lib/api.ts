import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { generateSystemPrompt } from "./catalog";
import { buildUserPrompt } from "./prompt";

export interface MapGenerateHandlerOptions {
  model?: string;
  temperature?: number;
}

/**
 * Creates a POST handler for AI map generation.
 *
 * Usage in Next.js App Router:
 * ```ts
 * import { createMapGenerateHandler } from "json-maps/api";
 * export const POST = createMapGenerateHandler();
 * export const maxDuration = 30;
 * ```
 */
export function createMapGenerateHandler(options?: MapGenerateHandlerOptions) {
  const SYSTEM_PROMPT = generateSystemPrompt();
  const modelId = options?.model ?? "claude-haiku-4-5-20251001";
  const temperature = options?.temperature ?? 0.7;

  return async function POST(req: Request): Promise<Response> {
    try {
      const { prompt, context } = await req.json();

      const userPrompt = buildUserPrompt(
        prompt,
        context?.previousSpec,
        context?.layerSchemas,
      );

      const result = streamText({
        model: anthropic(modelId),
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
        temperature,
      });

      const encoder = new TextEncoder();
      const fullStream = result.fullStream;

      const stream = new ReadableStream({
        async start(controller) {
          let hasOutput = false;
          try {
            for await (const event of fullStream) {
              if (event.type === "text-delta") {
                hasOutput = true;
                controller.enqueue(encoder.encode(event.text));
              } else if (event.type === "error") {
                hasOutput = true;
                const msg =
                  event.error instanceof Error
                    ? event.error.message
                    : String(event.error);
                console.error("[json-maps/api] Stream error event:", msg);
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
              console.error("[json-maps/api] Stream produced no output");
              controller.enqueue(
                encoder.encode(
                  `\n{"__meta":"error","message":"Generation failed — no output produced. Check API key."}\n`,
                ),
              );
            }
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : String(err);
            console.error("[json-maps/api] Stream error:", msg);
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
      console.error("[json-maps/api] Route error:", msg);
      return Response.json({ message: msg }, { status: 500 });
    }
  };
}
