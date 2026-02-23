import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { generateSystemPrompt } from "@/lib/catalog";
import { buildUserPrompt } from "@/lib/prompt";

export const maxDuration = 30;

const SYSTEM_PROMPT = generateSystemPrompt();

export async function POST(req: Request) {
  const { prompt, context } = await req.json();

  const userPrompt = buildUserPrompt(prompt, context?.previousSpec, context?.layerSchemas);

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
      try {
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[api/generate] Stream error:", msg);
        controller.enqueue(encoder.encode(`\n{"__meta":"error","message":${JSON.stringify(msg)}}\n`));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
