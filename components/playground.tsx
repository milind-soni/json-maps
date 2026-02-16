"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import { MapRenderer } from "./map";
import { CodeBlock } from "./code-block";
import { CopyButton } from "./copy-button";
import { ExportModal } from "./export-modal";
import { type MapSpec } from "@/lib/spec";
import { validateSpec } from "@/lib/spec-schema";
import { generateStaticCode } from "@/lib/generate-code";

const DEFAULT_SPEC: MapSpec = {
  basemap: "dark",
  center: [77.59, 12.97],
  zoom: 11,
  pitch: 45,
  bearing: -17,
};
const DEFAULT_JSON = JSON.stringify(DEFAULT_SPEC, null, 2);

function readSpecFromHash(): { json: string; spec: MapSpec } | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.slice(1); // remove #
  if (!hash) return null;
  try {
    const raw = decompressFromEncodedURIComponent(hash);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { json: JSON.stringify(parsed, null, 2), spec: parsed as MapSpec };
  } catch {
    return null;
  }
}

type RightTab = "live render" | "static code";

export function Playground() {
  const fromHash = useRef(readSpecFromHash());
  const [jsonText, setJsonText] = useState(
    fromHash.current?.json ?? DEFAULT_JSON
  );
  const [spec, setSpec] = useState<MapSpec>(
    fromHash.current?.spec ?? DEFAULT_SPEC
  );
  const [error, setError] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("live render");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleShare = useCallback(() => {
    try {
      const compressed = compressToEncodedURIComponent(jsonText);
      const url = `${window.location.origin}${window.location.pathname}#${compressed}`;
      window.history.replaceState(null, "", `#${compressed}`);
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [jsonText]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      try {
        const parsed = JSON.parse(jsonText);
        const result = validateSpec(parsed);
        if (result.success) {
          setSpec(result.data as MapSpec);
          setError(null);
        } else {
          // Still update the map with what we can parse —
          // show the validation error but render best-effort
          setSpec(parsed as MapSpec);
          setError(result.error);
        }
      } catch (e) {
        setError((e as Error).message);
      }
    }, 100);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [jsonText]);

  // Fullscreen body scroll lock
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isFullscreen]);

  const staticCode = generateStaticCode(spec);

  return (
    <>
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

        {/* Right panel */}
        <div className="min-w-0 flex flex-col">
          <div className="flex items-center justify-between mb-2 h-6">
            <div className="flex items-center gap-4">
              {(["live render", "static code"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab)}
                  className={`text-xs font-mono transition-colors ${
                    rightTab === tab
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {/* Share button */}
              <button
                onClick={handleShare}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Share"
                title={copied ? "Copied!" : "Copy share link"}
              >
                {copied ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                )}
              </button>
              {/* Export button */}
              <button
                onClick={() => setShowExport(true)}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Export"
                title="Export project"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
              {/* Fullscreen button */}
              <button
                onClick={() => setIsFullscreen(true)}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Fullscreen"
                title="Fullscreen"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
            </div>
          </div>

          {/* Live render */}
          <div
            className={`flex-1 border border-border rounded overflow-hidden ${
              rightTab === "live render" ? "" : "hidden"
            }`}
          >
            <MapRenderer spec={spec} />
          </div>

          {/* Static code */}
          <div
            className={`flex-1 border border-border rounded bg-background font-mono text-xs text-left relative group overflow-auto ${
              rightTab === "static code" ? "" : "hidden"
            }`}
          >
            <div className="absolute top-2 right-2 z-10">
              <CopyButton
                text={staticCode}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground"
              />
            </div>
            <CodeBlock
              code={staticCode}
              lang="tsx"
              fillHeight
              hideCopyButton
            />
          </div>
        </div>
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center justify-between px-6 h-14 border-b border-border shrink-0">
            <span className="text-sm font-mono">render</span>
            <button
              onClick={() => setIsFullscreen(false)}
              className="p-1.5 rounded hover:bg-muted transition-colors"
              aria-label="Close fullscreen"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="flex-1">
            <MapRenderer spec={spec} />
          </div>
        </div>
      )}

      {/* Export modal */}
      {showExport && (
        <ExportModal spec={spec} onClose={() => setShowExport(false)} />
      )}
    </>
  );
}
