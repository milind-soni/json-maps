import { type MapSpec, type ColorValue, type SizeValue } from "./spec";
import { PALETTES } from "./palettes";

/* ---- Pre-resolve data-driven values to MapLibre expressions at export time ---- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveColor(color: ColorValue): any {
  if (typeof color === "string") return color;

  const palette = PALETTES[color.palette];
  if (!palette || palette.length === 0) return "#888888";

  if (color.type === "continuous") {
    const [min, max] = color.domain ?? [0, 1];
    const steps = palette.length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expr: any[] = ["interpolate", ["linear"], ["get", color.attr]];
    for (let i = 0; i < steps; i++) {
      expr.push(min + (max - min) * (i / (steps - 1)));
      expr.push(palette[i]);
    }
    return expr;
  }

  if (color.type === "categorical") {
    if (!color.categories || color.categories.length === 0)
      return palette[0] ?? "#888888";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expr: any[] = ["match", ["get", color.attr]];
    for (let i = 0; i < color.categories.length; i++) {
      expr.push(color.categories[i]);
      expr.push(palette[i % palette.length]);
    }
    expr.push(color.nullColor ?? "#cccccc");
    return expr;
  }

  return "#888888";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveSize(size: SizeValue, fallback: number): any {
  if (typeof size === "number") return size;
  if (size.type === "continuous") {
    const [dMin, dMax] = size.domain;
    const [rMin, rMax] = size.range;
    return ["interpolate", ["linear"], ["get", size.attr], dMin, rMin, dMax, rMax];
  }
  return fallback;
}

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

/**
 * Pre-resolve data-driven color/size values in the spec to MapLibre expressions.
 * This lets the exported code use the values directly without needing PALETTES.
 */
function resolveSpecForExport(spec: MapSpec): MapSpec {
  const resolved = structuredClone(spec);
  if (!resolved.layers) return resolved;

  for (const layer of Object.values(resolved.layers)) {
    if (layer.type !== "geojson" || !layer.style) continue;
    const s = layer.style;
    if (s.fillColor && typeof s.fillColor !== "string")
      s.fillColor = resolveColor(s.fillColor) as unknown as ColorValue;
    if (s.pointColor && typeof s.pointColor !== "string")
      s.pointColor = resolveColor(s.pointColor) as unknown as ColorValue;
    if (s.lineColor && typeof s.lineColor !== "string")
      s.lineColor = resolveColor(s.lineColor) as unknown as ColorValue;
    if (s.pointRadius && typeof s.pointRadius !== "number")
      s.pointRadius = resolveSize(s.pointRadius, 5) as unknown as SizeValue;
  }
  return resolved;
}

export function generateExportFiles(spec: MapSpec): ExportFile[] {
  const resolved = resolveSpecForExport(spec);
  const specStr = JSON.stringify(resolved, null, 2);

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

    // Add layers
    if (spec.layers) {
      map.on("load", () => {
        for (const [id, layer] of Object.entries(spec.layers)) {
          const sourceId = "layer-" + id;

          if (layer.type === "route") {
            const rs = layer.style || {};
            map.addSource(sourceId, {
              type: "geojson",
              data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: layer.coordinates } },
            });
            const paint: Record<string, unknown> = {
              "line-color": rs.color || "#3b82f6", "line-width": rs.width || 3, "line-opacity": rs.opacity ?? 0.8,
            };
            if (rs.dashed) paint["line-dasharray"] = [6, 3];
            map.addLayer({ id: sourceId + "-line", type: "line", source: sourceId, layout: { "line-join": "round", "line-cap": "round" }, paint });
            continue;
          }

          // GeoJSON layer
          const s = layer.style || {};
          const sourceOpts: Record<string, unknown> = { type: "geojson", data: layer.data };
          if (layer.cluster) {
            const co = layer.clusterOptions || {};
            sourceOpts.cluster = true;
            sourceOpts.clusterRadius = co.radius ?? 50;
            sourceOpts.clusterMaxZoom = co.maxZoom ?? 14;
            sourceOpts.clusterMinPoints = co.minPoints ?? 2;
          }
          map.addSource(sourceId, sourceOpts as maplibregl.SourceSpecification);

          map.addLayer({
            id: sourceId + "-fill", type: "fill", source: sourceId,
            filter: ["any", ["==", ["geometry-type"], "Polygon"], ["==", ["geometry-type"], "MultiPolygon"]],
            paint: { "fill-color": s.fillColor || "#3b82f6", "fill-opacity": s.opacity ?? 0.8 },
          });
          map.addLayer({
            id: sourceId + "-line", type: "line", source: sourceId,
            paint: { "line-color": s.lineColor || "#333333", "line-width": s.lineWidth ?? 1 },
          });

          const circleFilter = layer.cluster
            ? ["all", ["!", ["has", "point_count"]], ["any", ["==", ["geometry-type"], "Point"], ["==", ["geometry-type"], "MultiPoint"]]]
            : ["any", ["==", ["geometry-type"], "Point"], ["==", ["geometry-type"], "MultiPoint"]];
          map.addLayer({
            id: sourceId + "-circle", type: "circle", source: sourceId,
            filter: circleFilter,
            paint: {
              "circle-color": s.pointColor || s.fillColor || "#3b82f6",
              "circle-radius": s.pointRadius || 5,
              "circle-opacity": s.opacity ?? 0.8,
              "circle-stroke-width": s.lineWidth ?? 1, "circle-stroke-color": s.lineColor || "#333333",
            },
          });

          if (layer.cluster) {
            const colors = layer.clusterOptions?.colors || ["#22c55e", "#eab308", "#ef4444"];
            map.addLayer({
              id: sourceId + "-cluster", type: "circle", source: sourceId,
              filter: ["has", "point_count"],
              paint: {
                "circle-color": ["step", ["get", "point_count"], colors[0], 100, colors[1], 750, colors[2]],
                "circle-radius": ["step", ["get", "point_count"], 20, 100, 30, 750, 40],
                "circle-stroke-width": 1, "circle-stroke-color": "#fff", "circle-opacity": 0.85,
              },
            });
            map.addLayer({
              id: sourceId + "-cluster-count", type: "symbol", source: sourceId,
              filter: ["has", "point_count"],
              layout: { "text-field": "{point_count_abbreviated}", "text-size": 12 },
              paint: { "text-color": "#fff" },
            });
            map.on("click", sourceId + "-cluster", async (e) => {
              const features = map.queryRenderedFeatures(e.point, { layers: [sourceId + "-cluster"] });
              if (!features.length) return;
              const src = map.getSource(sourceId) as maplibregl.GeoJSONSource;
              const zoom = await src.getClusterExpansionZoom(features[0].properties?.cluster_id);
              map.easeTo({ center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number], zoom });
            });
          }

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

    // Add controls
    if (spec.controls) {
      const c = spec.controls;
      const pos = c.position || "top-right";
      if (c.zoom !== false) map.addControl(new maplibregl.NavigationControl({ showCompass: c.compass !== false }), pos);
      if (c.fullscreen) map.addControl(new maplibregl.FullscreenControl(), pos);
      if (c.locate) map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true }), pos);
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
