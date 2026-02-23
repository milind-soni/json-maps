import { readFile } from "fs/promises";
import { join } from "path";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import type { ModelMessage, UIMessage } from "ai";
import { createBashTool } from "bash-tool";
import { anthropic } from "@ai-sdk/anthropic";
import { allDocsPages } from "@/lib/docs-navigation";
import { mdxToCleanMarkdown } from "@/lib/mdx-to-markdown";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a helpful documentation assistant for json-maps, a library for rendering interactive maps from JSON specs.

GitHub repository: https://github.com/milind-soni/json-maps
Documentation: https://json-maps.dev/docs
npm package: json-maps

You have access to the full json-maps documentation via the bash and readFile tools. The docs are available as markdown files in the /workspace/docs/ directory.

When answering questions:
- Use the bash tool to list files (ls /workspace/docs/) or search for content (grep -r "keyword" /workspace/docs/)
- Use the readFile tool to read specific documentation pages (e.g. readFile with path "/workspace/docs/index.md")
- Do NOT use bash to write, create, modify, or delete files — you are read-only
- Always base your answers on the actual documentation content
- Be concise and accurate
- If the docs don't cover a topic, say so honestly
- Do NOT include source references or file paths in your response
- Do NOT use emojis in your responses`;

async function loadDocsFiles(): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  const results = await Promise.allSettled(
    allDocsPages.map(async (page) => {
      const slug =
        page.href === "/docs" ? "" : page.href.replace(/^\/docs\/?/, "");
      const filePath = slug
        ? join(
            process.cwd(),
            "app",
            "docs",
            ...slug.split("/"),
            "page.mdx",
          )
        : join(process.cwd(), "app", "docs", "page.mdx");

      const raw = await readFile(filePath, "utf-8");
      const md = mdxToCleanMarkdown(raw);
      const fileName = slug ? `/docs/${slug}.md` : "/docs/index.md";
      return { fileName, md };
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      files[result.value.fileName] = result.value.md;
    }
  }

  return files;
}

function addCacheControl(messages: ModelMessage[]): ModelMessage[] {
  if (messages.length === 0) return messages;
  return messages.map((message, index) => {
    if (index === messages.length - 1) {
      return {
        ...message,
        providerOptions: {
          ...message.providerOptions,
          anthropic: { cacheControl: { type: "ephemeral" } },
        },
      };
    }
    return message;
  });
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const docsFiles = await loadDocsFiles();
  const {
    tools: { bash, readFile: readFileTool },
  } = await createBashTool({ files: docsFiles });

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    tools: {
      bash,
      readFile: readFileTool,
    },
    prepareStep: ({ messages: stepMessages }) => ({
      messages: addCacheControl(stepMessages),
    }),
  });

  return result.toUIMessageStreamResponse();
}
