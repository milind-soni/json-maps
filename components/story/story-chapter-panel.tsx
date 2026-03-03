"use client";

import type { StoryChapter, StoryLayout, StoryTheme } from "@/lib/story-spec";

interface StoryChapterPanelProps {
  chapter: StoryChapter;
  isActive: boolean;
  layout: StoryLayout;
  theme: StoryTheme;
  progress: number;
}

export function StoryChapterPanel({
  chapter,
  isActive,
  layout,
  theme,
  progress,
}: StoryChapterPanelProps) {
  const isOverlay = layout === "overlay-center" || layout === "overlay-left";
  const isRight = layout === "sidebar-right";

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
          ? layout === "overlay-left"
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
          width: isOverlay ? "min(420px, 90vw)" : "min(400px, 40vw)",
          padding: isOverlay ? "24px" : "32px 40px",
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
          margin: isOverlay ? "0" : isRight ? "0 48px 0 0" : "0 0 0 48px",
        }}
      >
        <h2
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            lineHeight: 1.2,
            margin: "0 0 12px 0",
          }}
        >
          {chapter.heading}
        </h2>
        <p
          style={{
            fontSize: "1rem",
            lineHeight: 1.6,
            margin: 0,
            opacity: 0.85,
          }}
        >
          {chapter.content}
        </p>
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
