"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { StorySpec } from "./story-spec";
import { autoFixStorySpec, formatStorySpecIssues } from "./story-spec-schema";

export interface StoryToolCall {
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export interface UseStoryStreamOptions {
  api: string;
  onComplete?: (spec: StorySpec) => void;
  onError?: (error: Error) => void;
}

export interface UseStoryStreamReturn {
  storySpec: StorySpec | null;
  isStreaming: boolean;
  error: Error | null;
  streamText: string;
  toolCalls: StoryToolCall[];
  send: (prompt: string, context?: { previousStorySpec?: StorySpec }) => Promise<void>;
  stop: () => void;
  setStorySpec: (spec: StorySpec) => void;
}

/**
 * Extract JSON object from a text response that may contain markdown fences or prose.
 */
function extractJson(text: string): unknown | null {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // continue
  }

  // Try extracting from code fence
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch {
      // continue
    }
  }

  // Try finding first { ... } block
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(text.slice(braceStart, braceEnd + 1));
    } catch {
      // continue
    }
  }

  return null;
}

export function useStoryStream({
  api,
  onComplete,
  onError,
}: UseStoryStreamOptions): UseStoryStreamReturn {
  const [storySpec, setStorySpec] = useState<StorySpec | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [streamText, setStreamText] = useState("");
  const [toolCalls, setToolCalls] = useState<StoryToolCall[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (prompt: string, context?: { previousStorySpec?: StorySpec }) => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setIsStreaming(true);
      setError(null);
      setStreamText("");
      setToolCalls([]);
      setStorySpec(null);

      let accumulatedText = "";

      try {
        const response = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, context }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          let errorMessage = `HTTP error: ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData.message) errorMessage = errorData.message;
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

            // Check for metadata lines
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed.__meta === "tool-call") {
                setToolCalls((prev) => [
                  ...prev,
                  { toolName: parsed.toolName, args: parsed.args },
                ]);
                continue;
              }
              if (parsed.__meta === "tool-result") {
                setToolCalls((prev) => {
                  const updated = [...prev];
                  const last = updated.findLast(
                    (t) => t.toolName === parsed.toolName && !t.result,
                  );
                  if (last) last.result = parsed.result;
                  return updated;
                });
                continue;
              }
              if (parsed.__meta === "error") {
                throw new Error(parsed.message);
              }
              if (parsed.__meta === "usage") {
                continue;
              }
            } catch {
              // Not metadata, accumulate as text
            }

            accumulatedText += trimmed + "\n";
            setStreamText(accumulatedText);
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          accumulatedText += buffer.trim() + "\n";
          setStreamText(accumulatedText);
        }

        // Parse the accumulated text as a StorySpec
        const rawJson = extractJson(accumulatedText);
        if (!rawJson) {
          throw new Error("Failed to parse story spec from AI response");
        }

        // Auto-fix and validate
        let finalSpec = autoFixStorySpec(rawJson);
        if (!finalSpec) {
          // Try a repair pass
          const issues = formatStorySpecIssues(rawJson);
          if (issues) {
            // Could do a repair pass here in the future
            throw new Error(`Invalid story spec: ${issues}`);
          }
          throw new Error("Failed to validate story spec");
        }

        setStorySpec(finalSpec as StorySpec);
        onComplete?.(finalSpec as StorySpec);
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
    storySpec,
    isStreaming,
    error,
    streamText,
    toolCalls,
    send,
    stop,
    setStorySpec,
  };
}
