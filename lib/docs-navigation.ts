export type NavItem = {
  title: string;
  href: string;
  external?: boolean;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const docsNavigation: NavSection[] = [
  {
    title: "Getting Started",
    items: [
      { title: "Introduction", href: "/docs" },
      { title: "Installation", href: "/docs/installation" },
      { title: "Quick Start", href: "/docs/quick-start" },
    ],
  },
  {
    title: "Tutorials",
    items: [
      { title: "Earthquake Visualization", href: "/docs/tutorials/earthquake-viz" },
    ],
  },
  {
    title: "Spec Reference",
    items: [
      { title: "Basemap", href: "/docs/basemap" },
      { title: "Viewport", href: "/docs/viewport" },
      { title: "Markers", href: "/docs/markers" },
      { title: "Layers", href: "/docs/layers" },
      { title: "Routes", href: "/docs/routes" },
      { title: "Heatmap", href: "/docs/heatmap" },
      { title: "Tile Layers", href: "/docs/tile-layers" },
      { title: "Controls", href: "/docs/controls" },
      { title: "Legend", href: "/docs/legend" },
      { title: "Widgets", href: "/docs/widgets" },
    ],
  },
  {
    title: "Styling",
    items: [
      { title: "Color System", href: "/docs/colors" },
    ],
  },
  {
    title: "React API",
    items: [
      { title: "Events", href: "/docs/events" },
      { title: "useMap Hook", href: "/docs/use-map" },
      { title: "Component Slots", href: "/docs/component-slots" },
      { title: "Routing Providers", href: "/docs/routing-providers" },
    ],
  },
  {
    title: "Data",
    items: [
      { title: "Data Registry", href: "/docs/data-registry" },
    ],
  },
  {
    title: "Guides",
    items: [
      { title: "Recipes", href: "/docs/recipes" },
    ],
  },
  {
    title: "Links",
    items: [
      { title: "GitHub", href: "https://github.com/milind-soni/json-maps", external: true },
      { title: "Playground", href: "/playground" },
    ],
  },
];

export const allDocsPages = docsNavigation
  .flatMap((section) => section.items)
  .filter((item) => !item.external);
