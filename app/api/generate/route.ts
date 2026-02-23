import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { generateSystemPrompt } from "@/lib/catalog";
import { buildUserPrompt } from "@/lib/prompt";

export const maxDuration = 30;

const SYSTEM_PROMPT = generateSystemPrompt();

export async function POST(req: Request) {
  try {
    const { prompt, context } = await req.json();

    const userPrompt = buildUserPrompt(prompt, context?.previousSpec, context?.layerSchemas);

    const result = streamText({
      model: anthropic("claude-haiku-4-5-20251001"),
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.7,
    });

    const encoder = new TextEncoder();

    // Use the full stream which includes error events, not just textStream
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
              hasOutput = true; // prevent duplicate "no output" message
              const msg = event.error instanceof Error ? event.error.message : String(event.error);
              console.error("[api/generate] Stream error event:", msg);
              controller.enqueue(
                encoder.encode(`\n{"__meta":"error","message":${JSON.stringify(msg)}}\n`),
              );
            } else if (event.type === "finish") {
              // Append usage from finish event
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
            console.error("[api/generate] Stream produced no output");
            controller.enqueue(
              encoder.encode(`\n{"__meta":"error","message":"Generation failed — no output produced. Check API key."}\n`),
            );
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[api/generate] Stream error:", msg);
          controller.enqueue(
            encoder.encode(`\n{"__meta":"error","message":${JSON.stringify(msg)}}\n`),
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
    console.error("[api/generate] Route error:", msg);
    return Response.json({ message: msg }, { status: 500 });
  }
}
