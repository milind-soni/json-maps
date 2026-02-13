import { codeToHtml } from "shiki";
import { CopyButton } from "./copy-button";
import { ExpandableCode } from "./expandable-code";

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

interface CodeProps {
  children: string;
  lang?: "json" | "tsx" | "typescript" | "bash" | "javascript";
}

export async function Code({ children, lang = "typescript" }: CodeProps) {
  const html = await codeToHtml(children.trim(), {
    lang,
    themes: {
      light: vercelLightTheme,
      dark: vercelDarkTheme,
    },
    defaultColor: false,
  });

  return (
    <div className="group relative my-6 rounded-lg border border-border bg-neutral-100 dark:bg-[#0a0a0a] text-sm font-mono overflow-hidden max-w-full">
      <div className="absolute top-3 right-3 z-10">
        <CopyButton
          text={children.trim()}
          className="opacity-0 group-hover:opacity-100 text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-[#0a0a0a]"
        />
      </div>
      <ExpandableCode>
        <div
          className="overflow-x-auto [&_pre]:bg-transparent! [&_pre]:m-0! [&_pre]:p-4! [&_code]:bg-transparent! [&_.shiki]:bg-transparent!"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </ExpandableCode>
    </div>
  );
}
