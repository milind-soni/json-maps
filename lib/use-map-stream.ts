"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { type MapSpec } from "./spec";
import { autoFixSpec, formatSpecIssues } from "./spec-schema";

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

type ParsedLine =
  | { type: "patch"; patch: JsonPatch }
  | { type: "usage"; usage: TokenUsage }
  | { type: "text"; text: string }
  | null;

interface JsonPatch {
  op: "add" | "replace" | "remove";
  path: string;
  value?: unknown;
}

function parseLine(line: string): ParsedLine {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("//")) return null;

  // Skip markdown code fences the AI wraps around patches
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

    if (parsed.__meta === "error") {
      return { type: "text", text: `Error: ${parsed.message}` };
    }

    if (parsed.op && parsed.path) {
      return { type: "patch", patch: parsed as JsonPatch };
    }

    return null;
  } catch {
    // Non-JSON line = text from the AI
    return { type: "text", text: trimmed };
  }
}

function applyPatch(spec: MapSpec, patch: JsonPatch): MapSpec {
  const newSpec = { ...spec };
  const parts = patch.path.replace(/^\//, "").split("/");
  const topKey = parts[0] as string;

  if (parts.length === 1) {
    // Top-level: /basemap, /center, /markers, etc.
    if (patch.op === "remove") {
      delete (newSpec as Record<string, unknown>)[topKey];
    } else {
      (newSpec as Record<string, unknown>)[topKey] = patch.value;
    }
  } else if (parts.length === 2) {
    // Nested: /markers/home — set individual item within a map
    const subKey = parts[1] as string;
    const parent = { ...((newSpec as Record<string, unknown>)[topKey] as Record<string, unknown> ?? {}) };
    if (patch.op === "remove") {
      delete parent[subKey];
    } else {
      parent[subKey] = patch.value;
    }
    (newSpec as Record<string, unknown>)[topKey] = parent;
  } else if (parts.length >= 3) {
    // Deep nested: /markers/home/coordinates — set property within an item
    const subKey = parts[1] as string;
    const propPath = parts.slice(2);
    const parent = { ...((newSpec as Record<string, unknown>)[topKey] as Record<string, unknown> ?? {}) };
    const item = { ...(parent[subKey] as Record<string, unknown> ?? {}) };
    if (patch.op === "remove") {
      let target: Record<string, unknown> = item;
      for (let i = 0; i < propPath.length - 1; i++) {
        target = target[propPath[i]!] as Record<string, unknown>;
      }
      delete target[propPath[propPath.length - 1]!];
    } else {
      let target: Record<string, unknown> = item;
      for (let i = 0; i < propPath.length - 1; i++) {
        if (!target[propPath[i]!]) target[propPath[i]!] = {};
        target = target[propPath[i]!] as Record<string, unknown>;
      }
      target[propPath[propPath.length - 1]!] = patch.value;
    }
    parent[subKey] = item;
    (newSpec as Record<string, unknown>)[topKey] = parent;
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
  streamText: string;
  send: (prompt: string, context?: { previousSpec?: MapSpec; layerSchemas?: Record<string, unknown> }) => Promise<void>;
  stop: () => void;
  setSpec: (spec: MapSpec) => void;
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
  const [streamText, setStreamText] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const clear = useCallback(() => {
    setSpec({});
    setError(null);
  }, []);

  const send = useCallback(
    async (prompt: string, context?: { previousSpec?: MapSpec; layerSchemas?: Record<string, unknown> }) => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setIsStreaming(true);
      setError(null);
      setUsage(null);
      setRawLines([]);
      setStreamText("");

      let currentSpec: MapSpec = context?.previousSpec
        ? { ...context.previousSpec }
        : {};
      setSpec(currentSpec);

      // Stream patches from a single API call and apply them to currentSpec
      async function streamPatches(
        body: Record<string, unknown>,
      ): Promise<void> {
        const response = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: abortControllerRef.current!.signal,
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
            } else if (result.type === "text") {
              setStreamText((prev) => prev ? prev + "\n" + result.text : result.text);
            } else {
              setRawLines((prev) => [...prev, trimmed]);
              currentSpec = applyPatch(currentSpec, result.patch);
              setSpec({ ...currentSpec });
            }
          }
        }

        if (buffer.trim()) {
          const result = parseLine(buffer.trim());
          if (result) {
            if (result.type === "usage") {
              setUsage(result.usage);
            } else if (result.type === "text") {
              setStreamText((prev) => prev ? prev + "\n" + result.text : result.text);
            } else {
              setRawLines((prev) => [...prev, buffer.trim()]);
              currentSpec = applyPatch(currentSpec, result.patch);
              setSpec({ ...currentSpec });
            }
          }
        }
      }

      try {
        // Main generation pass
        await streamPatches({ prompt, context });

        // Auto-fix the final spec (strip unknown keys, coerce values)
        const fixed = autoFixSpec(currentSpec);
        if (fixed) {
          currentSpec = fixed as MapSpec;
          setSpec({ ...currentSpec });
        }

        // Repair pass: if spec still has validation errors, ask AI to fix them
        const issues = formatSpecIssues(currentSpec);
        if (issues) {
          await streamPatches({
            prompt: issues,
            context: { previousSpec: currentSpec },
          });

          // Auto-fix again after repair
          const repairFixed = autoFixSpec(currentSpec);
          if (repairFixed) {
            currentSpec = repairFixed as MapSpec;
            setSpec({ ...currentSpec });
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

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return { spec, isStreaming, error, usage, rawLines, streamText, send, stop, setSpec, clear };
}
