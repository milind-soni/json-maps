"use client";

import { useState, useRef } from "react";
import { decompressFromEncodedURIComponent } from "lz-string";
import { MapRenderer } from "@/components/map";
import { type MapSpec } from "@/lib/spec";

function readSpecFromHash(): MapSpec | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  try {
    const raw = decompressFromEncodedURIComponent(hash);
    if (!raw) return null;
    return JSON.parse(raw) as MapSpec;
  } catch {
    return null;
  }
}

export default function EmbedPage() {
  const fromHash = useRef(readSpecFromHash());
  const [spec] = useState<MapSpec | null>(fromHash.current);

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
