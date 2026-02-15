"use client";

import { useState } from "react";
import { MapRenderer } from "./map";
import { CodeBlock } from "./code-block";
import { CopyButton } from "./copy-button";
import { type MapSpec } from "@/lib/spec";

type Tab = "preview" | "code";

export function LiveExample({ spec, height = "20rem" }: { spec: MapSpec; height?: string }) {
  const [tab, setTab] = useState<Tab>("preview");
  const jsonCode = JSON.stringify(spec, null, 2);

  return (
    <div className="border border-border rounded overflow-hidden my-4">
      <div className="flex items-center justify-between px-3 h-9 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          {(["preview", "code"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-xs font-mono transition-colors ${
                tab === t
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === "code" && (
          <CopyButton text={jsonCode} className="text-muted-foreground" />
        )}
      </div>
      <div className={tab === "preview" ? "" : "hidden"} style={{ height }}>
        <MapRenderer spec={spec} />
      </div>
      <div
        className={`overflow-auto ${tab === "code" ? "" : "hidden"}`}
        style={{ height }}
      >
        <CodeBlock code={jsonCode} lang="json" fillHeight hideCopyButton />
      </div>
    </div>
  );
}
