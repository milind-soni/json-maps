"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CodeBlock } from "./code-block";
import { type MapSpec } from "@/lib/spec";
import { generateExportFiles } from "@/lib/generate-code";

interface ExportModalProps {
  spec: MapSpec;
  onClose: () => void;
}

export function ExportModal({ spec, onClose }: ExportModalProps) {
  const exportedFiles = generateExportFiles(spec);
  const [selectedExportFile, setSelectedExportFile] = useState<string | null>(
    null,
  );
  const [showMobileFileTree, setShowMobileFileTree] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(
    new Set(),
  );

  const activeExportFile =
    selectedExportFile ||
    (exportedFiles.length > 0 ? exportedFiles[0]?.path : null);
  const activeExportContent =
    exportedFiles.find((f) => f.path === activeExportFile)?.content || "";

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const downloadAllFiles = useCallback(() => {
    const allContent = exportedFiles
      .map((f) => `// ========== ${f.path} ==========\n${f.content}`)
      .join("\n\n");
    const blob = new Blob([allContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "generated-app.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [exportedFiles]);

  const copyFileContent = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 sm:p-8 text-left">
      <div className="bg-background border border-border rounded-lg w-full max-w-5xl h-full max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 h-14 border-b border-border shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile file tree toggle */}
            <button
              onClick={() => setShowMobileFileTree(!showMobileFileTree)}
              className="sm:hidden text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label="Toggle file tree"
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
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <span className="text-sm font-mono">export static code</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded hidden sm:inline">
              {exportedFiles.length} files
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadAllFiles}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-foreground text-background rounded hover:bg-foreground/90 transition-colors"
            >
              <svg
                width="12"
                height="12"
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
              Download All
            </button>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label="Close"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0 relative">
          {/* File Tree */}
          <div
            className={`
              ${showMobileFileTree ? "absolute inset-0 z-10 bg-background" : "hidden"}
              sm:relative sm:block sm:w-56 sm:bg-transparent
              border-r border-border overflow-auto py-2
            `}
          >
            {(() => {
              type TreeNode = {
                name: string;
                path: string;
                isFolder: boolean;
                children: TreeNode[];
                file?: { path: string; content: string };
              };

              const root: TreeNode = {
                name: "",
                path: "",
                isFolder: true,
                children: [],
              };

              exportedFiles.forEach((file) => {
                const parts = file.path.split("/");
                let current = root;

                parts.forEach((part, idx) => {
                  const isLast = idx === parts.length - 1;
                  const path = parts.slice(0, idx + 1).join("/");
                  let child = current.children.find((c) => c.name === part);

                  if (!child) {
                    child = {
                      name: part,
                      path,
                      isFolder: !isLast,
                      children: [],
                      file: isLast ? file : undefined,
                    };
                    current.children.push(child);
                  }

                  current = child;
                });
              });

              const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
                return nodes.sort((a, b) => {
                  if (a.isFolder && !b.isFolder) return -1;
                  if (!a.isFolder && b.isFolder) return 1;
                  return a.name.localeCompare(b.name);
                });
              };

              const toggleFolder = (path: string) => {
                setCollapsedFolders((prev) => {
                  const next = new Set(prev);
                  if (next.has(path)) {
                    next.delete(path);
                  } else {
                    next.add(path);
                  }
                  return next;
                });
              };

              const renderNode = (
                node: TreeNode,
                depth: number,
              ): React.ReactNode[] => {
                const result: React.ReactNode[] = [];
                const isExpanded = !collapsedFolders.has(node.path);

                if (node.isFolder && node.name) {
                  result.push(
                    <button
                      key={`folder-${node.path}`}
                      onClick={() => toggleFolder(node.path)}
                      className="w-full text-left px-3 py-1 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                      style={{ paddingLeft: `${12 + depth * 12}px` }}
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        >
                          <svg
                            width="8"
                            height="8"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M8 5l10 7-10 7V5z" />
                          </svg>
                        </span>
                        <span className="text-gray-400">
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z" />
                          </svg>
                        </span>
                        {node.name}
                      </span>
                    </button>,
                  );
                }

                if (node.file) {
                  const isActive = node.file.path === activeExportFile;
                  result.push(
                    <button
                      key={node.file.path}
                      onClick={() => {
                        setSelectedExportFile(node.file!.path);
                        setShowMobileFileTree(false);
                      }}
                      className={`w-full text-left px-3 py-1 text-xs font-mono transition-colors ${
                        isActive
                          ? "bg-foreground/10 text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                      }`}
                      style={{ paddingLeft: `${12 + depth * 12}px` }}
                    >
                      <span className="flex items-center gap-1.5">
                        {node.name.endsWith(".tsx") ||
                        node.name.endsWith(".ts") ? (
                          <span className="text-blue-400">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M3 3h18v18H3V3zm16.525 13.707c-.131-.821-.666-1.511-2.252-2.155-.552-.259-1.165-.438-1.349-.854-.068-.248-.083-.382-.039-.527.11-.373.458-.487.757-.381.193.07.37.258.482.52.51-.332.51-.332.86-.553-.132-.203-.203-.293-.297-.382-.335-.382-.78-.58-1.502-.558l-.375.047c-.361.09-.705.272-.923.531-.613.721-.437 1.976.245 2.494.674.476 1.661.59 1.791 1.052.12.543-.406.717-.919.65-.387-.071-.6-.273-.831-.641l-.871.529c.1.217.217.31.39.494.803.796 2.8.749 3.163-.476.013-.04.113-.33.071-.765zm-7.158-2.032c-.227.574-.446 1.148-.677 1.722-.204-.54-.42-1.102-.648-1.68l-.002-.02h-1.09v4.4h.798v-3.269l.796 2.011h.69l.793-2.012v3.27h.798v-4.4h-1.06l-.398 1.02v-.042zm-3.39-3.15v1.2h2.99v8.424h1.524v-8.424h2.99v-1.2H8.977z" />
                            </svg>
                          </span>
                        ) : node.name.endsWith(".json") ? (
                          <span className="text-yellow-400">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M4 4h16v16H4z" />
                              <path d="M8 8h8M8 12h8M8 16h4" />
                            </svg>
                          </span>
                        ) : node.name.endsWith(".js") ? (
                          <span className="text-yellow-400">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM13 9V3.5L18.5 9H13z" />
                            </svg>
                          </span>
                        ) : (
                          <span className="text-gray-400">
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM13 9V3.5L18.5 9H13z" />
                            </svg>
                          </span>
                        )}
                        {node.name}
                      </span>
                    </button>,
                  );
                }

                if (!node.isFolder || !node.name || isExpanded) {
                  sortNodes(node.children).forEach((child) => {
                    result.push(
                      ...renderNode(child, node.name ? depth + 1 : depth),
                    );
                  });
                }

                return result;
              };

              return renderNode(root, 0);
            })()}
          </div>

          {/* Code Preview */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
              <span className="text-xs font-mono text-muted-foreground">
                {activeExportFile}
              </span>
              <button
                onClick={() => copyFileContent(activeExportContent)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <CodeBlock
                code={activeExportContent}
                lang={activeExportFile?.endsWith(".json") ? "json" : "tsx"}
                fillHeight
                hideCopyButton
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
