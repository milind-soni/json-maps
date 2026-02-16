# json-maps

Declarative map renderer — drop in a JSON spec, get a full interactive map.

Built on [MapLibre GL](https://maplibre.org/) with [CARTO](https://carto.com/) basemaps. No API keys required.

[Docs](https://json-maps.vercel.app/docs) · [Playground](https://json-maps.vercel.app/playground)

## Install

```bash
npm install json-maps maplibre-gl
```

## Quick Start

```tsx
"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapRenderer } from "json-maps";

const spec = {
  basemap: "dark",
  center: [77.59, 12.97],
  zoom: 12,
  pitch: 45,
  markers: {
    office: {
      coordinates: [77.59, 12.97],
      label: "Office",
      color: "#e74c3c",
      popup: { title: "HQ", description: "Main office" },
    },
  },
};

export default function MyMap() {
  return <MapRenderer spec={spec} />;
}
```

Every field is optional. An empty `{}` gives you a light basemap at world view.

## Spec

### Viewport

| Field | Type | Description |
|-------|------|-------------|
| `basemap` | `"light"` \| `"dark"` \| `"streets"` \| URL | Map style |
| `center` | `[lng, lat]` | Map center |
| `zoom` | `number` | Zoom level (0–24) |
| `pitch` | `number` | Camera tilt (0–85) |
| `bearing` | `number` | Compass rotation (-180–180) |
| `bounds` | `[west, south, east, north]` | Fit to bounding box |
| `projection` | `"mercator"` \| `"globe"` | Map projection |

### Markers

```json
{
  "markers": {
    "tokyo-tower": {
      "coordinates": [139.7454, 35.6586],
      "icon": "landmark",
      "color": "#e74c3c",
      "label": "Tokyo Tower",
      "tooltip": "333m tall observation tower",
      "popup": { "title": "Tokyo Tower", "description": "Iconic landmark" },
      "draggable": true
    }
  }
}
```

21 built-in icons: `map-pin` `star` `heart` `flag` `coffee` `utensils` `hotel` `building-2` `tree-pine` `mountain` `plane` `train` `car` `ship` `bus` `church` `shopping-cart` `camera` `landmark` `tent` `truck`

Need more? Override the `Marker` component slot with any icon library.

### Layers

Six layer types:

**GeoJSON** — points, lines, polygons from URL or inline data:
```json
{
  "layers": {
    "quakes": {
      "type": "geojson",
      "data": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson",
      "style": {
        "pointColor": { "type": "continuous", "attr": "mag", "palette": "OrYel", "domain": [0, 7] },
        "pointRadius": 4
      },
      "tooltip": ["place", "mag"],
      "cluster": true
    }
  }
}
```

**GeoParquet** — load `.parquet` files directly:
```json
{ "type": "parquet", "data": "https://example.com/buildings.parquet" }
```

**Route** — driving/walking/cycling directions via OSRM:
```json
{ "type": "route", "waypoints": [[77.59, 12.97], [72.87, 19.07]], "profile": "driving" }
```

**Heatmap** — point density visualization:
```json
{ "type": "heatmap", "data": "https://example.com/points.geojson", "radius": 20, "intensity": 0.8 }
```

**MVT** — vector tiles:
```json
{ "type": "mvt", "data": "https://tiles.example.com/{z}/{x}/{y}.pbf", "sourceLayer": "buildings" }
```

**Raster** — tile layers (satellite, terrain):
```json
{ "type": "raster", "data": "https://tiles.example.com/{z}/{x}/{y}.png" }
```

### Data-Driven Styling

Colors can be static or data-driven:

```json
{
  "fillColor": { "type": "continuous", "attr": "population", "palette": "Sunset", "domain": [0, 1000000] },
  "pointColor": { "type": "categorical", "attr": "zone_type", "palette": "Bold" }
}
```

Point radius supports data-driven sizing too:
```json
{ "pointRadius": { "type": "continuous", "attr": "mag", "domain": [0, 8], "range": [2, 12] } }
```

### Controls

```json
{
  "controls": {
    "zoom": true,
    "compass": true,
    "fullscreen": true,
    "locate": true,
    "search": true,
    "basemapSwitcher": true,
    "layerSwitcher": true
  }
}
```

### Legend

Auto-generated from data-driven layers:
```json
{ "legend": { "pop": { "layer": "population", "title": "Population" } } }
```

### Widgets

Stat cards overlaid on the map:
```json
{
  "widgets": {
    "stats": {
      "title": "Summary",
      "value": "1,234",
      "description": "Total events",
      "position": "top-right"
    }
  }
}
```

## React API

### Props

```tsx
<MapRenderer
  spec={spec}
  className="h-screen"
  components={{ Marker: CustomMarker }}
  onMarkerClick={(id, coords) => {}}
  onMarkerDragEnd={(id, coords) => {}}
  onLayerClick={(layerId, coords) => {}}
  onViewportChange={(viewport) => {}}
/>
```

### Component Slots

Replace built-in marker, popup, tooltip, or layer tooltip with your own:

```tsx
import { MapRenderer, type MarkerComponentProps } from "json-maps";

function CustomMarker({ marker, color }: MarkerComponentProps) {
  return <div style={{ background: color, borderRadius: "50%", padding: 6 }}>
    <MyIcon name={marker.icon} />
  </div>;
}

<MapRenderer spec={spec} components={{ Marker: CustomMarker }} />
```

### useMap Hook

Access the MapLibre instance programmatically:

```tsx
import { useMap } from "json-maps";

function MyComponent() {
  const map = useMap();
  // map.flyTo({ center: [0, 0], zoom: 5 })
}
```

## AI Integration

json-maps ships a catalog and system prompt for AI code generation:

```tsx
import { mapCatalog } from "json-maps";
// Pass mapCatalog to your LLM as a system prompt
// AI generates valid MapSpec JSON constrained to your catalog
```

## Tailwind CSS

**v4** — add to your CSS:
```css
@source "../node_modules/json-maps/dist";
```

**v3** — add to `tailwind.config.js`:
```js
content: ["./node_modules/json-maps/dist/**/*.js"]
```

## Next.js

Add to `next.config.ts`:
```ts
const config = { transpilePackages: ["json-maps"] };
```

## Development

```bash
npm install
npm run dev        # docs site
npm run build:lib  # library build
```

## License

MIT
