import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import { Code } from "@/components/code";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="text-3xl font-bold mb-4">{children}</h1>
    ),
    h2: ({ children }) => {
      const id = typeof children === "string" ? slugify(children) : undefined;
      return (
        <h2 id={id} className="text-xl font-semibold mt-12 mb-4 scroll-mt-28">
          {children}
        </h2>
      );
    },
    h3: ({ children }) => {
      const id = typeof children === "string" ? slugify(children) : undefined;
      return (
        <h3 id={id} className="text-lg font-medium mt-8 mb-3 scroll-mt-28">
          {children}
        </h3>
      );
    },
    p: ({ children }) => (
      <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul className="list-disc pl-6 mb-4 space-y-1 text-sm text-muted-foreground">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal pl-6 mb-4 space-y-1 text-sm text-muted-foreground">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="leading-relaxed">{children}</li>
    ),
    code: ({ children, className }) => {
      // Inline code (no className means no language)
      if (!className) {
        return (
          <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
            {children}
          </code>
        );
      }
      return <code className={className}>{children}</code>;
    },
    pre: async ({ children }) => {
      const codeElement = children as React.ReactElement<{
        children: string;
        className?: string;
      }>;
      const code = codeElement.props.children;
      const className = codeElement.props.className ?? "";
      const lang = className.replace("language-", "") as
        | "json"
        | "tsx"
        | "typescript"
        | "bash"
        | "javascript";
      return <Code lang={lang || "typescript"}>{code}</Code>;
    },
    a: ({ href, children }) => {
      if (href?.startsWith("/")) {
        return (
          <Link
            href={href}
            className="text-foreground underline underline-offset-4 hover:text-foreground/80"
          >
            {children}
          </Link>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground underline underline-offset-4 hover:text-foreground/80"
        >
          {children}
        </a>
      );
    },
    strong: ({ children }) => (
      <strong className="font-medium text-foreground">{children}</strong>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-border pl-4 my-4 italic text-muted-foreground">
        {children}
      </blockquote>
    ),
    table: ({ children }) => (
      <div className="my-6 w-full overflow-x-auto">
        <table className="w-full text-sm border-collapse">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="border-b border-border">{children}</thead>
    ),
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => (
      <tr className="border-b border-border/50">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="text-left py-2 px-3 font-medium text-foreground">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="py-2 px-3 text-muted-foreground">
        {children}
      </td>
    ),
    hr: () => <hr className="my-8 border-border" />,
    ...components,
  };
}
