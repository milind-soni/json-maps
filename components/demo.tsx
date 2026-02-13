"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { CodeBlock } from "./code-block";
import { CopyButton } from "./copy-button";
import { MapRenderer } from "./map-renderer";
import { ExportModal } from "./export-modal";
import { type MapSpec } from "@/lib/spec";
import { generateStaticCode } from "@/lib/generate-code";

const SIMULATION_PROMPT = "Switch to a dark basemap";

interface SimulationStage {
  spec: MapSpec;
  stream: string;
}

const SIMULATION_STAGES: SimulationStage[] = [
  {
    spec: { basemap: "dark" },
    stream: '{"op":"replace","path":"/basemap","value":"dark"}',
  },
];

const EXAMPLE_PROMPTS = [
  "Use streets basemap",
  "Switch to light theme",
];

type Phase = "typing" | "streaming" | "complete";
type LeftTab = "spec" | "stream";
type RightTab = "live render" | "static code";

export function Demo() {
  const [phase, setPhase] = useState<Phase>("typing");
  const [typedPrompt, setTypedPrompt] = useState("");
  const [streamLines, setStreamLines] = useState<string[]>([]);
  const [leftTab, setLeftTab] = useState<LeftTab>("spec");
  const [rightTab, setRightTab] = useState<RightTab>("live render");
  const [currentSpec, setCurrentSpec] = useState<MapSpec>({ basemap: "light" });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Typing effect
  useEffect(() => {
    if (phase !== "typing") return;

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
  }, [phase]);

  // Streaming simulation
  useEffect(() => {
    if (phase !== "streaming") return;

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
        setTimeout(() => setPhase("complete"), 500);
      }
    }, 600);

    return () => clearInterval(interval);
  }, [phase]);

  // Fullscreen body scroll lock
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isFullscreen]);

  const handleReplay = useCallback(() => {
    setPhase("typing");
    setTypedPrompt("");
    setStreamLines([]);
    setCurrentSpec({ basemap: "light" });
  }, []);

  const isTyping = phase === "typing";
  const isStreaming = phase === "streaming";
  const showLoadingDots = isStreaming;

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
              if (phase === "complete") {
                inputRef.current?.focus();
              }
            }}
          >
            <div className="flex items-center flex-1">
              <span className="inline-flex items-center h-5">
                {typedPrompt}
              </span>
              {isTyping && (
                <span className="inline-block w-2 h-4 bg-foreground ml-0.5 animate-pulse" />
              )}
            </div>
            {phase === "complete" ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleReplay();
                }}
                className="ml-2 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                aria-label="Replay"
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
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
              </button>
            ) : (
              <div className="ml-2 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  stroke="none"
                >
                  <rect x="6" y="6" width="12" height="12" />
                </svg>
              </div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
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
