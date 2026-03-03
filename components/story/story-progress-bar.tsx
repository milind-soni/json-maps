"use client";

interface StoryProgressBarProps {
  progress: number;
  chapterCount: number;
  activeIndex: number;
  theme: "light" | "dark";
}

export function StoryProgressBar({
  progress,
  chapterCount,
  activeIndex,
  theme,
}: StoryProgressBarProps) {
  const isDark = theme === "dark";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        display: "flex",
        gap: "2px",
        padding: "0 4px",
        height: "3px",
      }}
    >
      {Array.from({ length: chapterCount }, (_, i) => {
        let fill = 0;
        if (i < activeIndex) fill = 1;
        else if (i === activeIndex) fill = progress;

        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: "100%",
              backgroundColor: isDark
                ? "rgba(255,255,255,0.15)"
                : "rgba(0,0,0,0.1)",
              borderRadius: "2px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${fill * 100}%`,
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.8)"
                  : "rgba(0,0,0,0.6)",
                borderRadius: "2px",
                transition: i === activeIndex ? "none" : "width 0.3s ease",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
