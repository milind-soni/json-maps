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
    title: "Spec Reference",
    items: [
      { title: "Basemap", href: "/docs/basemap" },
      { title: "Viewport", href: "/docs/viewport" },
      { title: "Markers", href: "/docs/markers" },
      { title: "Layers", href: "/docs/layers" },
      { title: "Controls", href: "/docs/controls" },
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
