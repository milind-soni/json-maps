"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { compressToEncodedURIComponent } from "lz-string";
import posthog from "posthog-js";
import { CodeBlock } from "./code-block";
import { CopyButton } from "./copy-button";
import { MapRenderer } from "./map";
import { ExportModal } from "./export-modal";
import { type MapSpec } from "@/lib/spec";
import { generateStaticCode } from "@/lib/generate-code";
import { useMapStream } from "@/lib/use-map-stream";
import { layerDataCache } from "@/lib/layer-data-cache";

const SIMULATION_PROMPT = "Show me Tokyo at night with landmarks";

interface SimulationStage {
  spec: MapSpec;
  stream: string;
}

const SIMULATION_STAGES: SimulationStage[] = [
  {
    spec: { basemap: "dark" },
    stream: '{"op":"replace","path":"/basemap","value":"dark"}',
  },
  {
    spec: { basemap: "dark", center: [139.75, 35.68] },
    stream: '{"op":"replace","path":"/center","value":[139.75,35.68]}',
  },
  {
    spec: { basemap: "dark", center: [139.75, 35.68], zoom: 11 },
    stream: '{"op":"replace","path":"/zoom","value":11}',
  },
  {
    spec: { basemap: "dark", center: [139.75, 35.68], zoom: 11, pitch: 45 },
    stream: '{"op":"replace","path":"/pitch","value":45}',
  },
  {
    spec: {
      basemap: "dark",
      center: [139.75, 35.68],
      zoom: 11,
      pitch: 45,
      markers: {
        "tokyo-tower": {
          coordinates: [139.7454, 35.6586],
          color: "#e74c3c",
          label: "Tokyo Tower",
          tooltip: "Observation tower · Minato",
          popup: {
            title: "Tokyo Tower",
            description: "333m tall communications and observation tower, inspired by the Eiffel Tower",
          },
        },
      },
    },
    stream:
      '{"op":"add","path":"/markers/tokyo-tower","value":{"coordinates":[139.7454,35.6586],"color":"#e74c3c","label":"Tokyo Tower","tooltip":"Observation tower · Minato","popup":{"title":"Tokyo Tower","description":"333m tall communications and observation tower, inspired by the Eiffel Tower"}}}',
  },
  {
    spec: {
      basemap: "dark",
      center: [139.75, 35.68],
      zoom: 11,
      pitch: 45,
      markers: {
        "tokyo-tower": {
          coordinates: [139.7454, 35.6586],
          color: "#e74c3c",
          label: "Tokyo Tower",
          tooltip: "Observation tower · Minato",
          popup: {
            title: "Tokyo Tower",
            description: "333m tall communications and observation tower, inspired by the Eiffel Tower",
          },
        },
        shibuya: {
          coordinates: [139.7013, 35.658],
          color: "#3498db",
          label: "Shibuya Crossing",
          tooltip: "Iconic scramble crossing · Shibuya",
          popup: {
            title: "Shibuya Crossing",
            description: "World's busiest pedestrian crossing with up to 3,000 people per light change",
          },
        },
      },
    },
    stream:
      '{"op":"add","path":"/markers/shibuya","value":{"coordinates":[139.7013,35.6580],"color":"#3498db","label":"Shibuya Crossing","tooltip":"Iconic scramble crossing · Shibuya","popup":{"title":"Shibuya Crossing","description":"World\'s busiest pedestrian crossing with up to 3,000 people per light change"}}}',
  },
  {
    spec: {
      basemap: "dark",
      center: [139.75, 35.68],
      zoom: 11,
      pitch: 45,
      markers: {
        "tokyo-tower": {
          coordinates: [139.7454, 35.6586],
          color: "#e74c3c",
          label: "Tokyo Tower",
          tooltip: "Observation tower · Minato",
          popup: {
            title: "Tokyo Tower",
            description: "333m tall communications and observation tower, inspired by the Eiffel Tower",
          },
        },
        shibuya: {
          coordinates: [139.7013, 35.658],
          color: "#3498db",
          label: "Shibuya Crossing",
          tooltip: "Iconic scramble crossing · Shibuya",
          popup: {
            title: "Shibuya Crossing",
            description: "World's busiest pedestrian crossing with up to 3,000 people per light change",
          },
        },
        "senso-ji": {
          coordinates: [139.7966, 35.7148],
          color: "#f39c12",
          label: "Senso-ji",
          tooltip: "Buddhist temple · Asakusa",
          popup: {
            title: "Senso-ji",
            description: "Tokyo's oldest temple, built in 645 AD. The iconic Kaminarimon gate is a symbol of Asakusa.",
          },
        },
      },
    },
    stream:
      '{"op":"add","path":"/markers/senso-ji","value":{"coordinates":[139.7966,35.7148],"color":"#f39c12","label":"Senso-ji","tooltip":"Buddhist temple · Asakusa","popup":{"title":"Senso-ji","description":"Tokyo\'s oldest temple, built in 645 AD. The iconic Kaminarimon gate is a symbol of Asakusa."}}}',
  },
];

const EXAMPLE_PROMPTS = [
  "Show recent earthquakes worldwide",
  "Fly to Paris with a tilted view",
  "Route from Times Square to Central Park",
  "India states choropleth by population",
];

type Mode = "simulation" | "interactive";
type Phase = "typing" | "streaming" | "complete";
type LeftTab = "spec" | "stream";
type RightTab = "live render" | "static code";

export function Demo() {
  const [mode, setMode] = useState<Mode>("simulation");
  const [phase, setPhase] = useState<Phase>("typing");
  const [typedPrompt, setTypedPrompt] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [streamLines, setStreamLines] = useState<string[]>([]);
  const [leftTab, setLeftTab] = useState<LeftTab>("spec");
  const [rightTab, setRightTab] = useState<RightTab>("live render");
  const [currentSpec, setCurrentSpec] = useState<MapSpec>({ basemap: "light" });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    spec: apiSpec,
    isStreaming: apiStreaming,
    send,
    clear,
    rawLines: apiRawLines,
    error: apiError,
  } = useMapStream({
    api: "/api/generate",
    onError: (err: Error) => {
      console.error("Generation error:", err);
    },
  });

  // Typing effect for simulation
  useEffect(() => {
    if (mode !== "simulation" || phase !== "typing") return;

    let i = 0;
    const interval = setInterval(() => {
      if (i < SIMULATION_PROMPT.length) {
        setTypedPrompt(SIMULATION_PROMPT.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => setPhase("streaming"), 500);
      }
    }, 20);

    return () => clearInterval(interval);
  }, [mode, phase]);

  // Streaming simulation
  useEffect(() => {
    if (mode !== "simulation" || phase !== "streaming") return;

    let i = 0;
    const interval = setInterval(() => {
      if (i < SIMULATION_STAGES.length) {
        const stage = SIMULATION_STAGES[i];
        if (stage) {
          setStreamLines((prev) => [...prev, stage.stream]);
          setCurrentSpec(stage.spec);
        }
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setPhase("complete");
          setMode("interactive");
          setUserPrompt("");
        }, 500);
      }
    }, 600);

    return () => clearInterval(interval);
  }, [mode, phase]);

  // Track API stream lines and spec
  useEffect(() => {
    if (mode === "interactive" && apiRawLines.length > 0) {
      setStreamLines(apiRawLines);
    }
  }, [mode, apiRawLines]);

  useEffect(() => {
    if (mode === "interactive" && apiSpec && Object.keys(apiSpec).length > 0) {
      setCurrentSpec(apiSpec);
    }
  }, [mode, apiSpec]);

  // Listen for spec updates from global chat sidebar
  useEffect(() => {
    const handleChatSpec = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        spec: MapSpec;
        rawLines: string[];
        isStreaming: boolean;
      };
      // Switch to interactive mode if still in simulation
      if (mode === "simulation") {
        setMode("interactive");
        setPhase("complete");
        setTypedPrompt(SIMULATION_PROMPT);
      }
      setCurrentSpec(detail.spec);
      setStreamLines(detail.rawLines);
    };
    window.addEventListener("globalchat:spec", handleChatSpec);
    return () => window.removeEventListener("globalchat:spec", handleChatSpec);
  }, [mode]);

  // Fullscreen body scroll lock
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isFullscreen]);

  const handleScreenshot = useCallback(async () => {
    setScreenshotLoading(true);
    try {
      const compressed = compressToEncodedURIComponent(JSON.stringify(currentSpec, null, 2));
      const res = await fetch(`/api/screenshot?spec=${compressed}&width=1280&height=720&scale=2`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "map-screenshot.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setScreenshotLoading(false);
    }
  }, [currentSpec]);

  const stopGeneration = useCallback(() => {
    if (mode === "simulation") {
      setMode("interactive");
      setPhase("complete");
      setTypedPrompt(SIMULATION_PROMPT);
      setUserPrompt("");
    }
    clear();
  }, [mode, clear]);

  const handleSubmit = useCallback(async () => {
    if (!userPrompt.trim() || apiStreaming) return;
    posthog.capture("prompt_submitted", { prompt: userPrompt });
    setStreamLines([]);
    const schemas = layerDataCache.getSchemas();
    await send(userPrompt, {
      previousSpec: currentSpec,
      layerSchemas: Object.keys(schemas).length > 0 ? schemas : undefined,
    });
  }, [userPrompt, apiStreaming, send, currentSpec]);

  const handleExampleClick = useCallback(
    (prompt: string) => {
      if (mode === "simulation") {
        setMode("interactive");
        setPhase("complete");
      }
      setUserPrompt(prompt);
      setTimeout(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(prompt.length, prompt.length);
        }
      }, 0);
    },
    [mode],
  );

  const isTypingSimulation = mode === "simulation" && phase === "typing";
  const isStreamingSimulation = mode === "simulation" && phase === "streaming";
  const showLoadingDots = isStreamingSimulation || apiStreaming;

  const jsonCode = JSON.stringify(currentSpec, null, 2);
  const staticCode = generateStaticCode(currentSpec);

  return (
    <>
      <div className="w-full text-left max-w-5xl mx-auto">
        {/* Prompt input */}
        <div className="mb-6">
          <div
            className="border border-border rounded p-3 bg-background font-mono text-sm min-h-[44px] flex items-center justify-between cursor-text"
            onClick={() => {
              if (mode === "simulation") {
                setMode("interactive");
                setPhase("complete");
                setUserPrompt("");
                setTimeout(() => inputRef.current?.focus(), 0);
              } else {
                inputRef.current?.focus();
              }
            }}
          >
            {mode === "simulation" ? (
              <div className="flex items-center flex-1">
                <span className="inline-flex items-center h-5">
                  {typedPrompt}
                </span>
                {isTypingSimulation && (
                  <span className="inline-block w-2 h-4 bg-foreground ml-0.5 animate-pulse" />
                )}
              </div>
            ) : (
              <form
                className="flex items-center flex-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit();
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="Describe your map..."
                  className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground/50 text-sm"
                  disabled={apiStreaming}
                  maxLength={500}
                />
              </form>
            )}
            {mode === "simulation" || apiStreaming ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  stopGeneration();
                }}
                className="ml-2 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                aria-label="Stop"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  stroke="none"
                >
                  <rect x="6" y="6" width="12" height="12" />
                </svg>
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSubmit();
                }}
                disabled={!userPrompt.trim()}
                className="ml-2 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-30"
                aria-label="Submit"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14" />
                  <path d="M12 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
          {apiError && (
            <div className="mt-2 text-xs text-red-500 text-center">
              {apiError.message}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
            {EXAMPLE_PROMPTS.slice(0, 2).map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleExampleClick(prompt)}
                className="text-xs px-2 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Code panel (left) */}
          <div className="min-w-0">
            <div className="flex items-center gap-4 mb-2 h-6 shrink-0">
              {(["spec", "stream"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setLeftTab(tab)}
                  className={`text-xs font-mono transition-colors ${
                    leftTab === tab
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="border border-border rounded bg-background font-mono text-xs text-left grid relative group h-[28rem]">
              <div className="absolute top-2 right-2 z-10">
                <CopyButton
                  text={
                    leftTab === "stream"
                      ? streamLines.join("\n")
                      : jsonCode
                  }
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground"
                />
              </div>
              <div
                className={`overflow-auto ${leftTab === "stream" ? "" : "hidden"}`}
              >
                {streamLines.length > 0 ? (
                  <>
                    <CodeBlock
                      code={streamLines.join("\n")}
                      lang="json"
                      fillHeight
                      hideCopyButton
                    />
                    {showLoadingDots && (
                      <div className="flex gap-1 p-3 pt-0">
                        <span className="w-1 h-1 bg-muted-foreground rounded-full animate-pulse" />
                        <span className="w-1 h-1 bg-muted-foreground rounded-full animate-pulse [animation-delay:75ms]" />
                        <span className="w-1 h-1 bg-muted-foreground rounded-full animate-pulse [animation-delay:150ms]" />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-muted-foreground/50 p-3 h-full">
                    {showLoadingDots ? "streaming..." : "waiting..."}
                  </div>
                )}
              </div>
              <div
                className={`overflow-auto ${leftTab === "spec" ? "" : "hidden"}`}
              >
                <CodeBlock
                  code={jsonCode}
                  lang="json"
                  fillHeight
                  hideCopyButton
                />
              </div>
            </div>
          </div>

          {/* Preview panel (right) */}
          <div className="min-w-0">
            <div className="flex items-center justify-between mb-2 h-6 shrink-0">
              <div className="flex items-center gap-4">
                {(["live render", "static code"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setRightTab(tab)}
                    className={`text-xs font-mono transition-colors ${
                      rightTab === tab
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {/* Share button — opens playground with this spec */}
                <button
                  onClick={() => {
                    const compressed = compressToEncodedURIComponent(
                      JSON.stringify(currentSpec, null, 2)
                    );
                    window.open(`/playground#${compressed}`, "_blank");
                  }}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Share"
                  title="Open in playground"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </button>
                {/* Embed button — opens clean map in new tab */}
                <button
                  onClick={() => {
                    const compressed = compressToEncodedURIComponent(
                      JSON.stringify(currentSpec, null, 2)
                    );
                    window.open(`/embed#${compressed}`, "_blank");
                  }}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Embed"
                  title="Open embed view"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                </button>
                {/* Export button */}
                <button
                  onClick={() => setShowExport(true)}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Export"
                  title="Export project"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
                {/* Screenshot button */}
                <button
                  onClick={handleScreenshot}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Screenshot"
                  title="Download as PNG"
                  disabled={screenshotLoading}
                >
                  {screenshotLoading ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="animate-spin"
                    >
                      <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10" />
                    </svg>
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                      <circle cx="12" cy="13" r="3" />
                    </svg>
                  )}
                </button>
                {/* Fullscreen button */}
                <button
                  onClick={() => setIsFullscreen(true)}
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Fullscreen"
                  title="Fullscreen"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Live render */}
            <div
              className={`border border-border rounded overflow-hidden relative h-[28rem] ${
                rightTab === "live render" ? "" : "hidden"
              }`}
            >
              <MapRenderer spec={currentSpec} />
            </div>

            {/* Static code */}
            <div
              className={`border border-border rounded bg-background font-mono text-xs text-left relative group h-[28rem] overflow-auto ${
                rightTab === "static code" ? "" : "hidden"
              }`}
            >
              <div className="absolute top-2 right-2 z-10">
                <CopyButton
                  text={staticCode}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground"
                />
              </div>
              <CodeBlock
                code={staticCode}
                lang="tsx"
                fillHeight
                hideCopyButton
              />
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col text-left">
          <div className="flex items-center justify-between px-6 h-14 border-b border-border shrink-0">
            <span className="text-sm font-mono">render</span>
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-1.5 rounded hover:bg-muted transition-colors"
              aria-label="Close fullscreen"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="flex-1">
            <MapRenderer spec={currentSpec} />
          </div>
        </div>
      )}

      {/* Export modal */}
      {showExport && (
        <ExportModal spec={currentSpec} onClose={() => setShowExport(false)} />
      )}
    </>
  );
}
