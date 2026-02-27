import type { MapSpec } from "./spec";

/* ---- Easing ---- */

export type EasingType = "linear" | "ease-in" | "ease-out" | "ease-in-out";

/* ---- Text overlay ---- */

export interface TextOverlay {
  text: string;
  position: "top" | "bottom" | "center";
  style?: "title" | "subtitle" | "caption";
}

/* ---- Keyframe ---- */

export interface AnimationKeyframe {
  /** Absolute time in seconds from start of animation */
  time: number;
  /** Duration in seconds to transition to this keyframe's state */
  duration: number;
  /** Easing function for the transition (default "ease-in-out") */
  easing?: EasingType;
  /** Camera state at this keyframe */
  view: {
    center: [number, number];
    zoom: number;
    pitch?: number;
    bearing?: number;
  };
  /** Optional MapSpec changes at this keyframe (markers, layers, basemap) — merged cumulatively */
  spec?: Partial<MapSpec>;
  /** Optional text overlay shown during this keyframe */
  overlay?: TextOverlay;
}

/* ---- Animation spec ---- */

export interface AnimationSpec {
  /** Frames per second (default 30) */
  fps: number;
  /** Total duration in seconds */
  duration: number;
  /** Export width in pixels (default 1920) */
  width: number;
  /** Export height in pixels (default 1080) */
  height: number;
  /** Ordered list of keyframes */
  keyframes: AnimationKeyframe[];
}
