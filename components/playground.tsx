"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";
import { MapRenderer } from "./map";
import { CodeBlock } from "./code-block";
import { CopyButton } from "./copy-button";
import { ExportModal } from "./export-modal";
import { ChatSidebar, type ChatMessage } from "./chat-sidebar";
import { type MapSpec } from "@/lib/spec";
import { validateSpec } from "@/lib/spec-schema";
import { generateStaticCode } from "@/lib/generate-code";
import { useMapStream } from "@/lib/use-map-stream";
import { layerDataCache } from "@/lib/layer-data-cache";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const DESKTOP_DEFAULT_WIDTH = 400;
const DESKTOP_MIN_WIDTH = 300;
const DESKTOP_MAX_WIDTH = 700;

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
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chat state
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [desktopWidth, setDesktopWidth] = useState(DESKTOP_DEFAULT_WIDTH);
  const isDraggingRef = useRef(false);

  // Track whether spec update came from stream (to avoid editor→stream loops)
  const fromStreamRef = useRef(false);

  // Keep a ref to current spec so send callback doesn't go stale
  const specRef = useRef(spec);
  specRef.current = spec;

  // Destructure to get stable references (same pattern as working demo.tsx)
  const {
    spec: streamSpec,
    isStreaming: streamIsStreaming,
    error: streamError,
    rawLines,
    streamText,
    send,
    stop,
  } = useMapStream({ api: "/api/generate" });
  const wasStreamingRef = useRef(false);

  // Detect desktop vs mobile
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    setIsDesktop(mq.matches);
    setHasMounted(true);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Push page content on desktop when pane is open
  useEffect(() => {
    const body = document.body;
    if (isDesktop && chatOpen) {
      body.style.paddingRight = `${desktopWidth}px`;
      if (!isDraggingRef.current) {
        body.style.transition = "padding-right 150ms ease";
      }
    } else if (isDesktop) {
      body.style.paddingRight = "0px";
      body.style.transition = "padding-right 150ms ease";
    }
    return () => {
      body.style.paddingRight = "0px";
      body.style.transition = "";
    };
  }, [isDesktop, chatOpen, desktopWidth]);

  // Resize handle drag
  const handleResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      isDraggingRef.current = true;
      document.documentElement.style.transition = "none";
      const startX = e.clientX;
      const startWidth = desktopWidth;

      const onPointerMove = (ev: globalThis.PointerEvent) => {
        const delta = startX - ev.clientX;
        const newWidth = Math.min(
          DESKTOP_MAX_WIDTH,
          Math.max(DESKTOP_MIN_WIDTH, startWidth + delta),
        );
        setDesktopWidth(newWidth);
      };

      const onPointerUp = () => {
        isDraggingRef.current = false;
        document.documentElement.style.transition = "";
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
      };

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    },
    [desktopWidth],
  );

  // Cmd+K to toggle chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setChatOpen((prev) => {
          if (!prev) {
            setTimeout(() => chatInputRef.current?.focus(), 200);
          }
          return !prev;
        });
      }
      if (e.key === "Escape" && chatOpen && isDesktop) {
        setChatOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [chatOpen, isDesktop]);

  // Auto-focus input when opened
  useEffect(() => {
    if (chatOpen) {
      const timer = setTimeout(() => chatInputRef.current?.focus(), 200);
      return () => clearTimeout(timer);
    }
  }, [chatOpen]);

  // When streaming ends, add assistant message (or error)
  useEffect(() => {
    if (wasStreamingRef.current && !streamIsStreaming) {
      if (streamError) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${streamError.message}` },
        ]);
      } else {
        const patchCount = rawLines.length;
        if (patchCount > 0 || streamText) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: streamText || "Done.",
              patchCount,
            },
          ]);
        }
      }
    }
    wasStreamingRef.current = streamIsStreaming;
  }, [streamIsStreaming, streamText, rawLines.length, streamError]);

  // Sync stream spec → editor text + local spec
  useEffect(() => {
    if (streamIsStreaming || rawLines.length > 0) {
      const newJson = JSON.stringify(streamSpec, null, 2);
      fromStreamRef.current = true;
      setJsonText(newJson);
      setSpec(streamSpec);
    }
  }, [streamSpec, streamIsStreaming, rawLines.length]);

  const handleChatSend = useCallback(
    async (prompt: string) => {
      setMessages((prev) => [...prev, { role: "user", content: prompt }]);
      const schemas = layerDataCache.getSchemas();
      await send(prompt, {
        previousSpec: specRef.current,
        layerSchemas: Object.keys(schemas).length > 0 ? schemas : undefined,
      });
    },
    [send],
  );

  const handleChatStop = useCallback(() => {
    stop();
  }, [stop]);

  const handleChatClear = useCallback(() => {
    setMessages([]);
  }, []);

  const handleChatClose = useCallback(() => {
    setChatOpen(false);
  }, []);

  const handleScreenshot = useCallback(async () => {
    setScreenshotLoading(true);
    try {
      const compressed = compressToEncodedURIComponent(jsonText);
      const res = await fetch(`/api/screenshot?spec=${compressed}&width=1280&height=720&scale=2`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "map-screenshot.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setScreenshotLoading(false);
    }
  }, [jsonText]);

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

  // Editor text → spec (debounced) — skip if update came from stream
  useEffect(() => {
    if (fromStreamRef.current) {
      fromStreamRef.current = false;
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      try {
        const parsed = JSON.parse(jsonText);
        const result = validateSpec(parsed);
        if (result.success) {
          setSpec(result.data as MapSpec);
          setError(null);
        } else {
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

  // Chat panel content shared by desktop sidebar and mobile sheet
  const chatPanel = (
    <div className="flex flex-col flex-1 min-w-0 min-h-0">
      <ChatSidebar
        messages={messages}
        isStreaming={streamIsStreaming}
        streamingText={streamText}
        onSend={handleChatSend}
        onStop={handleChatStop}
        onClear={handleChatClear}
        onClose={handleChatClose}
        inputRef={chatInputRef}
      />
    </div>
  );

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
              {/* Embed button */}
              <button
                onClick={() => {
                  const compressed = compressToEncodedURIComponent(jsonText);
                  window.open(`/embed#${compressed}`, "_blank");
                }}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Embed"
                title="Open embed view"
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
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
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
              {/* Screenshot button */}
              <button
                onClick={handleScreenshot}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Screenshot"
                title="Download as PNG"
                disabled={screenshotLoading}
              >
                {screenshotLoading ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="animate-spin"
                  >
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="10" />
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
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                )}
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

      {/* Ask AI floating button — visible when chat is closed */}
      {!chatOpen && (
        <button
          onClick={() => {
            setChatOpen(true);
            setTimeout(() => chatInputRef.current?.focus(), 200);
          }}
          className="fixed z-50 bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-4 flex items-center gap-2 px-4 py-2 rounded-lg border bg-background text-primary shadow-lg hover:bg-primary hover:text-primary-foreground transition-colors text-sm font-medium"
          aria-label="Ask AI"
        >
          Ask AI
          <kbd className="hidden sm:inline-flex items-center gap-0.5 text-xs opacity-60 font-mono">
            <span>&#8984;</span>K
          </kbd>
        </button>
      )}

      {/* Desktop: resizable side pane */}
      <aside
        className={`hidden sm:flex fixed top-0 right-0 bottom-0 z-40 border-l bg-background transition-transform duration-150 ease-in-out ${
          chatOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: desktopWidth }}
        aria-hidden={!chatOpen}
      >
        {/* Resize handle */}
        <div
          onPointerDown={handleResizePointerDown}
          className="absolute top-0 bottom-0 left-0 w-1.5 cursor-col-resize hover:bg-ring/30 active:bg-ring/50 transition-colors z-10"
        />
        {chatPanel}
      </aside>

      {/* Mobile: Sheet overlay/drawer */}
      {hasMounted && !isDesktop && (
        <Sheet open={chatOpen} onOpenChange={setChatOpen}>
          <SheetContent
            side="right"
            overlayClassName="!bg-background"
            className="!inset-0 !w-full !h-full !max-w-none p-0 flex flex-col"
            style={{ backgroundColor: "var(--background)", opacity: 1 }}
          >
            <SheetTitle className="sr-only">AI Chat</SheetTitle>
            {chatPanel}
          </SheetContent>
        </Sheet>
      )}

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
