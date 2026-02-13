"use client";

import { useEffect, useState } from "react";
import { createHighlighter, type Highlighter } from "shiki";
import { CopyButton } from "./copy-button";

const vercelDarkTheme = {
  name: "vercel-dark",
  type: "dark" as const,
  colors: {
    "editor.background": "transparent",
    "editor.foreground": "#e6edf3",
  },
  settings: [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#8b949e" },
    },
    {
      scope: ["string", "string.quoted", "string.template"],
      settings: { foreground: "#a5d6ff" },
    },
    {
      scope: [
        "constant.numeric",
        "constant.language.boolean",
        "constant.language.null",
      ],
      settings: { foreground: "#79c0ff" },
    },
    {
      scope: ["keyword", "storage.type", "storage.modifier"],
      settings: { foreground: "#ff7b72" },
    },
    {
      scope: ["keyword.operator", "keyword.control"],
      settings: { foreground: "#ff7b72" },
    },
    {
      scope: ["entity.name.function", "support.function", "meta.function-call"],
      settings: { foreground: "#d2a8ff" },
    },
    {
      scope: ["variable", "variable.other", "variable.parameter"],
      settings: { foreground: "#e6edf3" },
    },
    {
      scope: ["entity.name.tag", "support.class.component", "entity.name.type"],
      settings: { foreground: "#7ee787" },
    },
    {
      scope: ["punctuation", "meta.brace", "meta.bracket"],
      settings: { foreground: "#8b949e" },
    },
    {
      scope: [
        "support.type.property-name",
        "entity.name.tag.json",
        "meta.object-literal.key",
      ],
      settings: { foreground: "#79c0ff" },
    },
    {
      scope: ["entity.other.attribute-name"],
      settings: { foreground: "#79c0ff" },
    },
    {
      scope: ["support.type.primitive", "entity.name.type.primitive"],
      settings: { foreground: "#79c0ff" },
    },
  ],
};

const vercelLightTheme = {
  name: "vercel-light",
  type: "light" as const,
  colors: {
    "editor.background": "transparent",
    "editor.foreground": "#1f2328",
  },
  settings: [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#6e7781" },
    },
    {
      scope: ["string", "string.quoted", "string.template"],
      settings: { foreground: "#0a3069" },
    },
    {
      scope: [
        "constant.numeric",
        "constant.language.boolean",
        "constant.language.null",
      ],
      settings: { foreground: "#0550ae" },
    },
    {
      scope: ["keyword", "storage.type", "storage.modifier"],
      settings: { foreground: "#cf222e" },
    },
    {
      scope: ["keyword.operator", "keyword.control"],
      settings: { foreground: "#cf222e" },
    },
    {
      scope: ["entity.name.function", "support.function", "meta.function-call"],
      settings: { foreground: "#8250df" },
    },
    {
      scope: ["variable", "variable.other", "variable.parameter"],
      settings: { foreground: "#1f2328" },
    },
    {
      scope: ["entity.name.tag", "support.class.component", "entity.name.type"],
      settings: { foreground: "#116329" },
    },
    {
      scope: ["punctuation", "meta.brace", "meta.bracket"],
      settings: { foreground: "#6e7781" },
    },
    {
      scope: [
        "support.type.property-name",
        "entity.name.tag.json",
        "meta.object-literal.key",
      ],
      settings: { foreground: "#0550ae" },
    },
    {
      scope: ["entity.other.attribute-name"],
      settings: { foreground: "#0550ae" },
    },
    {
      scope: ["support.type.primitive", "entity.name.type.primitive"],
      settings: { foreground: "#0550ae" },
    },
  ],
};

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: [vercelLightTheme, vercelDarkTheme],
      langs: ["json", "tsx", "typescript"],
    });
  }
  return highlighterPromise;
}

if (typeof window !== "undefined") {
  getHighlighter();
}

interface CodeBlockProps {
  code: string;
  lang: "json" | "tsx" | "typescript";
  fillHeight?: boolean;
  hideCopyButton?: boolean;
}

export function CodeBlock({
  code,
  lang,
  fillHeight,
  hideCopyButton,
}: CodeBlockProps) {
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    getHighlighter().then((highlighter) => {
      setHtml(
        highlighter.codeToHtml(code, {
          lang,
          themes: {
            light: "vercel-light",
            dark: "vercel-dark",
          },
          defaultColor: false,
        }),
      );
    });
  }, [code, lang]);

  if (!html) {
    return fillHeight ? <div className="p-3" /> : null;
  }

  return (
    <div className={`relative group ${fillHeight ? "p-3" : ""}`}>
      {!hideCopyButton && (
        <div className="float-right sticky top-3 z-10 ml-2">
          <CopyButton
            text={code}
            className="opacity-0 group-hover:opacity-100 text-neutral-400"
          />
        </div>
      )}
      <div
        className="text-[13px] leading-relaxed [&_pre]:bg-transparent! [&_pre]:p-0! [&_pre]:m-0! [&_pre]:border-none! [&_pre]:rounded-none! [&_pre]:text-[13px]! [&_pre]:overflow-visible! [&_code]:bg-transparent! [&_code]:p-0! [&_code]:rounded-none! [&_code]:text-[13px]!"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
