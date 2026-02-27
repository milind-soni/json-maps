"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { AnimationSpec } from "./animation-spec";
import { autoFixAnimationSpec } from "./animation-spec-schema";
import type { TokenUsage, ToolCall } from "./use-map-stream";

type ParsedLine =
  | { type: "json"; data: Record<string, unknown> }
  | { type: "usage"; usage: TokenUsage }
  | { type: "tool-call"; toolCall: { toolName: string; args: Record<string, unknown> } }
  | { type: "tool-result"; toolResult: { toolName: string; result: unknown } }
  | { type: "text"; text: string }
  | null;

function parseLine(line: string): ParsedLine {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("//")) return null;
  if (/^```/.test(trimmed)) return null;

  try {
    const parsed = JSON.parse(trimmed);

    if (parsed.__meta === "usage") {
      return {
        type: "usage",
        usage: {
          promptTokens: parsed.promptTokens ?? 0,
          completionTokens: parsed.completionTokens ?? 0,
          totalTokens: parsed.totalTokens ?? 0,
        },
      };
    }

    if (parsed.__meta === "tool-call") {
      return { type: "tool-call", toolCall: { toolName: parsed.toolName, args: parsed.args } };
    }

    if (parsed.__meta === "tool-result") {
      return { type: "tool-result", toolResult: { toolName: parsed.toolName, result: parsed.result } };
    }

    if (parsed.__meta === "error") {
      return { type: "text", text: `Error: ${parsed.message}` };
    }

    return { type: "json", data: parsed };
  } catch {
    return { type: "text", text: trimmed };
  }
}

export interface UseAnimationStreamOptions {
  api: string;
  onComplete?: (spec: AnimationSpec) => void;
  onError?: (error: Error) => void;
}

export interface UseAnimationStreamReturn {
  animationSpec: AnimationSpec | null;
  isStreaming: boolean;
  error: Error | null;
  streamText: string;
  toolCalls: ToolCall[];
  send: (prompt: string, context?: Record<string, unknown>) => Promise<void>;
  stop: () => void;
  setAnimationSpec: (spec: AnimationSpec) => void;
}

const EMPTY_SPEC: AnimationSpec = {
  fps: 30,
  duration: 0,
  width: 1920,
  height: 1080,
  keyframes: [],
};

export function useAnimationStream({
  api,
  onComplete,
  onError,
}: UseAnimationStreamOptions): UseAnimationStreamReturn {
  const [animationSpec, setAnimationSpec] = useState<AnimationSpec | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [streamText, setStreamText] = useState("");
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (prompt: string, context?: Record<string, unknown>) => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setIsStreaming(true);
      setError(null);
      setStreamText("");
      setToolCalls([]);
      setAnimationSpec(null);

      // Collect ALL raw text from the stream, then parse the AnimationSpec at the end.
      // The AI outputs a complete JSON object (not patches like map generation).
      // We only extract metadata lines (tool calls, usage) during streaming.
      let rawText = "";

      try {
        const response = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, context }),
          signal: abortControllerRef.current!.signal,
        });

        if (!response.ok) {
          let errorMessage = `HTTP error: ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData.message) errorMessage = errorData.message;
            else if (errorData.error) errorMessage = errorData.error;
          } catch {
            // use default
          }
          throw new Error(errorMessage);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Only extract metadata lines; everything else is raw AnimationSpec JSON
            const result = parseLine(trimmed);
            if (!result) {
              rawText += line + "\n";
              continue;
            }

            if (result.type === "tool-call") {
              setToolCalls((prev) => [...prev, { ...result.toolCall }]);
              setStreamText((prev) => prev ? prev + "\n" + `Looking up ${(result.toolCall.args as { query?: string }).query ?? "..."}` : `Looking up ${(result.toolCall.args as { query?: string }).query ?? "..."}`);
            } else if (result.type === "tool-result") {
              setToolCalls((prev) => {
                const updated = [...prev];
                const last = updated.findLast((t) => t.toolName === result.toolResult.toolName && !t.result);
                if (last) last.result = result.toolResult.result;
                return updated;
              });
            } else if (result.type === "usage") {
              // skip, don't add to rawText
            } else {
              // text lines and json lines — all part of the AI response body
              rawText += line + "\n";
            }
          }
        }

        // Remaining buffer
        if (buffer.trim()) {
          rawText += buffer + "\n";
        }

        // Parse the full response as an AnimationSpec JSON
        let spec: AnimationSpec | null = null;

        // Strip markdown code fences if the AI wrapped the JSON
        let jsonText = rawText.trim();
        const fenceMatch = jsonText.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
        if (fenceMatch) {
          jsonText = fenceMatch[1]!.trim();
        }

        // Extract the outermost JSON object
        const braceStart = jsonText.indexOf("{");
        const braceEnd = jsonText.lastIndexOf("}");
        if (braceStart !== -1 && braceEnd > braceStart) {
          try {
            const parsed = JSON.parse(jsonText.slice(braceStart, braceEnd + 1));
            spec = autoFixAnimationSpec(parsed);
          } catch {
            // JSON parse failed
          }
        }

        // Fallback: try parsing the entire rawText
        if (!spec) {
          try {
            const parsed = JSON.parse(jsonText);
            spec = autoFixAnimationSpec(parsed);
          } catch {
            // Could not parse
          }
        }

        if (spec) {
          setAnimationSpec(spec);
          setStreamText("Animation ready.");
          onComplete?.(spec);
        } else {
          throw new Error("Failed to parse animation spec from AI response");
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
      } finally {
        setIsStreaming(false);
      }
    },
    [api, onComplete, onError],
  );

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    animationSpec,
    isStreaming,
    error,
    streamText,
    toolCalls,
    send,
    stop,
    setAnimationSpec,
  };
}
