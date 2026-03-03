"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapRenderer } from "../map";
import { useMap } from "../map/map-context";
import type { MapSpec } from "@/lib/spec";
import type {
  StoryRendererProps,
  StoryOverlay,
  StoryLayout,
  StoryTheme,
} from "@/lib/story-spec";
import { ScrollTracker } from "@/lib/scroll/scroll-tracker";
import { calcSceneProgress, parseDuration } from "@/lib/scroll/pin-engine";
import { lerp } from "@/lib/scroll/lerp";
import { clamp } from "@/lib/scroll/clamp";
import { EASINGS, easeInOut } from "@/lib/scroll/easing";
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
  let diff = ((b - a + 540) % 360) - 180;
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

/* ---- StoryDriver: lives inside MapRenderer, controls the camera ---- */

interface StoryDriverProps {
  view: { center: [number, number]; zoom: number; pitch: number; bearing: number };
  reducedMotion: boolean;
}

/** Damping factor: 0 = no movement, 1 = instant snap. 0.08 gives a smooth ~200ms feel. */
const DAMPING = 0.08;

function StoryDriver({ view, reducedMotion }: StoryDriverProps) {
  const { map, isLoaded } = useMap();
  const targetRef = useRef(view);
  const currentRef = useRef(view);
  const rafRef = useRef<number>(0);

  // Always update the target
  targetRef.current = view;

  useEffect(() => {
    if (!map || !isLoaded) return;

    // Initialize current to the first view
    currentRef.current = targetRef.current;
    map.jumpTo({
      center: currentRef.current.center,
      zoom: currentRef.current.zoom,
      pitch: currentRef.current.pitch,
      bearing: currentRef.current.bearing,
    });

    if (reducedMotion) {
      // No damping — just snap on each target change
      return;
    }

    function tick() {
      const target = targetRef.current;
      const cur = currentRef.current;

      // Lerp each property toward target
      const next = {
        center: [
          cur.center[0] + (target.center[0] - cur.center[0]) * DAMPING,
          cur.center[1] + (target.center[1] - cur.center[1]) * DAMPING,
        ] as [number, number],
        zoom: cur.zoom + (target.zoom - cur.zoom) * DAMPING,
        pitch: cur.pitch + (target.pitch - cur.pitch) * DAMPING,
        bearing: cur.bearing + (lerpBearing(cur.bearing, target.bearing, DAMPING) - cur.bearing),
      };

      currentRef.current = next;
      map!.jumpTo({
        center: next.center,
        zoom: next.zoom,
        pitch: next.pitch,
        bearing: next.bearing,
      });

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [map, isLoaded, reducedMotion]);

  // For reduced motion: snap directly when target changes
  useEffect(() => {
    if (!map || !isLoaded || !reducedMotion) return;
    map.jumpTo({
      center: view.center,
      zoom: view.zoom,
      pitch: view.pitch,
      bearing: view.bearing,
    });
  }, [map, isLoaded, view, reducedMotion]);

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
      ? "2.5rem"
      : overlay.style === "subtitle"
        ? "1.5rem"
        : "1rem";

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
        maxWidth: "80vw",
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

  // Refs for chapter spacer elements
  const spacerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Computed state
  const [activeIndex, setActiveIndex] = useState(0);
  const [chapterProgress, setChapterProgress] = useState(0);
  const [currentView, setCurrentView] = useState<{
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
  }>({
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

  // Notify parent of chapter changes
  const prevActiveIndex = useRef(0);
  useEffect(() => {
    if (activeIndex !== prevActiveIndex.current) {
      prevActiveIndex.current = activeIndex;
      onChapterChange?.(chapters[activeIndex]?.id ?? "", activeIndex);
    }
  }, [activeIndex, chapters, onChapterChange]);

  // Scroll tracking
  useEffect(() => {
    const tracker = new ScrollTracker();

    const unsubscribe = tracker.subscribe(({ scrollY, viewportHeight }) => {
      const vh = viewportHeight;

      let foundActive = false;

      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        const spacer = spacerRefs.current.get(chapter.id);
        if (!spacer) continue;

        const durationPx = parseDuration(chapter.duration ?? "150vh", vh);
        const offsetTop = spacer.offsetTop;
        const effectiveDuration = Math.max(1, durationPx - vh);
        const progress = calcSceneProgress(scrollY, offsetTop, effectiveDuration);

        if (progress > 0 && progress < 1) {
          foundActive = true;
          setActiveIndex(i);
          setChapterProgress(progress);

          // Accumulate specs
          let accSpec: Partial<MapSpec> = story.baseSpec ?? {};
          for (let j = 0; j <= i; j++) {
            if (chapters[j].spec) {
              accSpec = mergeSpecs(accSpec, chapters[j].spec as Partial<MapSpec>);
            }
          }

          // Camera interpolation: transition to next chapter starts at 30% progress
          const nextChapter = chapters[i + 1];
          let view: typeof currentView;

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

            // Merge next chapter's spec once transition is past halfway
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
          // Strip viewport fields from spec (camera is controlled by StoryDriver)
          const { center: _, zoom: _z, pitch: _p, bearing: _b, bounds: _bo, ...restSpec } = accSpec as MapSpec;
          setCurrentSpec(restSpec as MapSpec);
          setCurrentOverlay(chapter.overlay);
          break;
        }

        // If past this chapter entirely
        if (progress >= 1 && i === chapters.length - 1) {
          foundActive = true;
          setActiveIndex(i);
          setChapterProgress(1);

          let accSpec: Partial<MapSpec> = story.baseSpec ?? {};
          for (let j = 0; j <= i; j++) {
            if (chapters[j].spec) {
              accSpec = mergeSpecs(accSpec, chapters[j].spec as Partial<MapSpec>);
            }
          }

          setCurrentView({
            center: chapter.view.center,
            zoom: chapter.view.zoom,
            pitch: chapter.view.pitch ?? 0,
            bearing: chapter.view.bearing ?? 0,
          });
          const { center: _, zoom: _z, pitch: _p, bearing: _b, bounds: _bo, ...restSpec } = accSpec as MapSpec;
          setCurrentSpec(restSpec as MapSpec);
          setCurrentOverlay(chapter.overlay);
        }
      }

      // Global progress for progress bar
      if (chapters.length > 0) {
        const firstSpacer = spacerRefs.current.get(chapters[0].id);
        const lastSpacer = spacerRefs.current.get(chapters[chapters.length - 1].id);
        if (firstSpacer && lastSpacer) {
          const lastDuration = parseDuration(
            chapters[chapters.length - 1].duration ?? "150vh",
            vh,
          );
          const totalRange = lastSpacer.offsetTop + lastDuration - firstSpacer.offsetTop;
          const scrolledInRange = scrollY - firstSpacer.offsetTop;
          setGlobalProgress(totalRange > 0 ? clamp(scrolledInRange / totalRange, 0, 1) : 0);
        }
      }
    });

    tracker.start();
    return () => {
      unsubscribe();
      tracker.stop();
    };
  }, [chapters, story.baseSpec, reducedMotion]);

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
          <StoryDriver view={currentView} reducedMotion={reducedMotion} />
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
              alignItems: layout === "sidebar-right" ? "flex-end" : "flex-start",
              padding: "0 48px",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                maxWidth: "min(500px, 50vw)",
                padding: "32px 40px",
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
                  fontSize: "2.5rem",
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
                    fontSize: "1.15rem",
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

        {/* Chapter spacers + panels */}
        {chapters.map((chapter, i) => {
          const durationStr = chapter.duration ?? "150vh";

          return (
            <div
              key={chapter.id}
              ref={(el) => {
                if (el) spacerRefs.current.set(chapter.id, el);
              }}
              style={{
                height: durationStr,
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
                progress={i === activeIndex ? chapterProgress : i < activeIndex ? 1 : 0}
              />
            </div>
          );
        })}

        {/* Spacer at the end so last chapter scrolls fully into view */}
        <div style={{ height: "40vh" }} />
      </div>
    </div>
  );
}
