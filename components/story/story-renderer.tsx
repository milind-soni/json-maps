"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Scrollama, Step } from "react-scrollama";
import { MapRenderer } from "../map";
import { useMap } from "../map/map-context";
import type { MapSpec } from "@/lib/spec";
import type {
  StoryRendererProps,
  StoryOverlay,
  StoryLayout,
  StoryTheme,
} from "@/lib/story-spec";
import { lerp } from "@/lib/scroll/lerp";
import { clamp } from "@/lib/scroll/clamp";
import { EASINGS, easeInOut } from "@/lib/scroll/easing";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { StoryChapterPanel } from "./story-chapter-panel";
import { StoryProgressBar } from "./story-progress-bar";

/* ---- Helpers ---- */

function lerpCoord(
  a: [number, number],
  b: [number, number],
  t: number,
): [number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

/** Interpolate bearing along the shortest arc */
function lerpBearing(a: number, b: number, t: number): number {
  const diff = ((b - a + 540) % 360) - 180;
  return a + diff * t;
}

/** Shallow-merge two partial MapSpecs (layers/markers are Record-merged) */
function mergeSpecs(
  base: Partial<MapSpec>,
  overlay: Partial<MapSpec>,
): Partial<MapSpec> {
  const result = { ...base, ...overlay };
  if (base.markers || overlay.markers) {
    result.markers = { ...base.markers, ...overlay.markers };
  }
  if (base.layers || overlay.layers) {
    result.layers = { ...base.layers, ...overlay.layers };
  }
  if (base.legend || overlay.legend) {
    result.legend = { ...base.legend, ...overlay.legend };
  }
  if (base.widgets || overlay.widgets) {
    result.widgets = { ...base.widgets, ...overlay.widgets };
  }
  return result;
}

/** Check if user prefers reduced motion */
function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefers(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefers(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return prefers;
}

/* ---- Camera view type ---- */

interface CameraView {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

/* ---- StoryCamera: lives inside MapRenderer, controls the camera ---- */

function StoryCamera({ view }: { view: CameraView }) {
  const { map, isLoaded } = useMap();
  const isFirstRef = useRef(true);

  useEffect(() => {
    if (!map || !isLoaded) return;

    map.jumpTo({
      center: view.center,
      zoom: view.zoom,
      pitch: view.pitch,
      bearing: view.bearing,
    });
    isFirstRef.current = false;
  }, [map, isLoaded, view]);

  return null;
}

/* ---- Overlay display ---- */

function OverlayDisplay({
  overlay,
  theme,
}: {
  overlay: StoryOverlay;
  theme: StoryTheme;
}) {
  const isDark = theme === "dark";
  const positionStyle: React.CSSProperties =
    overlay.position === "top"
      ? { top: "80px", left: "50%", transform: "translateX(-50%)" }
      : overlay.position === "bottom"
        ? { bottom: "80px", left: "50%", transform: "translateX(-50%)" }
        : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  const fontSize =
    overlay.style === "title"
      ? "clamp(1.5rem, 5vw, 2.5rem)"
      : overlay.style === "subtitle"
        ? "clamp(1.1rem, 3vw, 1.5rem)"
        : "clamp(0.85rem, 2.5vw, 1rem)";

  return (
    <div
      style={{
        position: "absolute",
        ...positionStyle,
        zIndex: 10,
        padding: "12px 24px",
        backgroundColor: isDark
          ? "rgba(0,0,0,0.7)"
          : "rgba(255,255,255,0.85)",
        color: isDark ? "#fff" : "#1a1a1a",
        borderRadius: "8px",
        backdropFilter: "blur(8px)",
        fontSize,
        fontWeight: overlay.style === "title" ? 800 : overlay.style === "subtitle" ? 600 : 400,
        textAlign: "center",
        maxWidth: "min(80vw, 600px)",
        pointerEvents: "none",
      }}
    >
      {overlay.text}
    </div>
  );
}

/* ---- Main StoryRenderer ---- */

export function StoryRenderer({ story, className, onChapterChange }: StoryRendererProps) {
  const chapters = story.chapters;
  const theme: StoryTheme = story.theme ?? "light";
  const layout: StoryLayout = story.layout ?? "sidebar-left";
  const isMobile = useIsMobile();

  // Computed state
  const [activeIndex, setActiveIndex] = useState(0);
  const [chapterProgress, setChapterProgress] = useState(0);
  const [currentView, setCurrentView] = useState<CameraView>({
    center: chapters[0]?.view.center ?? [0, 0],
    zoom: chapters[0]?.view.zoom ?? 2,
    pitch: chapters[0]?.view.pitch ?? 0,
    bearing: chapters[0]?.view.bearing ?? 0,
  });
  const [currentSpec, setCurrentSpec] = useState<MapSpec>(
    (story.baseSpec as MapSpec) ?? {},
  );
  const [currentOverlay, setCurrentOverlay] = useState<StoryOverlay | undefined>();
  const [globalProgress, setGlobalProgress] = useState(0);

  const reducedMotion = usePrefersReducedMotion();

  /** Compute camera view and accumulated spec for a given chapter + progress */
  const computeViewAndSpec = useCallback(
    (i: number, progress: number) => {
      const chapter = chapters[i];
      if (!chapter) return;

      // Accumulate specs from baseSpec through current chapter
      let accSpec: Partial<MapSpec> = story.baseSpec ?? {};
      for (let j = 0; j <= i; j++) {
        if (chapters[j].spec) {
          accSpec = mergeSpecs(accSpec, chapters[j].spec as Partial<MapSpec>);
        }
      }

      // Camera interpolation: transition to next chapter starts at 30% progress
      const nextChapter = chapters[i + 1];
      let view: CameraView;

      if (nextChapter && progress > 0.3) {
        const transitionT = clamp((progress - 0.3) / 0.7, 0, 1);
        const easingFn = EASINGS[nextChapter.easing ?? "ease-in-out"] ?? easeInOut;
        const easedT = easingFn(transitionT);

        view = {
          center: lerpCoord(chapter.view.center, nextChapter.view.center, easedT),
          zoom: lerp(chapter.view.zoom, nextChapter.view.zoom, easedT),
          pitch: lerp(chapter.view.pitch ?? 0, nextChapter.view.pitch ?? 0, easedT),
          bearing: lerpBearing(
            chapter.view.bearing ?? 0,
            nextChapter.view.bearing ?? 0,
            easedT,
          ),
        };

        // Merge next chapter's spec once transition is past 60%
        if (nextChapter.spec && transitionT > 0.6) {
          accSpec = mergeSpecs(accSpec, nextChapter.spec as Partial<MapSpec>);
        }
      } else {
        view = {
          center: chapter.view.center,
          zoom: chapter.view.zoom,
          pitch: chapter.view.pitch ?? 0,
          bearing: chapter.view.bearing ?? 0,
        };
      }

      setCurrentView(view);

      // Strip viewport fields from spec (camera is controlled by StoryCamera)
      const { center: _, zoom: _z, pitch: _p, bearing: _b, bounds: _bo, ...restSpec } =
        accSpec as MapSpec;
      setCurrentSpec(restSpec as MapSpec);
      setCurrentOverlay(chapter.overlay);
    },
    [chapters, story.baseSpec],
  );

  // --- Scrollama callbacks ---

  const handleStepEnter = useCallback(
    ({ data }: { data: number }) => {
      setActiveIndex(data);
      onChapterChange?.(chapters[data]?.id ?? "", data);
    },
    [chapters, onChapterChange],
  );

  const handleStepProgress = useCallback(
    ({ data, progress }: { data: number; progress: number }) => {
      setActiveIndex(data);
      setChapterProgress(progress);
      computeViewAndSpec(data, progress);

      // Global progress
      setGlobalProgress(
        chapters.length > 1
          ? clamp((data + progress) / chapters.length, 0, 1)
          : progress,
      );
    },
    [chapters, computeViewAndSpec],
  );

  const handleStepExit = useCallback(
    ({ data, direction }: { data: number; direction: string }) => {
      // When scrolling past the last chapter
      if (direction === "down" && data === chapters.length - 1) {
        setChapterProgress(1);
        setGlobalProgress(1);
        computeViewAndSpec(data, 1);
      }
    },
    [chapters.length, computeViewAndSpec],
  );

  if (chapters.length === 0) return null;

  return (
    <div
      className={className}
      style={{ position: "relative", width: "100%" }}
      data-story-theme={theme}
    >
      {/* Progress bar */}
      <StoryProgressBar
        progress={chapterProgress}
        chapterCount={chapters.length}
        activeIndex={activeIndex}
        theme={theme}
      />

      {/* Fixed map background */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 0,
        }}
      >
        <MapRenderer
          spec={currentSpec}
          style={{ width: "100%", height: "100%" }}
        >
          <StoryCamera view={currentView} />
        </MapRenderer>
        {currentOverlay && (
          <OverlayDisplay overlay={currentOverlay} theme={theme} />
        )}
      </div>

      {/* Scrollable chapters */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Hero section */}
        {story.title && (
          <div
            style={{
              height: "100vh",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: isMobile
                ? "center"
                : layout === "sidebar-right"
                  ? "flex-end"
                  : "flex-start",
              padding: isMobile ? "0 16px" : "0 48px",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                maxWidth: isMobile ? "min(400px, 90vw)" : "min(500px, 50vw)",
                padding: isMobile ? "24px" : "32px 40px",
                backgroundColor:
                  theme === "dark"
                    ? "rgba(10, 10, 10, 0.92)"
                    : "rgba(255, 255, 255, 0.95)",
                color: theme === "dark" ? "#f0f0f0" : "#1a1a1a",
                backdropFilter: "blur(12px)",
                borderRadius: "12px",
                boxShadow:
                  theme === "dark"
                    ? "0 4px 24px rgba(0,0,0,0.5)"
                    : "0 4px 24px rgba(0,0,0,0.1)",
              }}
            >
              <h1
                style={{
                  fontSize: isMobile ? "1.75rem" : "2.5rem",
                  fontWeight: 800,
                  lineHeight: 1.1,
                  margin: "0 0 8px 0",
                }}
              >
                {story.title}
              </h1>
              {story.subtitle && (
                <p
                  style={{
                    fontSize: isMobile ? "0.95rem" : "1.15rem",
                    lineHeight: 1.5,
                    margin: "0 0 8px 0",
                    opacity: 0.7,
                  }}
                >
                  {story.subtitle}
                </p>
              )}
              {story.author && (
                <p
                  style={{
                    fontSize: "0.85rem",
                    opacity: 0.5,
                    margin: 0,
                  }}
                >
                  By {story.author}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Chapter spacers + panels (Scrollama-driven) */}
        <Scrollama
          offset={0.5}
          threshold={1}
          onStepEnter={handleStepEnter}
          onStepProgress={handleStepProgress}
          onStepExit={handleStepExit}
        >
          {chapters.map((chapter, i) => (
            <Step key={chapter.id} data={i}>
              <div
                style={{
                  height: chapter.duration ?? "150vh",
                  display: "flex",
                  alignItems: "center",
                  position: "relative",
                }}
              >
                <StoryChapterPanel
                  chapter={chapter}
                  isActive={i === activeIndex}
                  layout={layout}
                  theme={theme}
                  isMobile={isMobile}
                  progress={i === activeIndex ? chapterProgress : i < activeIndex ? 1 : 0}
                />
              </div>
            </Step>
          ))}
        </Scrollama>

        {/* Spacer at the end so last chapter scrolls fully into view */}
        <div style={{ height: "40vh" }} />
      </div>
    </div>
  );
}
