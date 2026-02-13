import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://json-maps.dev"),
  title: {
    default: "json-maps | Declarative Maps from JSON",
    template: "%s | json-maps",
  },
  description:
    "Describe a map as JSON, get an interactive map. AI-ready declarative map specs with markers, routes, layers, and data visualization.",
  keywords: [
    "json-maps",
    "declarative maps",
    "AI map generation",
    "MapLibre",
    "GeoJSON",
    "interactive maps",
    "map components",
    "choropleth",
    "heatmap",
    "map spec",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://json-maps.dev",
    siteName: "json-maps",
    title: "json-maps | Declarative Maps from JSON",
    description:
      "Describe a map as JSON, get an interactive map. AI-ready declarative map specs with markers, routes, layers, and data visualization.",
  },
  twitter: {
    card: "summary_large_image",
    title: "json-maps | Declarative Maps from JSON",
    description:
      "Describe a map as JSON, get an interactive map. AI-ready declarative map specs with markers, routes, layers, and data visualization.",
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
