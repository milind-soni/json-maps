import type { Metadata } from "next";
import { PAGE_TITLES } from "./page-titles";

const DESCRIPTION =
  "Describe a map as JSON, get an interactive map. AI-ready declarative map specs with markers, routes, layers, and data visualization.";

export function pageMetadata(slug: string): Metadata {
  const title = PAGE_TITLES[slug];
  if (!title) return {};

  const displayTitle = title.replace(/\n/g, " ");
  const fullTitle = `${displayTitle} | json-maps`;

  return {
    title: displayTitle,
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: "json-maps",
      title: fullTitle,
      description: DESCRIPTION,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: DESCRIPTION,
    },
  };
}
