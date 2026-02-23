/**
 * Single source of truth for page titles.
 * Used by both page metadata exports and (future) OG image route.
 *
 * Keys mirror the page's URL path (e.g. "docs/layers" → /docs/layers).
 * Values are display titles — the layout template appends "| json-maps".
 */
export const PAGE_TITLES: Record<string, string> = {
  // Home
  "": "Declarative Maps from JSON",

  // Top-level pages
  playground: "Playground",
  examples: "Examples",

  // Docs — Getting Started
  docs: "Introduction",
  "docs/installation": "Installation",
  "docs/quick-start": "Quick Start",

  // Docs — Tutorials
  "docs/tutorials/earthquake-viz": "Earthquake Visualization",

  // Docs — Spec Reference
  "docs/basemap": "Basemap",
  "docs/viewport": "Viewport",
  "docs/markers": "Markers",
  "docs/layers": "Layers",
  "docs/routes": "Routes",
  "docs/heatmap": "Heatmap",
  "docs/tile-layers": "Tile Layers",
  "docs/controls": "Controls",
  "docs/legend": "Legend",
  "docs/widgets": "Widgets",

  // Docs — Styling
  "docs/colors": "Color System",

  // Docs — React API
  "docs/events": "Events",
  "docs/use-map": "useMap Hook",
  "docs/component-slots": "Component Slots",
  "docs/routing-providers": "Routing Providers",

  // Docs — Data
  "docs/data-registry": "Data Registry",

  // Docs — Guides
  "docs/recipes": "Recipes",
};

/**
 * Get the page title for a given slug.
 * Returns null if the slug is not registered.
 */
export function getPageTitle(slug: string): string | null {
  return slug in PAGE_TITLES ? PAGE_TITLES[slug]! : null;
}
