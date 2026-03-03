"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { StoryRenderer } from "./story";
import type { StorySpec } from "@/lib/story-spec";
import { useStoryStream } from "@/lib/use-story-stream";
import { autoFixStorySpec } from "@/lib/story-spec-schema";

type Mode = "prompt" | "preview" | "edit";

const SUGGESTIONS = [
  "The Silk Road: Ancient trade routes from China to Rome",
  "Coffee's journey from Ethiopia to the world",
  "History of the Olympics — city by city",
  "Earthquakes along the Ring of Fire this week",
  "Climate change: rising sea levels around the globe",
  "The Space Race: launch sites and landing zones",
];

export function StoryPlayground() {
  const [mode, setMode] = useState<Mode>("prompt");
  const [storySpec, setStorySpec] = useState<StorySpec | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    storySpec: streamedSpec,
    isStreaming,
    error: streamError,
    streamText,
    toolCalls,
    send,
    stop,
  } = useStoryStream({
    api: "/api/story-generate",
    onComplete: (spec) => {
      setStorySpec(spec);
      setJsonText(JSON.stringify(spec, null, 2));
      setMode("preview");
    },
  });

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(
    (prompt: string) => {
      if (!prompt.trim() || isStreaming) return;
      setInput("");
      setMode("prompt"); // stay on prompt view during streaming
      send(prompt, storySpec ? { previousStorySpec: storySpec } : undefined);
    },
    [isStreaming, send, storySpec],
  );

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      handleSend(input);
    },
    [input, handleSend],
  );

  const handleJsonApply = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonText);
      const fixed = autoFixStorySpec(parsed);
      if (fixed) {
        setStorySpec(fixed as StorySpec);
        setJsonError(null);
        setMode("preview");
      } else {
        setJsonError("Invalid story spec — check chapters array and view fields");
      }
    } catch (e) {
      setJsonError((e as Error).message);
    }
  }, [jsonText]);

  const handleNewStory = useCallback(() => {
    setStorySpec(null);
    setJsonText("");
    setMode("prompt");
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Prompt / generating view
  if (mode === "prompt") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-2xl space-y-8">
          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Story Maps
            </h1>
            <p className="text-muted-foreground text-sm">
              Describe a story and AI will generate a scroll-driven map narrative
            </p>
          </div>

          {/* Streaming status */}
          {isStreaming && (
            <div className="rounded-lg border border-border bg-card p-6 space-y-4">
              {/* Tool calls */}
              {toolCalls.length > 0 && (
                <div className="space-y-1">
                  {toolCalls.map((tc, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs text-muted-foreground font-mono"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${tc.result ? "bg-green-500" : "bg-yellow-500 animate-pulse"}`}
                      />
                      {tc.toolName}({JSON.stringify(tc.args).slice(0, 60)})
                      {tc.result != null && " done"}
                    </div>
                  ))}
                </div>
              )}

              {/* Stream text preview */}
              {streamText ? (
                <div className="max-h-48 overflow-y-auto">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                    {streamText.slice(-800)}
                  </pre>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  Generating story...
                </div>
              )}

              <button
                onClick={stop}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Error */}
          {streamError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-500">
              {streamError.message}
            </div>
          )}

          {/* Suggestions */}
          {!isStreaming && !storySpec && (
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-xs px-3 py-1.5 rounded-full border bg-secondary font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              rows={1}
              placeholder="Describe a story map..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              disabled={isStreaming}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 pr-12 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground disabled:opacity-50 leading-relaxed"
            />
            <div className="absolute right-2 bottom-2">
              {isStreaming ? (
                <button
                  type="button"
                  onClick={stop}
                  className="bg-primary text-primary-foreground rounded-full p-1.5 hover:bg-primary/90 transition-colors"
                  aria-label="Stop"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="bg-primary text-primary-foreground rounded-full p-1.5 hover:bg-primary/90 transition-colors disabled:opacity-30"
                  aria-label="Send"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </button>
              )}
            </div>
          </form>

          {/* Quick actions if story already exists */}
          {storySpec && !isStreaming && (
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setMode("preview")}
                className="text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Back to Preview
              </button>
              <button
                onClick={() => {
                  setJsonText(JSON.stringify(storySpec, null, 2));
                  setMode("edit");
                }}
                className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Edit JSON
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Preview mode — full screen story
  if (mode === "preview" && storySpec) {
    return (
      <div className="relative">
        {/* Floating controls */}
        <div className="fixed top-4 right-4 z-[60] flex gap-2">
          <button
            onClick={() => {
              setMode("prompt");
              setTimeout(() => inputRef.current?.focus(), 100);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-background/90 border border-border backdrop-blur-sm hover:bg-background transition-colors shadow-sm"
          >
            Refine
          </button>
          <button
            onClick={() => {
              setJsonText(JSON.stringify(storySpec, null, 2));
              setMode("edit");
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-background/90 border border-border backdrop-blur-sm hover:bg-background transition-colors shadow-sm"
          >
            Edit JSON
          </button>
          <button
            onClick={handleNewStory}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-background/90 border border-border backdrop-blur-sm hover:bg-background transition-colors shadow-sm"
          >
            New Story
          </button>
        </div>

        <StoryRenderer story={storySpec} />
      </div>
    );
  }

  // Edit mode — JSON editor
  if (mode === "edit") {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Top bar */}
        <div className="sticky top-0 z-50 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => storySpec && setMode("preview")}
              disabled={!storySpec}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            >
              Preview
            </button>
            <span className="text-xs text-muted-foreground font-mono">story.json</span>
            {jsonError && (
              <span className="text-xs text-red-500 truncate max-w-xs">{jsonError}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleJsonApply}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Apply & Preview
            </button>
            <button
              onClick={() => {
                setMode("prompt");
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted transition-colors"
            >
              Back to AI
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 p-4">
          <textarea
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setJsonError(null);
            }}
            spellCheck={false}
            className="w-full h-full min-h-[calc(100vh-8rem)] border border-border rounded-lg bg-card p-4 font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}
