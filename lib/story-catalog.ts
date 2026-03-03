import { PALETTES } from "./palettes";
import { BASEMAP_STYLES } from "./spec";

/**
 * System prompt for AI-powered story generation.
 * Teaches the model to output a valid StorySpec JSON object.
 */

const STORY_SPEC_DOCS = `A StorySpec is a JSON object that defines a scroll-driven map story. As the reader scrolls, the map camera flies between locations and layers appear/disappear to illustrate the narrative.

StorySpec fields (all optional except chapters):
- title: string — story title displayed in the hero section
- subtitle: string — subtitle below the title
- author: string — author attribution
- theme: "light" | "dark" — visual theme for text panels (default "light")
- layout: "sidebar-left" | "sidebar-right" | "overlay-center" | "overlay-left" — where chapter panels appear relative to the map (default "sidebar-left")
- baseSpec: MapSpec object — initial map state (basemap, always-visible layers). All chapter specs are merged on top of this.
- chapters: array of StoryChapter objects (minimum 1, recommended 3-8)

StoryChapter fields:
- id: string (required) — unique kebab-case identifier (e.g. "overview", "first-earthquake", "conclusion")
- heading: string (required) — chapter heading, 2-6 words
- content: string (required) — chapter body text, 1-4 sentences. Keep it concise and informative.
- media: { type: "image" | "video", url: string, alt?: string, caption?: string } — optional media in the chapter panel
- view: { center: [longitude, latitude], zoom: number, pitch?: number, bearing?: number } (required) — camera position for this chapter
- easing: "linear" | "ease-in" | "ease-out" | "ease-in-out" — transition easing (default "ease-in-out")
- spec: Partial<MapSpec> — layers, markers, basemap changes to apply at this chapter. These accumulate: chapter 3 inherits layers from chapters 1 and 2.
- overlay: { text: string, position: "top" | "bottom" | "center", style?: "title" | "subtitle" | "caption" } — text overlay displayed on the map itself (not in the chapter panel)
- duration: string — scroll distance for this chapter (default "150vh"). Use "200vh" for chapters with more content or dramatic camera movements.`;

const STORY_RULES = [
  "Output ONLY a single valid JSON object — the StorySpec. No prose, no markdown, no explanation outside the JSON.",
  "Every story must have 3-8 chapters with unique kebab-case IDs.",
  "Chapter headings should be concise (2-6 words). Content should be 1-4 sentences.",
  "Camera views should progressively guide the reader through a geographic narrative — start with context (zoomed out), then zoom into details.",
  "Use zoom changes intentionally: zoom 2-4 for continental, 5-8 for country, 9-12 for city, 13-16 for neighborhood, 17+ for street level.",
  "Add layer changes in spec to reveal data progressively. Don't show all layers at once — build the visual story chapter by chapter.",
  "Use text overlays sparingly — only for dramatic callouts that need to appear on the map itself.",
  "The baseSpec should set the basemap and any layers that should be visible throughout the entire story.",
  "Use pitch (0-85) and bearing (-180 to 180) to create dramatic 3D camera angles. Pitch 40-60 with bearing rotation creates cinematic fly-over effects.",
  "For data layers, use the same layer types as MapSpec: geojson, route, heatmap, mvt, raster, parquet, pmtiles.",
  "For data-driven colors, always include domain for continuous and categories array for categorical palettes.",
  "Use the geocode tool for real coordinates. Never guess coordinates.",
  "Theme should match the story mood: 'dark' for dramatic/serious topics, 'light' for informational/educational topics.",
  "Use layout 'overlay-center' for immersive stories where the map is the primary focus. Use 'sidebar-left' for data-rich stories with longer text.",
];

const STORY_EXAMPLE = {
  title: "The Ring of Fire",
  subtitle: "Earth's most seismically active zone",
  theme: "dark",
  layout: "sidebar-left",
  baseSpec: {
    basemap: "dark",
    projection: "globe",
  },
  chapters: [
    {
      id: "overview",
      heading: "A Pacific Arc",
      content:
        "The Ring of Fire stretches 40,000 km around the Pacific Ocean, hosting 75% of the world's active volcanoes and 90% of earthquakes.",
      view: { center: [160, 10], zoom: 2, pitch: 20 },
      overlay: {
        text: "The Ring of Fire",
        position: "center",
        style: "title",
      },
    },
    {
      id: "japan",
      heading: "Japan's Seismic Zone",
      content:
        "Japan sits at the junction of four tectonic plates, making it one of the most earthquake-prone nations on Earth. The 2011 Tohoku quake measured 9.1 magnitude.",
      view: { center: [139.7, 35.7], zoom: 6, pitch: 45, bearing: -20 },
      spec: {
        layers: {
          quakes: {
            type: "geojson",
            data: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson",
            style: {
              pointColor: {
                type: "continuous",
                attr: "mag",
                palette: "OrYel",
                domain: [0, 8],
              },
              pointRadius: 4,
              opacity: 0.8,
            },
            tooltip: ["place", "mag", "time"],
          },
        },
      },
    },
    {
      id: "indonesia",
      heading: "The Indonesian Archipelago",
      content:
        "Indonesia spans 5,000 km across the most volcanically active region on Earth. The 2004 Indian Ocean tsunami originated here, killing over 230,000 people.",
      view: { center: [110, -5], zoom: 5, pitch: 30 },
      duration: "200vh",
    },
    {
      id: "chile",
      heading: "South America's Edge",
      content:
        "Chile recorded the largest earthquake ever measured — a 9.5 magnitude event in 1960 near Valdivia. The Nazca Plate subducts under South America at 80mm per year.",
      view: { center: [-72, -35], zoom: 5, pitch: 40, bearing: 15 },
    },
  ],
};

/* ---- Palette & basemap docs (reuse from catalog) ---- */

function formatPalettes(): string {
  const paletteNames = Object.keys(PALETTES);
  return `Available palettes: ${paletteNames.join(", ")}`;
}

function formatBasemaps(): string {
  return `Available basemaps: ${Object.keys(BASEMAP_STYLES)
    .map((k) => `"${k}"`)
    .join(", ")} (or a custom MapLibre style URL)`;
}

/* ---- Public API ---- */

export function generateStorySystemPrompt(): string {
  const lines: string[] = [];

  lines.push(
    "You are a scroll-driven map story generator. You create immersive geographic narratives that combine text, camera movements, and data layers into a scrollytelling experience.",
  );
  lines.push("");
  lines.push(STORY_SPEC_DOCS);
  lines.push("");
  lines.push(formatPalettes());
  lines.push(formatBasemaps());
  lines.push("");

  lines.push("Rules:");
  STORY_RULES.forEach((rule, i) => {
    lines.push(`${i + 1}. ${rule}`);
  });
  lines.push("");

  lines.push("Example output:");
  lines.push(JSON.stringify(STORY_EXAMPLE, null, 2));

  return lines.join("\n").trimEnd();
}
