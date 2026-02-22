"use client";

import { useState, useEffect } from "react";
import { decompressFromEncodedURIComponent } from "lz-string";
import { MapRenderer } from "@/components/map";
import { type MapSpec } from "@/lib/spec";

export default function EmbedPage() {
  const [spec, setSpec] = useState<MapSpec | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
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

  return (
    <div className="h-screen w-screen">
      <MapRenderer spec={spec} />
    </div>
  );
}
