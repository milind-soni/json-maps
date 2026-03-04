import type { Metadata } from "next";
import localFont from "next/font/local";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { PAGE_TITLES } from "@/lib/page-titles";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

const DESCRIPTION =
  "The map component AI can write. One React component that renders interactive maps from a JSON spec — markers, layers, choropleths, SQL widgets. Stream it from any LLM.";

export const metadata: Metadata = {
  metadataBase: new URL("https://jsonmaps.dev"),
  title: {
    default: `json-maps | ${PAGE_TITLES[""]}`,
    template: "%s | json-maps",
  },
  description: DESCRIPTION,
  keywords: [
    "json-maps",
    "AI map component",
    "LLM map generation",
    "React map component",
    "JSON map spec",
    "MapLibre",
    "GeoJSON",
    "Parquet",
    "PMTiles",
    "DuckDB",
    "choropleth",
    "streaming maps",
    "AI agent tools",
    "data visualization",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://jsonmaps.dev",
    siteName: "json-maps",
    title: `json-maps | ${PAGE_TITLES[""]}`,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `json-maps | ${PAGE_TITLES[""]}`,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
