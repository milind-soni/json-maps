"use client";

import { useState, useRef, useEffect } from "react";
import { MapRenderer } from "./map-renderer";
import { type MapSpec } from "@/lib/spec";

const DEFAULT_SPEC: MapSpec = {
  basemap: "dark",
  center: [77.59, 12.97],
  zoom: 11,
  pitch: 45,
  bearing: -17,
};
const DEFAULT_JSON = JSON.stringify(DEFAULT_SPEC, null, 2);

export function Playground() {
  const [jsonText, setJsonText] = useState(DEFAULT_JSON);
  const [spec, setSpec] = useState<MapSpec>(DEFAULT_SPEC);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      try {
        const parsed = JSON.parse(jsonText) as MapSpec;
        setSpec(parsed);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    }, 100);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [jsonText]);

  return (
    <div className="grid lg:grid-cols-2 gap-4 h-[calc(100vh-8rem)]">
      {/* JSON editor */}
      <div className="min-w-0 flex flex-col">
        <div className="flex items-center justify-between mb-2 h-6">
          <span className="text-xs font-mono text-foreground">spec.json</span>
          {error && (
            <span className="text-xs text-red-500 truncate ml-2">{error}</span>
          )}
        </div>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          spellCheck={false}
          className="flex-1 w-full border border-border rounded bg-background p-4 font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-border"
        />
      </div>

      {/* Map output */}
      <div className="min-w-0 flex flex-col">
        <div className="flex items-center mb-2 h-6">
          <span className="text-xs font-mono text-foreground">map preview</span>
        </div>
        <div className="flex-1 border border-border rounded overflow-hidden">
          <MapRenderer spec={spec} />
        </div>
      </div>
    </div>
  );
}
