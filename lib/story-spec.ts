import type { MapSpec } from "./spec";

/* ---- Story theme ---- */

export type StoryTheme = "light" | "dark";

/* ---- Story layout ---- */

export type StoryLayout =
  | "sidebar-left"
  | "sidebar-right"
  | "overlay-center"
  | "overlay-left";

/* ---- Story easing ---- */

export type StoryEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

/* ---- Media attachment ---- */

export interface StoryMedia {
  type: "image" | "video";
  url: string;
  alt?: string;
  caption?: string;
}

/* ---- Text overlay on the map ---- */

export interface StoryOverlay {
  text: string;
  position: "top" | "bottom" | "center";
  style?: "title" | "subtitle" | "caption";
}

/* ---- Chapter ---- */

export interface StoryChapter {
  /** Unique identifier for this chapter (kebab-case) */
  id: string;
  /** Chapter heading displayed prominently */
  heading: string;
  /** Chapter body text (supports basic markdown: bold, italic, links, lists) */
  content: string;
  /** Optional media displayed within the chapter panel */
  media?: StoryMedia;
  /** Camera view when this chapter is active */
  view: {
    center: [number, number];
    zoom: number;
    pitch?: number;
    bearing?: number;
  };
  /** Easing for camera transition to this chapter (default "ease-in-out") */
  easing?: StoryEasing;
  /** Partial MapSpec changes — layers, markers, basemap to show at this chapter */
  spec?: Partial<MapSpec>;
  /** Optional text overlay on the map itself (not the chapter panel) */
  overlay?: StoryOverlay;
  /** Scroll distance for this chapter in viewport heights or pixels (default "150vh") */
  duration?: string;
}

/* ---- Story spec ---- */

/**
 * A scroll-driven map story. Each chapter controls the map camera,
 * visible layers, and narrative text. The entire story is a JSON object.
 */
export interface StorySpec {
  /** Story title displayed at the top/hero section */
  title?: string;
  /** Story subtitle */
  subtitle?: string;
  /** Story author attribution */
  author?: string;
  /** Visual theme — light or dark (default "light") */
  theme?: StoryTheme;
  /** Text panel layout (default "sidebar-left") */
  layout?: StoryLayout;
  /** Base MapSpec — initial map state before any chapter overrides */
  baseSpec?: MapSpec;
  /** Ordered list of story chapters (minimum 1) */
  chapters: StoryChapter[];
}

/* ---- StoryRenderer props ---- */

export interface StoryRendererProps {
  /** The story specification object */
  story: StorySpec;
  /** CSS class name applied to the outermost container */
  className?: string;
  /** Callback when the active chapter changes */
  onChapterChange?: (chapterId: string, index: number) => void;
}
