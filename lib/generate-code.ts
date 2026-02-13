import { type MapSpec } from "./spec";

export function generateStaticCode(spec: MapSpec): string {
  const specStr = JSON.stringify(spec, null, 2)
    .split("\n")
    .map((line, i) => (i === 0 ? line : `  ${line}`))
    .join("\n");

  return `import { MapRenderer } from "@json-maps/react";

const spec = ${specStr};

export default function MyMap() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <MapRenderer spec={spec} />
    </div>
  );
}`;
}

interface ExportFile {
  name: string;
  path: string;
  content: string;
  lang: "json" | "tsx" | "typescript";
}

export function generateExportFiles(spec: MapSpec): ExportFile[] {
  const specStr = JSON.stringify(spec, null, 2);

  return [
    {
      name: "package.json",
      path: "package.json",
      lang: "json",
      content: JSON.stringify(
        {
          name: "json-maps-export",
          private: true,
          scripts: {
            dev: "next dev",
            build: "next build",
            start: "next start",
          },
          dependencies: {
            next: "^15.0.0",
            react: "^19.0.0",
            "react-dom": "^19.0.0",
            "maplibre-gl": "^5.0.0",
          },
          devDependencies: {
            typescript: "^5.0.0",
            "@types/react": "^19.0.0",
            "@types/node": "^22.0.0",
          },
        },
        null,
        2,
      ),
    },
    {
      name: "tsconfig.json",
      path: "tsconfig.json",
      lang: "json",
      content: JSON.stringify(
        {
          compilerOptions: {
            target: "ES2017",
            lib: ["dom", "dom.iterable", "esnext"],
            jsx: "preserve",
            module: "esnext",
            moduleResolution: "bundler",
            paths: { "@/*": ["./*"] },
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
          },
          include: ["**/*.ts", "**/*.tsx"],
          exclude: ["node_modules"],
        },
        null,
        2,
      ),
    },
    {
      name: "next.config.js",
      path: "next.config.js",
      lang: "typescript",
      content: `/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;`,
    },
    {
      name: "spec.json",
      path: "spec.json",
      lang: "json",
      content: specStr,
    },
    {
      name: "page.tsx",
      path: "app/page.tsx",
      lang: "tsx",
      content: `"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const BASEMAP_STYLES: Record<string, string> = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  streets: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
};

const spec = ${specStr};

function resolveStyle(basemap?: string): string {
  if (!basemap) return BASEMAP_STYLES.light!;
  if (BASEMAP_STYLES[basemap]) return BASEMAP_STYLES[basemap]!;
  if (basemap.startsWith("http")) return basemap;
  return BASEMAP_STYLES.light!;
}

export default function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: resolveStyle(spec.basemap),
      center: spec.center ?? [0, 20],
      zoom: spec.zoom ?? 1.5,
      pitch: spec.pitch ?? 0,
      bearing: spec.bearing ?? 0,
    });

    if (spec.bounds) {
      map.on("load", () => {
        map.fitBounds(spec.bounds as [number, number, number, number], {
          padding: 40,
          duration: 0,
        });
      });
    }

    // Add markers
    if (spec.markers) {
      for (const [, m] of Object.entries(spec.markers)) {
        const marker = new maplibregl.Marker({ color: m.color || undefined })
          .setLngLat(m.coordinates)
          .addTo(map);
        if (m.popup) {
          const p = typeof m.popup === "object" ? m.popup : { description: m.popup };
          const html = [
            p.image ? \`<img src="\${p.image}" style="width:100%;height:128px;object-fit:cover;border-radius:6px 6px 0 0;" />\` : "",
            \`<div style="padding:10px 14px;">\`,
            p.title ? \`<div style="font-weight:600;margin-bottom:2px;">\${p.title}</div>\` : "",
            p.description ? \`<div style="opacity:0.7;font-size:13px;">\${p.description}</div>\` : "",
            \`</div>\`,
          ].join("");
          marker.setPopup(new maplibregl.Popup({ offset: 25, maxWidth: "260px" }).setHTML(html));
        }
      }
    }

    // Add GeoJSON layers
    if (spec.layers) {
      map.on("load", () => {
        for (const [id, layer] of Object.entries(spec.layers)) {
          if (layer.type !== "geojson") continue;
          const s = layer.style || {};
          const sourceId = "layer-" + id;

          map.addSource(sourceId, { type: "geojson", data: layer.data });

          map.addLayer({
            id: sourceId + "-fill", type: "fill", source: sourceId,
            filter: ["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "MultiPolygon"]],
            paint: { "fill-color": s.fillColor || "#3b82f6", "fill-opacity": s.opacity ?? 0.8 },
          });
          map.addLayer({
            id: sourceId + "-line", type: "line", source: sourceId,
            paint: { "line-color": s.lineColor || "#333333", "line-width": s.lineWidth ?? 1 },
          });
          map.addLayer({
            id: sourceId + "-circle", type: "circle", source: sourceId,
            filter: ["any", ["==", ["geometry-type"], "Point"], ["==", ["geometry-type"], "MultiPoint"]],
            paint: {
              "circle-color": s.pointColor || s.fillColor || "#3b82f6",
              "circle-radius": s.pointRadius && s.pointRadius.type === "continuous"
                ? ["interpolate", ["linear"], ["get", s.pointRadius.attr], s.pointRadius.domain[0], s.pointRadius.range[0], s.pointRadius.domain[1], s.pointRadius.range[1]]
                : (s.pointRadius ?? 5),
              "circle-opacity": s.opacity ?? 0.8,
              "circle-stroke-width": s.lineWidth ?? 1, "circle-stroke-color": s.lineColor || "#333333",
            },
          });

          if (layer.tooltip && layer.tooltip.length > 0) {
            const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: "280px" });
            [sourceId + "-fill", sourceId + "-circle", sourceId + "-line"].forEach((sub) => {
              map.on("mousemove", sub, (e) => {
                if (!e.features?.length) return;
                map.getCanvas().style.cursor = "pointer";
                const props = e.features[0].properties || {};
                const html = layer.tooltip.map((c) => props[c] != null ? "<b>" + c + ":</b> " + props[c] : "").filter(Boolean).join("<br>");
                popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
              });
              map.on("mouseleave", sub, () => { map.getCanvas().style.cursor = ""; popup.remove(); });
            });
          }
        }
      });
    }

    return () => map.remove();
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100vw", height: "100vh" }} />
  );
}`,
    },
    {
      name: "layout.tsx",
      path: "app/layout.tsx",
      lang: "tsx",
      content: `export const metadata = { title: "Map" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}`,
    },
  ];
}
