"use client";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { MapRenderer, useMap } from "../map";
import type { MapSpec } from "../../lib/spec";
import type { AnimationSpec, TextOverlay } from "../../lib/animation-spec";
import {
  interpolateFrame,
  type InterpolatedView,
} from "../../lib/animation-interpolator";

/* ---- Public handle for external control ---- */

export interface AnimationPlayerHandle {
  play: () => void;
  pause: () => void;
  seek: (timeSeconds: number) => void;
  isPlaying: boolean;
  currentTime: number;
}

/* ---- Props ---- */

export interface AnimationPlayerProps {
  /** Base map spec (basemap, initial markers/layers, etc.) */
  mapSpec: MapSpec;
  /** Animation timeline with keyframes */
  animationSpec: AnimationSpec;
  className?: string;
  /** Playback speed multiplier (default 1) */
  speed?: number;
  /** Auto-play on mount (default false) */
  autoPlay?: boolean;
  /** Called every frame with current time in seconds */
  onTimeUpdate?: (time: number) => void;
  /** Called when animation finishes */
  onComplete?: () => void;
}

/* ---- Inner component that drives the animation (inside MapRenderer context) ---- */

interface AnimationDriverProps {
  animationSpec: AnimationSpec;
  baseSpec: MapSpec;
  speed: number;
  isPlaying: boolean;
  currentTime: number;
  onFrame: (time: number, view: InterpolatedView, spec: Partial<MapSpec>, overlay?: TextOverlay) => void;
  onFinish: () => void;
}

function AnimationDriver({
  animationSpec,
  baseSpec,
  speed,
  isPlaying,
  currentTime,
  onFrame,
  onFinish,
}: AnimationDriverProps) {
  const { map, isLoaded } = useMap();
  const rafRef = useRef<number>(0);
  const startWallTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(currentTime);

  // Keep refs current
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(speed);
  const onFrameRef = useRef(onFrame);
  const onFinishRef = useRef(onFinish);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { onFrameRef.current = onFrame; }, [onFrame]);
  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);

  // Apply a single frame to the map
  const applyFrame = useCallback(
    (timeSeconds: number) => {
      if (!map) return;

      const frame = interpolateFrame(animationSpec.keyframes, timeSeconds);

      map.jumpTo({
        center: frame.view.center,
        zoom: frame.view.zoom,
        pitch: frame.view.pitch,
        bearing: frame.view.bearing,
      });

      // Merge base spec with accumulated animation spec
      const mergedSpec: Partial<MapSpec> = {
        ...baseSpec,
        ...frame.spec,
        // Deep merge markers and layers
        markers: { ...baseSpec.markers, ...frame.spec.markers },
        layers: { ...baseSpec.layers, ...frame.spec.layers },
      };

      onFrameRef.current(timeSeconds, frame.view, mergedSpec, frame.overlay);
    },
    [map, animationSpec.keyframes, baseSpec],
  );

  // Animation loop
  useEffect(() => {
    if (!isPlaying || !map || !isLoaded) {
      pausedAtRef.current = currentTime;
      return;
    }

    startWallTimeRef.current = performance.now() - (pausedAtRef.current * 1000) / speedRef.current;

    const tick = (wallTime: number) => {
      if (!isPlayingRef.current) return;

      const elapsed = (wallTime - startWallTimeRef.current) * speedRef.current / 1000;
      const clampedTime = Math.min(elapsed, animationSpec.duration);

      applyFrame(clampedTime);
      pausedAtRef.current = clampedTime;

      if (clampedTime >= animationSpec.duration) {
        onFinishRef.current();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, map, isLoaded, animationSpec.duration, applyFrame, currentTime]);

  // Seek: apply single frame when not playing
  useEffect(() => {
    if (!isPlaying && map && isLoaded) {
      applyFrame(currentTime);
      pausedAtRef.current = currentTime;
    }
  }, [currentTime, isPlaying, map, isLoaded, applyFrame]);

  return null;
}

/* ---- Main AnimationPlayer component ---- */

export const AnimationPlayer = forwardRef<AnimationPlayerHandle, AnimationPlayerProps>(
  function AnimationPlayer(
    {
      mapSpec,
      animationSpec,
      className,
      speed = 1,
      autoPlay = false,
      onTimeUpdate,
      onComplete,
    },
    ref,
  ) {
    const [isPlaying, setIsPlaying] = useState(autoPlay);
    const [currentTime, setCurrentTime] = useState(0);
    const [activeSpec, setActiveSpec] = useState<MapSpec>(mapSpec);
    const [overlay, setOverlay] = useState<TextOverlay | undefined>();

    const onTimeUpdateRef = useRef(onTimeUpdate);
    const onCompleteRef = useRef(onComplete);
    useEffect(() => { onTimeUpdateRef.current = onTimeUpdate; }, [onTimeUpdate]);
    useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

    const handleFrame = useCallback(
      (time: number, _view: InterpolatedView, spec: Partial<MapSpec>, overlayText?: TextOverlay) => {
        setCurrentTime(time);
        setActiveSpec(spec as MapSpec);
        setOverlay(overlayText);
        onTimeUpdateRef.current?.(time);
      },
      [],
    );

    const handleFinish = useCallback(() => {
      setIsPlaying(false);
      onCompleteRef.current?.();
    }, []);

    const play = useCallback(() => {
      // If at end, restart
      if (currentTime >= animationSpec.duration) {
        setCurrentTime(0);
      }
      setIsPlaying(true);
    }, [currentTime, animationSpec.duration]);

    const pause = useCallback(() => {
      setIsPlaying(false);
    }, []);

    const seek = useCallback((time: number) => {
      const clamped = Math.max(0, Math.min(time, animationSpec.duration));
      setCurrentTime(clamped);
    }, [animationSpec.duration]);

    useImperativeHandle(ref, () => ({
      play,
      pause,
      seek,
      isPlaying,
      currentTime,
    }), [play, pause, seek, isPlaying, currentTime]);

    // Initial spec from first keyframe
    const initialSpec: MapSpec = {
      ...mapSpec,
      ...(animationSpec.keyframes[0]?.spec ?? {}),
      center: animationSpec.keyframes[0]?.view.center ?? mapSpec.center,
      zoom: animationSpec.keyframes[0]?.view.zoom ?? mapSpec.zoom,
      pitch: animationSpec.keyframes[0]?.view.pitch ?? mapSpec.pitch,
      bearing: animationSpec.keyframes[0]?.view.bearing ?? mapSpec.bearing,
    };

    return (
      <div className={className} style={{ position: "relative" }}>
        <MapRenderer spec={initialSpec} className="w-full h-full">
          <AnimationDriver
            animationSpec={animationSpec}
            baseSpec={mapSpec}
            speed={speed}
            isPlaying={isPlaying}
            currentTime={currentTime}
            onFrame={handleFrame}
            onFinish={handleFinish}
          />
        </MapRenderer>

        {/* Text overlay */}
        {overlay && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              pointerEvents: "none",
              zIndex: 10,
              ...(overlay.position === "top"
                ? { top: 40 }
                : overlay.position === "bottom"
                  ? { bottom: 40 }
                  : { top: "50%", transform: "translateY(-50%)" }),
            }}
          >
            <div
              style={{
                background: "rgba(0, 0, 0, 0.7)",
                color: "#fff",
                padding:
                  overlay.style === "title"
                    ? "16px 32px"
                    : overlay.style === "caption"
                      ? "8px 16px"
                      : "12px 24px",
                borderRadius: 8,
                fontFamily: "monospace",
                fontSize:
                  overlay.style === "title"
                    ? 32
                    : overlay.style === "caption"
                      ? 14
                      : 20,
                fontWeight: overlay.style === "title" ? 900 : 600,
                letterSpacing: overlay.style === "title" ? "-0.02em" : "0",
                maxWidth: "80%",
                textAlign: "center",
              }}
            >
              {overlay.text}
            </div>
          </div>
        )}
      </div>
    );
  },
);
