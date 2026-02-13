"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { CodeBlock } from "./code-block";
import { CopyButton } from "./copy-button";

const CARTO_LIGHT = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const CARTO_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const SIMULATION_PROMPT = "Show cafes near Times Square with a walking route";

interface MapSpec {
  viewport?: {
    center?: [number, number];
    zoom?: number;
  };
  layers?: Record<string, unknown>;
  markers?: Record<string, unknown>;
  controls?: Record<string, boolean>;
  legend?: Record<string, string>;
  state?: Record<string, unknown>;
}

interface SimulationStage {
  spec: MapSpec;
  stream: string;
}

const SIMULATION_STAGES: SimulationStage[] = [
  {
    spec: {
      viewport: { center: [-73.985, 40.758], zoom: 14 },
    },
    stream: '{"op":"add","path":"/viewport","value":{"center":[-73.985,40.758],"zoom":14}}',
  },
  {
    spec: {
      viewport: { center: [-73.985, 40.758], zoom: 14 },
      markers: {
        timesSquare: {
          position: [-73.9855, 40.758],
          label: "Times Square",
          popup: { title: "Times Square", body: "Starting point" },
        },
      },
    },
    stream:
      '{"op":"add","path":"/markers/timesSquare","value":{"position":[-73.9855,40.758],"label":"Times Square","popup":{"title":"Times Square","body":"Starting point"}}}',
  },
  {
    spec: {
      viewport: { center: [-73.985, 40.758], zoom: 14 },
      markers: {
        timesSquare: {
          position: [-73.9855, 40.758],
          label: "Times Square",
          popup: { title: "Times Square", body: "Starting point" },
        },
        bluBottle: {
          position: [-73.9826, 40.7544],
          label: "Blue Bottle Coffee",
        },
        stumptown: {
          position: [-73.9884, 40.7612],
          label: "Stumptown Coffee",
        },
      },
    },
    stream:
      '{"op":"add","path":"/markers/bluBottle","value":{"position":[-73.9826,40.7544],"label":"Blue Bottle Coffee"}}',
  },
  {
    spec: {
      viewport: { center: [-73.985, 40.758], zoom: 14 },
      markers: {
        timesSquare: {
          position: [-73.9855, 40.758],
          label: "Times Square",
          popup: { title: "Times Square", body: "Starting point" },
        },
        bluBottle: {
          position: [-73.9826, 40.7544],
          label: "Blue Bottle Coffee",
        },
        stumptown: {
          position: [-73.9884, 40.7612],
          label: "Stumptown Coffee",
        },
      },
      layers: {
        walkingRoute: {
          type: "route",
          coordinates: [
            [-73.9855, 40.758],
            [-73.9849, 40.7565],
            [-73.9826, 40.7544],
          ],
          color: "#3b82f6",
          width: 4,
        },
      },
    },
    stream:
      '{"op":"add","path":"/layers/walkingRoute","value":{"type":"route","coordinates":[[-73.9855,40.758],[-73.9849,40.7565],[-73.9826,40.7544]],"color":"#3b82f6","width":4}}',
  },
  {
    spec: {
      viewport: { center: [-73.985, 40.758], zoom: 14 },
      markers: {
        timesSquare: {
          position: [-73.9855, 40.758],
          label: "Times Square",
          popup: { title: "Times Square", body: "Starting point" },
        },
        bluBottle: {
          position: [-73.9826, 40.7544],
          label: "Blue Bottle Coffee",
        },
        stumptown: {
          position: [-73.9884, 40.7612],
          label: "Stumptown Coffee",
        },
      },
      layers: {
        walkingRoute: {
          type: "route",
          coordinates: [
            [-73.9855, 40.758],
            [-73.9849, 40.7565],
            [-73.9826, 40.7544],
          ],
          color: "#3b82f6",
          width: 4,
        },
      },
      controls: { zoom: true, compass: true },
    },
    stream:
      '{"op":"add","path":"/controls","value":{"zoom":true,"compass":true}}',
  },
];

const EXAMPLE_PROMPTS = [
  "Earthquake clusters on a world map",
  "Delivery route from warehouse to 3 stops",
  "US states colored by population",
  "Heatmap of bike accidents in NYC",
];

type Phase = "typing" | "streaming" | "complete";
type Tab = "spec" | "stream";

export function Demo() {
  const [phase, setPhase] = useState<Phase>("typing");
  const [typedPrompt, setTypedPrompt] = useState("");
  const [stageIndex, setStageIndex] = useState(-1);
  const [streamLines, setStreamLines] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("spec");
  const [simulationSpec, setSimulationSpec] = useState<MapSpec | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const currentSpec =
    stageIndex >= 0 ? SIMULATION_STAGES[stageIndex]?.spec : simulationSpec;

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
          setStageIndex(i);
          setStreamLines((prev) => [...prev, stage.stream]);
          setSimulationSpec(stage.spec);
        }
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => setPhase("complete"), 500);
      }
    }, 600);

    return () => clearInterval(interval);
  }, [phase]);

  const handleReplay = useCallback(() => {
    setPhase("typing");
    setTypedPrompt("");
    setStageIndex(-1);
    setStreamLines([]);
    setSimulationSpec(null);
  }, []);

  const isTyping = phase === "typing";
  const isStreaming = phase === "streaming";
  const showLoadingDots = isStreaming;

  const jsonCode = currentSpec
    ? JSON.stringify(currentSpec, null, 2)
    : "// waiting...";

  // Initialize MapLibre map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const isDark = document.documentElement.classList.contains("dark");

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: isDark ? CARTO_DARK : CARTO_LIGHT,
      center: [-73.985, 40.758],
      zoom: 14,
      attributionControl: false,
    });

    mapRef.current = map;

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      const nowDark = document.documentElement.classList.contains("dark");
      map.setStyle(nowDark ? CARTO_DARK : CARTO_LIGHT);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
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
          {EXAMPLE_PROMPTS.slice(0, 2).map((prompt) => (
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
        {/* Code panel */}
        <div className="min-w-0">
          <div className="flex items-center gap-4 mb-2 h-6 shrink-0">
            {(["spec", "stream"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-xs font-mono transition-colors ${
                  activeTab === tab
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
                  activeTab === "stream"
                    ? streamLines.join("\n")
                    : jsonCode
                }
                className="opacity-0 group-hover:opacity-100 text-muted-foreground"
              />
            </div>
            <div
              className={`overflow-auto ${activeTab === "stream" ? "" : "hidden"}`}
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
              className={`overflow-auto ${activeTab === "spec" ? "" : "hidden"}`}
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

        {/* Map preview panel */}
        <div className="min-w-0">
          <div className="flex items-center justify-between mb-2 h-6 shrink-0">
            <span className="text-xs font-mono text-foreground">
              map preview
            </span>
          </div>
          <div className="border border-border rounded overflow-hidden relative h-[28rem]">
            <div ref={mapContainerRef} className="w-full h-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
