"use client";

import { useState, useEffect } from "react";
import { decompressFromEncodedURIComponent } from "lz-string";
import { MapRenderer } from "@/components/map";
import { useMap } from "@/components/map/map-context";
import { type MapSpec } from "@/lib/spec";

/** Signals screenshot readiness when MapLibre is idle (tiles loaded). */
function ScreenshotReadySignal() {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    const onIdle = () => {
      (window as unknown as Record<string, unknown>).__JSONMAPS_READY = true;
    };

    map.once("idle", onIdle);
    return () => { map.off("idle", onIdle); };
  }, [map, isLoaded]);

  return null;
}

export default function EmbedPage() {
  const [spec, setSpec] = useState<MapSpec | null>(null);
  const [ready, setReady] = useState(false);
  const [isScreenshot, setIsScreenshot] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(window.location.search);
    setIsScreenshot(params.get("screenshot") === "1");

    if (hash) {
      try {
        const raw = decompressFromEncodedURIComponent(hash);
        if (raw) setSpec(JSON.parse(raw) as MapSpec);
      } catch {
        // invalid hash
      }
    }
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="h-screen w-screen bg-background" />;
  }

  if (!spec) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background text-muted-foreground font-mono text-sm">
        No map spec found. Use a share URL from the playground.
      </div>
    );
  }

  // In screenshot mode, strip controls for a clean image
  const renderSpec = isScreenshot
    ? { ...spec, controls: undefined }
    : spec;

  return (
    <div className="h-screen w-screen">
      <MapRenderer spec={renderSpec}>
        {isScreenshot && <ScreenshotReadySignal />}
      </MapRenderer>
    </div>
  );
}
