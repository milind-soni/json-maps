import type { MapSpec } from "./spec";
import type { AnimationKeyframe, AnimationSpec, EasingType, TextOverlay } from "./animation-spec";

/* ---- Easing functions ---- */

function easeIn(t: number): number {
  return t * t;
}

function easeOut(t: number): number {
  return t * (2 - t);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function applyEasing(t: number, easing: EasingType = "ease-in-out"): number {
  const clamped = Math.max(0, Math.min(1, t));
  switch (easing) {
    case "linear":
      return clamped;
    case "ease-in":
      return easeIn(clamped);
    case "ease-out":
      return easeOut(clamped);
    case "ease-in-out":
      return easeInOut(clamped);
  }
}

/* ---- Number interpolation ---- */

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/* ---- Bearing interpolation (shortest path) ---- */

function lerpBearing(a: number, b: number, t: number): number {
  let diff = ((b - a + 540) % 360) - 180;
  return a + diff * t;
}

/* ---- Coordinate interpolation ---- */

function lerpCoord(
  a: [number, number],
  b: [number, number],
  t: number,
): [number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
}

/* ---- View state ---- */

export interface InterpolatedView {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface InterpolatedFrame {
  view: InterpolatedView;
  spec: Partial<MapSpec>;
  overlay?: TextOverlay;
}

/* ---- Core interpolation ---- */

/**
 * Given the keyframes and a time in seconds, compute the exact
 * map state (camera + spec + overlay) for that frame.
 */
export function interpolateFrame(
  keyframes: AnimationKeyframe[],
  timeSeconds: number,
): InterpolatedFrame {
  if (keyframes.length === 0) {
    return {
      view: { center: [0, 0], zoom: 2, pitch: 0, bearing: 0 },
      spec: {},
    };
  }

  // Before first keyframe — hold at first
  const first = keyframes[0]!;
  if (timeSeconds <= first.time) {
    return {
      view: {
        center: first.view.center,
        zoom: first.view.zoom,
        pitch: first.view.pitch ?? 0,
        bearing: first.view.bearing ?? 0,
      },
      spec: first.spec ?? {},
      overlay: first.overlay,
    };
  }

  // After last keyframe — hold at last
  const last = keyframes[keyframes.length - 1]!;
  if (timeSeconds >= last.time) {
    // Accumulate all specs up to last
    const accumulatedSpec = accumulateSpecs(keyframes, keyframes.length - 1);
    return {
      view: {
        center: last.view.center,
        zoom: last.view.zoom,
        pitch: last.view.pitch ?? 0,
        bearing: last.view.bearing ?? 0,
      },
      spec: accumulatedSpec,
      overlay: last.overlay,
    };
  }

  // Find surrounding keyframes
  let nextIdx = 1;
  while (nextIdx < keyframes.length && keyframes[nextIdx]!.time <= timeSeconds) {
    nextIdx++;
  }

  const prevKf = keyframes[nextIdx - 1]!;
  const nextKf = keyframes[nextIdx]!;

  // Calculate transition progress
  // The transition to nextKf starts at (nextKf.time - nextKf.duration)
  const transitionStart = nextKf.time - nextKf.duration;

  let view: InterpolatedView;

  if (timeSeconds < transitionStart) {
    // We're in the hold phase of prevKf (before nextKf's transition begins)
    view = {
      center: prevKf.view.center,
      zoom: prevKf.view.zoom,
      pitch: prevKf.view.pitch ?? 0,
      bearing: prevKf.view.bearing ?? 0,
    };
  } else {
    // We're in the transition phase toward nextKf
    const elapsed = timeSeconds - transitionStart;
    const rawT = nextKf.duration > 0 ? elapsed / nextKf.duration : 1;
    const t = applyEasing(rawT, nextKf.easing);

    view = {
      center: lerpCoord(prevKf.view.center, nextKf.view.center, t),
      zoom: lerp(prevKf.view.zoom, nextKf.view.zoom, t),
      pitch: lerp(prevKf.view.pitch ?? 0, nextKf.view.pitch ?? 0, t),
      bearing: lerpBearing(prevKf.view.bearing ?? 0, nextKf.view.bearing ?? 0, t),
    };
  }

  // Spec: accumulate all specs up to the current keyframe (discrete, not interpolated)
  const accumulatedSpec = accumulateSpecs(keyframes, nextIdx - 1);

  // Overlay: show the overlay from the most recent keyframe that has one
  let overlay: TextOverlay | undefined;
  for (let i = nextIdx - 1; i >= 0; i--) {
    if (keyframes[i]!.overlay) {
      overlay = keyframes[i]!.overlay;
      break;
    }
  }

  return { view, spec: accumulatedSpec, overlay };
}

/**
 * Accumulate MapSpec changes from keyframe 0 through `upToIndex`.
 * Each keyframe's spec is shallow-merged on top of previous.
 */
function accumulateSpecs(
  keyframes: AnimationKeyframe[],
  upToIndex: number,
): Partial<MapSpec> {
  let result: Partial<MapSpec> = {};
  for (let i = 0; i <= upToIndex; i++) {
    const kfSpec = keyframes[i]?.spec;
    if (kfSpec) {
      result = mergeSpecs(result, kfSpec);
    }
  }
  return result;
}

/**
 * Merge two partial MapSpecs. For markers/layers (Record types),
 * merge the records rather than replacing entirely.
 */
function mergeSpecs(base: Partial<MapSpec>, overlay: Partial<MapSpec>): Partial<MapSpec> {
  const merged = { ...base };

  for (const [key, value] of Object.entries(overlay)) {
    const k = key as keyof MapSpec;
    if (
      (k === "markers" || k === "layers" || k === "legend" || k === "widgets") &&
      typeof value === "object" &&
      value !== null
    ) {
      // Merge record types
      (merged as Record<string, unknown>)[k] = {
        ...((merged as Record<string, unknown>)[k] as Record<string, unknown> ?? {}),
        ...(value as Record<string, unknown>),
      };
    } else {
      (merged as Record<string, unknown>)[k] = value;
    }
  }

  return merged;
}

/* ---- Utility: total frame count ---- */

export function getTotalFrames(animationSpec: AnimationSpec): number {
  return Math.ceil(animationSpec.duration * animationSpec.fps);
}

export function frameToTime(frameIndex: number, fps: number): number {
  return frameIndex / fps;
}
