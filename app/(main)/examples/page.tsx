"use client";

import { MapRenderer } from "@/components/map";
import { type MapSpec } from "@/lib/spec";
import { compressToEncodedURIComponent } from "lz-string";

interface Example {
  title: string;
  description: string;
  spec: MapSpec;
}

// Order matters — layout uses index-based spans:
// 0: col-span-2, 1: row-span-2, 4: col-span-2, 6: col-span-2 (Analytics)
const EXAMPLES: Example[] = [
  {
    title: "Live Earthquakes",
    description:
      "Real-time USGS feed with magnitude color scale, legend, and search control.",
    spec: {
      basemap: "dark",
      center: [-120, 37],
      zoom: 3,
      layers: {
        quakes: {
          type: "geojson",
          data: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson",
          style: {
            pointColor: {
              type: "continuous",
              attr: "mag",
              palette: "OrYel",
              domain: [0, 7],
            },
            pointRadius: 4,
            opacity: 0.85,
          },
          tooltip: ["place", "mag", "time"],
        },
      },
      legend: {
        magnitude: {
          layer: "quakes",
          title: "Magnitude",
        },
      },
      controls: {
        zoom: true,
        search: true,
      },
    },
  },
  {
    title: "Road Trip",
    description:
      "Multi-stop driving route from Mumbai to Goa along the western coast.",
    spec: {
      basemap: "streets",
      center: [74.2, 16.5],
      zoom: 7,
      layers: {
        route: {
          type: "route",
          from: [72.8777, 19.076],
          to: [73.8278, 15.4909],
          waypoints: [[73.8567, 18.5204]],
          profile: "driving",
          style: {
            color: "#3b82f6",
            width: 4,
          },
        },
      },
      markers: {
        mumbai: {
          coordinates: [72.8777, 19.076],
          label: "Mumbai",
          icon: "building-2",
          color: "#3b82f6",
        },
        pune: {
          coordinates: [73.8567, 18.5204],
          label: "Pune",
          icon: "coffee",
          color: "#8b5cf6",
        },
        goa: {
          coordinates: [73.8278, 15.4909],
          label: "Goa",
          icon: "tent",
          color: "#22c55e",
        },
      },
    },
  },
  {
    title: "Tokyo Landmarks",
    description:
      "Markers with custom colors, popups, and a tilted night-mode camera.",
    spec: {
      basemap: "dark",
      center: [139.75, 35.68],
      zoom: 11,
      pitch: 45,
      markers: {
        "tokyo-tower": {
          coordinates: [139.7454, 35.6586],
          color: "#e74c3c",
          icon: "landmark",
          label: "Tokyo Tower",
          tooltip: "Observation tower · Minato",
          popup: {
            title: "Tokyo Tower",
            description:
              "333m tall communications and observation tower, inspired by the Eiffel Tower",
          },
        },
        shibuya: {
          coordinates: [139.7013, 35.658],
          color: "#3498db",
          icon: "camera",
          label: "Shibuya Crossing",
          tooltip: "Iconic scramble crossing · Shibuya",
          popup: {
            title: "Shibuya Crossing",
            description:
              "World's busiest pedestrian crossing with up to 3,000 people per light change",
          },
        },
        "senso-ji": {
          coordinates: [139.7966, 35.7148],
          color: "#f39c12",
          icon: "church",
          label: "Senso-ji",
          tooltip: "Buddhist temple · Asakusa",
          popup: {
            title: "Senso-ji",
            description:
              "Tokyo's oldest temple, built in 645 AD. The iconic Kaminarimon gate is a symbol of Asakusa.",
          },
        },
      },
    },
  },
  {
    title: "Globe View",
    description:
      "World markers on a globe projection — zoom out to see the full Earth.",
    spec: {
      basemap: "dark",
      projection: "globe",
      center: [20, 20],
      zoom: 1.5,
      markers: {
        nyc: {
          coordinates: [-74.006, 40.7128],
          label: "New York",
          icon: "building-2",
          color: "#3b82f6",
        },
        london: {
          coordinates: [-0.1276, 51.5074],
          label: "London",
          icon: "landmark",
          color: "#e74c3c",
        },
        tokyo: {
          coordinates: [139.6917, 35.6895],
          label: "Tokyo",
          icon: "train",
          color: "#f39c12",
        },
        sydney: {
          coordinates: [151.2093, -33.8688],
          label: "Sydney",
          icon: "ship",
          color: "#22c55e",
        },
        dubai: {
          coordinates: [55.2708, 25.2048],
          label: "Dubai",
          icon: "hotel",
          color: "#8b5cf6",
        },
        "sao-paulo": {
          coordinates: [-46.6333, -23.5505],
          label: "Sao Paulo",
          icon: "coffee",
          color: "#ec4899",
        },
      },
    },
  },
  {
    title: "Heatmap",
    description:
      "Earthquake density as a heatmap — brighter areas have more seismic activity.",
    spec: {
      basemap: "dark",
      center: [-120, 37],
      zoom: 3,
      layers: {
        heat: {
          type: "heatmap",
          data: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson",
          radius: 20,
          intensity: 0.6,
          opacity: 0.8,
          palette: "OrYel",
        },
      },
    },
  },
  {
    title: "Layer Controls",
    description:
      "Toggle between heatmap and point layers with the built-in layer switcher and legend.",
    spec: {
      basemap: "dark",
      center: [-120, 37],
      zoom: 3,
      layers: {
        "seismic-heat": {
          type: "heatmap",
          data: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson",
          radius: 20,
          intensity: 0.5,
          opacity: 0.7,
          palette: "Sunset",
        },
        "seismic-points": {
          type: "geojson",
          data: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson",
          style: {
            pointColor: {
              type: "continuous",
              attr: "mag",
              palette: "Emrld",
              domain: [0, 7],
            },
            pointRadius: 3,
          },
          tooltip: ["place", "mag"],
        },
      },
      controls: {
        layerSwitcher: true,
        zoom: true,
        basemapSwitcher: true,
      },
      legend: {
        mag: {
          layer: "seismic-points",
          title: "Magnitude",
        },
      },
    },
  },
  {
    title: "Analytics Dashboard",
    description:
      "Stat widgets, fullscreen control, and basemap switcher on a tilted map.",
    spec: {
      basemap: "dark",
      center: [77.59, 12.97],
      zoom: 11,
      pitch: 40,
      markers: {
        hq: {
          coordinates: [77.59, 12.97],
          label: "HQ",
          icon: "building-2",
          color: "#3b82f6",
          popup: {
            title: "Headquarters",
            description: "Main office — 120 employees",
          },
        },
        warehouse: {
          coordinates: [77.55, 13.02],
          label: "Warehouse",
          icon: "truck",
          color: "#22c55e",
          popup: {
            title: "Central Warehouse",
            description: "Primary distribution center",
          },
        },
        store: {
          coordinates: [77.63, 12.93],
          label: "Flagship Store",
          icon: "shopping-cart",
          color: "#f39c12",
          popup: {
            title: "Flagship Store",
            description: "Retail location — Koramangala",
          },
        },
      },
      widgets: {
        overview: {
          position: "top-left",
          title: "Overview",
          value: "3",
          description: "Active locations",
          rows: [
            { label: "Employees", value: "186" },
            { label: "Deliveries today", value: "42" },
          ],
        },
      },
      controls: {
        zoom: true,
        compass: true,
        fullscreen: true,
        basemapSwitcher: true,
      },
    },
  },
  {
    title: "Satellite Imagery",
    description:
      "ESRI satellite raster tiles overlaid on the map.",
    spec: {
      center: [77.59, 12.97],
      zoom: 14,
      layers: {
        satellite: {
          type: "raster",
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        },
      },
    },
  },
];

function openInPlayground(spec: MapSpec) {
  const compressed = compressToEncodedURIComponent(
    JSON.stringify(spec, null, 2)
  );
  window.open(`/playground#${compressed}`, "_blank");
}

export default function ExamplesPage() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Examples</h1>
      <p className="text-muted-foreground mb-12">
        Interactive maps built with json-maps. Click any example to open it in
        the playground.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 md:grid-flow-dense gap-4">
        {EXAMPLES.map((example, i) => {
          const isWide = i === 0 || i === 4 || i === 6;
          const isTall = i === 1;
          return (
            <div
              key={example.title}
              className={`group border border-border rounded-xl overflow-hidden flex flex-col transition-shadow hover:shadow-lg ${
                isWide ? "md:col-span-2" : ""
              } ${isTall ? "md:row-span-2" : ""}`}
            >
              <div
                className={`relative flex-shrink-0 ${
                  isTall ? "flex-1 min-h-0" : isWide ? "h-64" : "h-48"
                }`}
              >
                <MapRenderer spec={example.spec} />
              </div>
              <div className="p-4 flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold mb-1">{example.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {example.description}
                  </p>
                </div>
                <button
                  onClick={() => openInPlayground(example.spec)}
                  className="text-xs font-mono text-primary hover:underline mt-3 text-left"
                >
                  Open in Playground &rarr;
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
