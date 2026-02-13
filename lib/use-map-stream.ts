"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { type MapSpec } from "./spec";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

type ParsedLine =
  | { type: "patch"; patch: JsonPatch }
  | { type: "usage"; usage: TokenUsage }
  | null;

interface JsonPatch {
  op: "add" | "replace" | "remove";
  path: string;
  value?: unknown;
}

function parseLine(line: string): ParsedLine {
  try {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) return null;
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

    return { type: "patch", patch: parsed as JsonPatch };
  } catch {
    return null;
  }
}

function applyPatch(spec: MapSpec, patch: JsonPatch): MapSpec {
  const newSpec = { ...spec };
  const key = patch.path.replace(/^\//, "") as keyof MapSpec;

  if (patch.op === "remove") {
    delete newSpec[key];
  } else {
    // add or replace
    (newSpec as Record<string, unknown>)[key] = patch.value;
  }

  return newSpec;
}

export interface UseMapStreamOptions {
  api: string;
  onComplete?: (spec: MapSpec) => void;
  onError?: (error: Error) => void;
}

export interface UseMapStreamReturn {
  spec: MapSpec;
  isStreaming: boolean;
  error: Error | null;
  usage: TokenUsage | null;
  rawLines: string[];
  send: (prompt: string, context?: { previousSpec?: MapSpec }) => Promise<void>;
  clear: () => void;
}

export function useMapStream({
  api,
  onComplete,
  onError,
}: UseMapStreamOptions): UseMapStreamReturn {
  const [spec, setSpec] = useState<MapSpec>({});
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [rawLines, setRawLines] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clear = useCallback(() => {
    setSpec({});
    setError(null);
  }, []);

  const send = useCallback(
    async (prompt: string, context?: { previousSpec?: MapSpec }) => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setIsStreaming(true);
      setError(null);
      setUsage(null);
      setRawLines([]);

      let currentSpec: MapSpec = context?.previousSpec
        ? { ...context.previousSpec }
        : {};
      setSpec(currentSpec);

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
            else if (errorData.error) errorMessage = errorData.error;
          } catch {
            // use default message
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
            const result = parseLine(trimmed);
            if (!result) continue;
            if (result.type === "usage") {
              setUsage(result.usage);
            } else {
              setRawLines((prev) => [...prev, trimmed]);
              currentSpec = applyPatch(currentSpec, result.patch);
              setSpec({ ...currentSpec });
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          const result = parseLine(buffer.trim());
          if (result) {
            if (result.type === "usage") {
              setUsage(result.usage);
            } else {
              setRawLines((prev) => [...prev, buffer.trim()]);
              currentSpec = applyPatch(currentSpec, result.patch);
              setSpec({ ...currentSpec });
            }
          }
        }

        onComplete?.(currentSpec);
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

  return { spec, isStreaming, error, usage, rawLines, send, clear };
}
