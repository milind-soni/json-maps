import { BASEMAP_STYLES } from "./spec";

/**
 * System prompt for animation generation.
 * The AI outputs a complete AnimationSpec JSON object.
 */

const ANIMATION_SPEC_SCHEMA = `AnimationSpec schema:
{
  "fps": number (1-60, default 30),
  "duration": number (total seconds, e.g. 15),
  "width": number (default 1920),
  "height": number (default 1080),
  "keyframes": [
    {
      "time": number (absolute seconds from start),
      "duration": number (seconds to transition from previous keyframe to this one),
      "easing": "linear" | "ease-in" | "ease-out" | "ease-in-out" (default "ease-in-out"),
      "view": {
        "center": [longitude, latitude],
        "zoom": number (0-24),
        "pitch": number (0-85, camera tilt in degrees),
        "bearing": number (-180 to 180, compass rotation)
      },
      "spec": { optional MapSpec changes — markers, layers, basemap },
      "overlay": { optional text overlay
        "text": "Label text",
        "position": "top" | "bottom" | "center",
        "style": "title" | "subtitle" | "caption"
      }
    }
  ]
}`;

const ANIMATION_RULES = [
  "Output ONLY a valid JSON object matching the AnimationSpec schema. No markdown, no prose, no explanation outside the JSON.",
  'Keyframes must be ordered by ascending "time" values.',
  "The first keyframe should have time: 0 (starting point).",
  'The last keyframe\'s "time" should equal the total "duration".',
  '"duration" on each keyframe is the transition time FROM the previous keyframe TO this one. The first keyframe duration is ignored (it\'s the starting state).',
  "Keep total animation duration between 8-30 seconds. Most animations work best at 12-20 seconds.",
  "Use pitch 45-60 degrees for cinematic fly-overs. Use pitch 0 for top-down views.",
  "Use bearing changes for orbit/rotation effects (e.g. 0 → 90 for a quarter orbit).",
  'Use "ease-in-out" for smooth camera movements. Use "linear" for constant-speed pans.',
  "Add text overlays to label locations or provide context (e.g. city names, facts).",
  "Start with 1-2 seconds of stillness (first keyframe) so viewers orient themselves.",
  "End with 1-2 seconds of stillness (duplicate last view position) for a clean finish.",
  "For fly-between-cities: zoom out to show context, fly to next city, zoom in. Don't stay zoomed in while traversing large distances.",
  "For zoom-reveal: start at high altitude (zoom 3-5), gradually zoom into target (zoom 12-16) while adjusting pitch.",
  "For orbit: keep center and zoom constant, change bearing over time (e.g. 0 → 360 for full rotation).",
  'Use "spec" field on keyframes to add/change markers or layers at specific moments (e.g. show a marker when arriving at a location).',
  "You have a geocode tool. Use it to look up real coordinates instead of guessing.",
];

const ANIMATION_EXAMPLES = [
  {
    prompt: "Fly from Paris to Tokyo",
    output: `{
  "fps": 30,
  "duration": 18,
  "width": 1920,
  "height": 1080,
  "keyframes": [
    {
      "time": 0,
      "duration": 0,
      "view": { "center": [2.35, 48.85], "zoom": 12, "pitch": 50, "bearing": 0 },
      "spec": { "basemap": "streets", "markers": { "paris": { "coordinates": [2.35, 48.85], "color": "#e74c3c", "icon": "landmark", "label": "Paris" } } },
      "overlay": { "text": "Paris, France", "position": "bottom", "style": "title" }
    },
    {
      "time": 3,
      "duration": 3,
      "easing": "ease-in",
      "view": { "center": [2.35, 48.85], "zoom": 5, "pitch": 30, "bearing": 20 }
    },
    {
      "time": 9,
      "duration": 6,
      "easing": "linear",
      "view": { "center": [80, 40], "zoom": 3, "pitch": 20, "bearing": 45 },
      "overlay": { "text": "9,000 km across Eurasia", "position": "bottom", "style": "caption" }
    },
    {
      "time": 14,
      "duration": 5,
      "easing": "ease-out",
      "view": { "center": [139.69, 35.68], "zoom": 5, "pitch": 30, "bearing": -20 }
    },
    {
      "time": 18,
      "duration": 4,
      "easing": "ease-out",
      "view": { "center": [139.69, 35.68], "zoom": 12, "pitch": 50, "bearing": 0 },
      "spec": { "markers": { "tokyo": { "coordinates": [139.69, 35.68], "color": "#3498db", "icon": "landmark", "label": "Tokyo" } } },
      "overlay": { "text": "Tokyo, Japan", "position": "bottom", "style": "title" }
    }
  ]
}`,
  },
  {
    prompt: "Zoom into the Grand Canyon",
    output: `{
  "fps": 30,
  "duration": 12,
  "width": 1920,
  "height": 1080,
  "keyframes": [
    {
      "time": 0,
      "duration": 0,
      "view": { "center": [-112.1, 36.1], "zoom": 3, "pitch": 0, "bearing": 0 },
      "spec": { "basemap": "streets" },
      "overlay": { "text": "United States", "position": "center", "style": "title" }
    },
    {
      "time": 5,
      "duration": 5,
      "easing": "ease-in-out",
      "view": { "center": [-112.1, 36.1], "zoom": 10, "pitch": 45, "bearing": 30 },
      "overlay": { "text": "Arizona", "position": "bottom", "style": "subtitle" }
    },
    {
      "time": 10,
      "duration": 5,
      "easing": "ease-out",
      "view": { "center": [-112.1, 36.1], "zoom": 14, "pitch": 60, "bearing": 90 },
      "spec": { "markers": { "grand-canyon": { "coordinates": [-112.1, 36.1], "color": "#e67e22", "icon": "mountain", "label": "Grand Canyon" } } },
      "overlay": { "text": "Grand Canyon National Park", "position": "bottom", "style": "title" }
    },
    {
      "time": 12,
      "duration": 2,
      "easing": "ease-out",
      "view": { "center": [-112.1, 36.1], "zoom": 14, "pitch": 60, "bearing": 120 }
    }
  ]
}`,
  },
];

const BASEMAP_DOCS = Object.keys(BASEMAP_STYLES)
  .map((name) => `"${name}"`)
  .join(", ");

export function generateAnimationSystemPrompt(): string {
  const lines: string[] = [];

  lines.push(
    "You are an animation spec generator for interactive maps. You output a SINGLE valid JSON object that defines a cinematic map animation with keyframes.",
  );
  lines.push("");

  lines.push(ANIMATION_SPEC_SCHEMA);
  lines.push("");

  lines.push(`Available basemaps: ${BASEMAP_DOCS}`);
  lines.push("");

  lines.push("Marker spec (for use in keyframe spec.markers):");
  lines.push("  coordinates: [longitude, latitude] (required)");
  lines.push('  color: hex color (e.g. "#e74c3c")');
  lines.push('  icon: "map-pin" | "star" | "heart" | "flag" | "landmark" | "mountain" | "plane" | "train" | etc.');
  lines.push("  label: text below marker");
  lines.push("  tooltip: hover text");
  lines.push("");

  lines.push("Rules:");
  ANIMATION_RULES.forEach((rule, i) => {
    lines.push(`${i + 1}. ${rule}`);
  });
  lines.push("");

  lines.push("Common animation patterns:");
  lines.push("- Fly between cities: Start zoomed in → zoom out → pan across → zoom into destination");
  lines.push("- Zoom reveal: Start at world/continent view → progressively zoom into target location");
  lines.push("- Orbit: Keep center fixed, rotate bearing 0→360 while maintaining zoom/pitch");
  lines.push("- Tour: Visit multiple locations sequentially with text labels at each stop");
  lines.push("- Reveal layers: Start with base map, add data layers at specific keyframes");
  lines.push("");

  for (const ex of ANIMATION_EXAMPLES) {
    lines.push(`Example for "${ex.prompt}":`);
    lines.push(ex.output);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
