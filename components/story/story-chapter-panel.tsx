"use client";

import Markdown from "markdown-to-jsx";
import type { StoryChapter, StoryLayout, StoryTheme } from "@/lib/story-spec";

interface StoryChapterPanelProps {
  chapter: StoryChapter;
  isActive: boolean;
  layout: StoryLayout;
  theme: StoryTheme;
  progress: number;
  isMobile?: boolean;
}

const MARKDOWN_OVERRIDES = {
  forceBlock: true,
  disableParsingRawHTML: true,
  overrides: {
    // Downgrade headings — chapter already has an <h2>
    h1: { component: "strong" as const, props: { style: { display: "block", fontSize: "1.15em", margin: "0.5em 0" } } },
    h2: { component: "strong" as const, props: { style: { display: "block", fontSize: "1.1em", margin: "0.5em 0" } } },
    h3: { component: "strong" as const, props: { style: { display: "block", fontSize: "1.05em", margin: "0.5em 0" } } },
    h4: { component: "strong" as const },
    h5: { component: "strong" as const },
    h6: { component: "strong" as const },
    // Disable code blocks, tables, images (media handled separately)
    pre: { component: "span" as const },
    table: { component: "div" as const },
    img: { component: "span" as const },
    // Style inline code
    code: { component: "code" as const, props: { style: { fontFamily: "monospace", fontSize: "0.9em" } } },
    // Links open in new tab
    a: {
      component: "a" as const,
      props: {
        target: "_blank",
        rel: "noopener noreferrer",
        style: { color: "inherit", textDecoration: "underline", textUnderlineOffset: "2px" },
      },
    },
    // List styling for narrow panels
    ul: { props: { style: { paddingLeft: "1.2em", margin: "0.5em 0" } } },
    ol: { props: { style: { paddingLeft: "1.2em", margin: "0.5em 0" } } },
    li: { props: { style: { marginBottom: "0.25em" } } },
    p: { props: { style: { margin: "0 0 0.5em 0" } } },
    blockquote: {
      props: {
        style: {
          borderLeft: "3px solid currentColor",
          paddingLeft: "12px",
          margin: "0.5em 0",
          opacity: 0.8,
        },
      },
    },
  },
};

export function StoryChapterPanel({
  chapter,
  isActive,
  layout,
  theme,
  progress,
  isMobile = false,
}: StoryChapterPanelProps) {
  // Force overlay-center on mobile
  const effectiveLayout = isMobile ? "overlay-center" : layout;
  const isOverlay = effectiveLayout === "overlay-center" || effectiveLayout === "overlay-left";
  const isRight = effectiveLayout === "sidebar-right";

  // Fade in when chapter becomes active
  const opacity = isActive ? Math.min(progress * 4, 1) : progress > 0.9 ? 1 - (progress - 0.9) * 10 : 0;

  const isDark = theme === "dark";

  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
        display: "flex",
        justifyContent: isOverlay
          ? effectiveLayout === "overlay-left"
            ? "flex-start"
            : "center"
          : isRight
            ? "flex-end"
            : "flex-start",
        padding: isOverlay ? "0 24px" : "0",
        pointerEvents: "none",
      }}
    >
      <div
        data-active={isActive}
        style={{
          width: isOverlay
            ? isMobile ? "min(360px, 90vw)" : "min(420px, 90vw)"
            : "min(400px, 40vw)",
          padding: isOverlay
            ? isMobile ? "20px" : "24px"
            : isMobile ? "24px" : "32px 40px",
          backgroundColor: isDark
            ? "rgba(10, 10, 10, 0.92)"
            : "rgba(255, 255, 255, 0.95)",
          color: isDark ? "#f0f0f0" : "#1a1a1a",
          backdropFilter: "blur(12px)",
          borderRadius: "12px",
          boxShadow: isDark
            ? "0 4px 24px rgba(0,0,0,0.5)"
            : "0 4px 24px rgba(0,0,0,0.1)",
          opacity,
          transform: `translateY(${isActive ? 0 : 20}px)`,
          transition: "transform 0.4s ease-out",
          pointerEvents: isActive ? "auto" : "none",
          margin: isMobile
            ? "0 auto"
            : isOverlay ? "0" : isRight ? "0 48px 0 0" : "0 0 0 48px",
        }}
      >
        <h2
          style={{
            fontSize: isMobile ? "1.25rem" : "1.5rem",
            fontWeight: 700,
            lineHeight: 1.2,
            margin: "0 0 12px 0",
          }}
        >
          {chapter.heading}
        </h2>
        <div
          style={{
            fontSize: isMobile ? "0.9rem" : "1rem",
            lineHeight: 1.6,
            margin: 0,
            opacity: 0.85,
          }}
        >
          <Markdown options={MARKDOWN_OVERRIDES}>
            {chapter.content}
          </Markdown>
        </div>
        {chapter.media && (
          <div style={{ marginTop: "16px" }}>
            {chapter.media.type === "image" ? (
              <img
                src={chapter.media.url}
                alt={chapter.media.alt ?? ""}
                style={{
                  width: "100%",
                  borderRadius: "8px",
                  maxHeight: "240px",
                  objectFit: "cover",
                }}
              />
            ) : (
              <video
                src={chapter.media.url}
                muted
                playsInline
                autoPlay
                loop
                style={{
                  width: "100%",
                  borderRadius: "8px",
                  maxHeight: "240px",
                  objectFit: "cover",
                }}
              />
            )}
            {chapter.media.caption && (
              <p
                style={{
                  fontSize: "0.8rem",
                  opacity: 0.6,
                  marginTop: "6px",
                }}
              >
                {chapter.media.caption}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
