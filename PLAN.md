# json-maps — Project Plan

A declarative JSON spec for interactive maps. Write JSON, get a map.

Built on **MapLibre GL** (free, no API key) with **React** for widgets/overlays.
Inspired by [json-render](https://github.com/AlfredPros/json-render) (spec → renderer pattern), [mapcn](https://github.com/milind-soni/mapcn) (MapLibre components), and [fusedmaps](https://github.com/milind-soni/fusedmaps) (data-driven geospatial viz).

---

## What We Have Today

- **Website/landing page** — Next.js app at `/json-maps/` with AI demo, playground page
- **`lib/spec.ts`** — `MapSpec` type with basemap field, CARTO basemap resolver
- **`components/map-renderer.tsx`** — Basic renderer: takes spec, renders MapLibre map
- **`components/playground.tsx`** — JSON editor + live map preview (100ms debounce)
- Basemaps: `light` (positron), `dark` (dark-matter), `streets` (voyager), or custom URL

---

## Spec Format Design

The spec is a single JSON object. Every field is optional — an empty `{}` gives you a light basemap at world view.

```jsonc
{
  // Basemap
  "basemap": "light" | "dark" | "streets" | "<custom-style-url>",

  // Viewport
  "center": [longitude, latitude],
  "zoom": 1.5,
  "pitch": 0,
  "bearing": 0,
  "bounds": [west, south, east, north],  // fit-bounds alternative to center/zoom

  // Markers
  "markers": {
    "<marker-id>": {
      "coordinates": [longitude, latitude],
      "color": "#e74c3c",
      "label": "Hello",
      "popup": "Popup content",
      "draggable": false
    }
  },

  // Layers (named map, not array)
  "layers": {
    "<layer-id>": {
      "type": "vector" | "mvt" | "raster" | "pmtiles" | "hex",
      "name": "Display Name",
      "visible": true,
      "data": "<geojson-url-or-inline>",
      "style": { ... },
      "tooltip": ["prop1", "prop2"]
    }
  },

  // Controls
  "controls": {
    "zoom": true,
    "compass": false,
    "locate": false,
    "fullscreen": false,
    "scale": false,
    "position": "bottom-right"
  },

  // Widgets
  "widgets": {
    "legend": { "position": "top-right", "expanded": true },
    "layers": { "position": "top-left" },
    "basemap": { "position": "bottom-right" },
    "geocoder": false
  }
}
```

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layers as named map vs array | Named map (`{ "my-layer": {...} }`) | Easier to reference, update, and patch via JSONL |
| MapLibre vs Mapbox | MapLibre | Free, no API key, same GL spec |
| Basemaps | CARTO (positron, dark-matter, voyager) | Free, no token required |
| Widget rendering | React components over map | Easier styling, theming, accessibility vs raw DOM |
| Widget positioning | `"top-left" \| "top-right" \| "bottom-left" \| "bottom-right"` | Matches mapcn pattern, absolute positioning with Tailwind |
| Color system | Adopt fusedmaps' continuous/categorical model | Proven, flexible, CartoColor palettes built in |
| Markers as map vs array | Named map (`{ "marker-1": {...} }`) | Consistent with layers, patchable |

---

## Build Phases

### Phase 1 — Core Map (foundations)

#### 1.1 Basemap ✅ Done
- `basemap` field: `"light"` | `"dark"` | `"streets"` | custom URL
- CARTO basemap resolver
- Reactive updates via `setStyle()`

#### 1.2 Viewport
- `center`: `[lng, lat]`
- `zoom`: number (0–24)
- `pitch`: number (0–85)
- `bearing`: number (-180–180)
- `bounds`: `[west, south, east, north]` — alternative to center/zoom, map fits to bounds
- MapRenderer: set initial viewport, react to spec changes with `flyTo()`

#### 1.3 Markers
- Named marker map: `markers: { "id": { coordinates, color, label, popup, draggable } }`
- Render with MapLibre's `Marker` API
- Optional popup on click
- Optional text label
- Diff markers on spec change (add/remove/update)

### Phase 2 — Data Layers

#### 2.1 Vector Layer (GeoJSON)
- `type: "vector"`
- `data`: inline GeoJSON FeatureCollection or URL to fetch
- Renders points, lines, polygons via MapLibre native layers
- Style properties: `fillColor`, `lineColor`, `opacity`, `lineWidth`, `pointRadius`

#### 2.2 Color System
- Adopt fusedmaps' color model:
  - **Continuous**: `{ type: "continuous", attr: "value", palette: "Viridis", domain: [0, 100] }`
  - **Categorical**: `{ type: "categorical", attr: "type", palette: "Bold" }`
  - Static: `"#ff0000"` or `[255, 0, 0]`
- CartoColor palettes (90+ palettes)
- Used in `style.fillColor` and `style.lineColor`

#### 2.3 MVT Layer (Vector Tiles)
- `type: "mvt"`
- `tileUrl`: `"https://.../{z}/{x}/{y}.pbf"`
- `sourceLayer`: layer name within the MVT
- Same style properties as vector

#### 2.4 Raster Layer
- `type: "raster"`
- `tileUrl`: XYZ tile URL template
- `opacity`: 0–1

#### 2.5 PMTiles Layer
- `type: "pmtiles"`
- `pmtilesUrl`: URL to `.pmtiles` archive
- `sourceLayer`: layer within the archive
- Same style + color system as vector

#### 2.6 Tooltip
- `tooltip: ["property1", "property2"]` on any layer
- Hover tooltip showing listed properties from feature data
- React overlay component positioned at cursor

### Phase 3 — Controls & Widgets

#### 3.1 Map Controls
- Zoom (+/- buttons)
- Compass (bearing reset)
- Locate (geolocation)
- Fullscreen toggle
- Scale bar
- Positioned via `controls.position`: `"top-left"` | `"top-right"` | `"bottom-left"` | `"bottom-right"`
- React components with absolute positioning (mapcn pattern)

#### 3.2 Legend Widget
- Auto-generated from layer styles
- Continuous: gradient bar with domain labels
- Categorical: color swatches with category labels
- Collapsible, positioned via `widgets.legend.position`

#### 3.3 Layer Toggle Widget
- List of layers with visibility checkboxes
- Toggle individual layer visibility
- Drag-to-reorder (stretch goal)
- Positioned via `widgets.layers.position`

#### 3.4 Basemap Switcher Widget
- Thumbnail grid of available basemaps
- Click to switch

#### 3.5 Geocoder Widget
- Search box for place names
- Fly to selected location
- Uses a free geocoding API (Nominatim or similar)

### Phase 4 — Interactions

#### 4.1 Click Highlighting
- Click a feature to highlight it
- Outline/glow style on selected feature
- `onClick` callback or event system

#### 4.2 Cluster Layer
- Point clustering for large datasets
- Configurable radius and zoom thresholds
- Expand clusters on click
- Uses MapLibre's native clustering

### Phase 5 — Advanced (Future)

#### 5.1 Deck.gl Integration
- MapLibre + Deck.gl overlay for advanced layer types
- H3 Hex layer (via H3HexagonLayer)
- Arc layer
- Trip/animation layer
- Only loaded when spec uses deck.gl layer types

#### 5.2 Expressions & Dynamic Values
- Data-driven styling via expressions
- Interpolate, match, step functions
- Reference feature properties in style values

#### 5.3 JSONL Streaming (AI Generation)
- RFC 6902 JSON Patch format for streaming updates
- Add/remove/replace operations on spec
- System prompt generation from spec schema (like json-render's `generateSystemPrompt`)
- Enables AI to generate maps incrementally

#### 5.4 Animations
- `flyTo` transitions between viewport states
- Animated layer data updates
- Time-series playback

---

## Architecture

```
json-maps/
├── lib/
│   ├── spec.ts          # MapSpec type + basemap resolver
│   ├── colors.ts        # Color system (continuous, categorical, palettes)
│   ├── layers.ts        # Layer processing utilities
│   └── utils.ts         # General utilities
├── components/
│   ├── map-renderer.tsx  # Core: spec → MapLibre map
│   ├── map-markers.tsx   # Marker rendering
│   ├── map-layers.tsx    # Layer rendering (vector, mvt, raster, pmtiles)
│   ├── map-tooltip.tsx   # Hover tooltip overlay
│   ├── map-controls.tsx  # Zoom, compass, locate, fullscreen, scale
│   ├── widgets/
│   │   ├── legend.tsx    # Color legend
│   │   ├── layers.tsx    # Layer toggle panel
│   │   ├── basemap.tsx   # Basemap switcher
│   │   └── geocoder.tsx  # Location search
│   ├── playground.tsx    # JSON editor + live preview
│   └── demo.tsx          # Landing page AI demo
```

### Rendering Flow

```
MapSpec (JSON)
  → MapRenderer
    → MapLibre GL map (basemap + viewport)
    → MapMarkers (markers from spec)
    → MapLayers (add sources + layers to map)
    → MapTooltip (hover overlay)
    → MapControls (positioned buttons)
    → Widgets (legend, layers, basemap, geocoder)
```

### Widget Positioning (from mapcn)

```
┌─────────────────────────────┐
│ top-left       top-right    │
│                             │
│          MAP                │
│                             │
│ bottom-left  bottom-right   │
└─────────────────────────────┘
```

Each position slot uses absolute CSS positioning with z-index layering. Multiple widgets in the same position stack vertically with gap.

---

## Color System (from fusedmaps)

### Continuous (numeric gradients)
```json
{
  "type": "continuous",
  "attr": "temperature",
  "palette": "Sunset",
  "domain": [0, 100],
  "steps": 7,
  "nullColor": "#ccc"
}
```

### Categorical (discrete classes)
```json
{
  "type": "categorical",
  "attr": "zone_type",
  "palette": "Bold",
  "categories": ["residential", "commercial", "industrial"]
}
```

### Static
```json
"#e74c3c"
```

### Available Palettes (CartoColor)
Sequential: Viridis, BluGrn, Sunset, SunsetDark, Mint, Emrld, Teal, BluYl, Peach, Burg, RedOr, PinkYl, Earth, ...
Categorical: Bold, Pastel, Antique, Vivid, Prism, Safe, ...
Diverging: TealRose, Geyser, Temps, Fall, ArmyRose, Tropic, ...

---

## Differences from fusedmaps

| Aspect | fusedmaps | json-maps |
|--------|-----------|-----------|
| Map engine | Mapbox GL + Deck.gl | MapLibre GL (free) |
| API tokens | Requires Mapbox token | No token needed |
| Basemaps | Mapbox styles | CARTO free styles |
| Layers | Array of objects | Named map (object keys) |
| Widgets | Raw DOM manipulation | React components |
| Data loading | DuckDB/Parquet/SQL | Fetch URLs or inline GeoJSON |
| Hex layer | Deck.gl H3HexagonLayer | Deferred to Phase 5 (Deck.gl integration) |
| Messaging | PostMessage cross-frame sync | Not planned (React props/context instead) |
| Highlight | Custom highlight system | MapLibre feature state |

---

## Next Steps

1. **Viewport** — add `center`, `zoom`, `pitch`, `bearing` to spec + renderer
2. **Markers** — add marker map to spec + render with MapLibre Marker API
3. **Vector layer** — GeoJSON data + basic style
4. **Color system** — continuous + categorical with CartoColor palettes
5. **Controls** — zoom, compass, scale bar as React overlays
6. **Legend** — auto-generated from layer styles
