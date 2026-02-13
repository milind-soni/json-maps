# json-maps — Project Plan

A declarative JSON spec for interactive maps. Write JSON, get a map.

Built on **MapLibre GL** (free, no API key) with **React** for widgets/overlays.

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
      "data": "<url-or-inline>" | { "url": "<parquet/csv/json>", "sql": "SELECT ..." },
      "filter": "property > value",
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
| Widget positioning | `"top-left" \| "top-right" \| "bottom-left" \| "bottom-right"` | Absolute positioning with Tailwind |
| Color system | Continuous/categorical model | Proven, flexible, CartoColor palettes built in |
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
- Color model:
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
- React components with absolute positioning

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

### Phase 5 — Data Engine (DuckDB WASM)

The performance layer. Instead of only fetching pre-built GeoJSON, json-maps can query data directly in the browser using DuckDB WASM.

#### 5.1 DuckDB WASM Integration
- Load `@duckdb/duckdb-wasm` lazily — only when a layer uses `data.sql` or `data.url` points to `.parquet`
- Initialize a shared DuckDB instance per map (reuse across layers)
- Query Parquet, CSV, JSON files directly via HTTP range requests — no full download needed
- Output query results as GeoJSON FeatureCollections for MapLibre to render

#### 5.2 SQL in the Spec
- Layers can specify a `data` object with `url` + `sql`:
  ```json
  {
    "data": {
      "url": "https://example.com/buildings.parquet",
      "sql": "SELECT *, ST_AsGeoJSON(ST_GeomFromWKB(geometry)) as geom FROM data WHERE height > 50"
    }
  }
  ```
- The `url` is registered as a DuckDB table, then `sql` runs against it
- Spatial extensions (`spatial`) loaded for geometry operations
- Multiple URLs can be joined in a single query
- Falls back to plain URL fetch when no `sql` is provided (current behavior)

#### 5.3 Filtering
- `filter` field on layers for dynamic client-side filtering without re-fetching:
  ```json
  {
    "layers": {
      "buildings": {
        "type": "vector",
        "data": "buildings.parquet",
        "filter": "height > 100 AND zone = 'commercial'"
      }
    }
  }
  ```
- SQL-like filter expressions executed via DuckDB
- Filters update reactively when the spec changes — re-query, re-render
- For non-DuckDB layers (plain GeoJSON), filter evaluates against feature properties client-side

#### 5.4 Performance Strategy
- **Parquet + HTTP range requests** — only fetch the bytes needed, not the whole file
- **Lazy loading** — DuckDB WASM bundle (~4MB) only loads when a layer needs it
- **Shared instance** — one DuckDB instance shared across all layers in a map
- **Web Workers** — DuckDB queries run off the main thread, keeping the map interactive
- **Spatial indexing** — use DuckDB's spatial extension for bbox filtering before sending to MapLibre
- **Streaming results** — for very large queries, stream results in batches to avoid memory spikes

### Phase 6 — Events & Interactions

#### 6.1 Event System
- The map is fully observable — it broadcasts everything that happens:
  - `onViewportChange` — map pans/zooms/rotates (returns center, zoom, bearing, pitch, bounds)
  - `onFeatureClick` — user clicks a feature (returns feature properties + layer id)
  - `onFeatureHover` — user hovers over a feature
  - `onLayerLoad` — a layer finishes loading data
  - `onMarkerClick` — user clicks a marker
  - `onMapReady` — map is fully initialized
  - `onFilterChange` — a layer filter updates
  - `onError` — data fetch or query failure
- Events exposed as React callbacks on the `<MapRenderer>` component
- Also available as a vanilla JS event emitter for non-React usage
- Enables json-maps to drive dashboards, sidebars, charts — the map broadcasts, other components react

#### 6.2 AI-Ready Architecture
- The event bus makes the map readable by AI agents — they can subscribe to events and understand what the user is seeing and doing
- An AI agent watching `onViewportChange` knows what area the user is looking at, and can proactively load relevant data or provide context
- `onFeatureClick` tells the agent which feature the user selected — the agent can explain it, compare it, or drill into it
- Combined with the declarative spec, AI can both **read** (events) and **write** (spec updates) the map
- This makes json-maps a two-way interface for AI: the agent generates a spec to show data, observes user interaction via events, and updates the spec in response
- Example flow: agent generates map → user clicks a district → agent receives click event with properties → agent updates spec to zoom in and load detailed data for that district

#### 6.2 Click Highlighting
- Click a feature to highlight it
- Outline/glow style on selected feature
- `onClick` callback or event system
- Selected feature state accessible via events

#### 6.3 Cluster Layer
- Point clustering for large datasets
- Configurable radius and zoom thresholds
- Expand clusters on click
- Uses MapLibre's native clustering

### Phase 7 — Advanced (Future)

#### 7.1 Deck.gl Integration
- MapLibre + Deck.gl overlay for advanced layer types
- H3 Hex layer (via H3HexagonLayer)
- Arc layer
- Trip/animation layer
- Only loaded when spec uses deck.gl layer types

#### 7.2 Expressions & Dynamic Values
- Data-driven styling via expressions
- Interpolate, match, step functions
- Reference feature properties in style values

#### 7.3 JSONL Streaming (AI Generation)
- RFC 6902 JSON Patch format for streaming updates
- Add/remove/replace operations on spec
- System prompt generation from spec schema
- Enables AI to generate maps incrementally

#### 7.4 Animations
- `flyTo` transitions between viewport states
- Animated layer data updates (morphing geometries, moving points)
- Time-series playback — step through temporal data with a slider
- Configurable easing and duration on all viewport transitions
- Layer entrance animations (fade in, grow from center)

---

## Architecture

```
json-maps/
├── lib/
│   ├── spec.ts          # MapSpec type + basemap resolver
│   ├── colors.ts        # Color system (continuous, categorical, palettes)
│   ├── layers.ts        # Layer processing utilities
│   ├── data-engine.ts   # DuckDB WASM init, query runner, Parquet/CSV loader
│   ├── events.ts        # Event bus — click, hover, viewport change emitter
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
    → Data Engine (DuckDB WASM — query Parquet/CSV, run SQL, apply filters)
    → MapLibre GL map (basemap + viewport)
    → MapMarkers (markers from spec)
    → MapLayers (add sources + layers to map)
    → MapTooltip (hover overlay)
    → MapControls (positioned buttons)
    → Widgets (legend, layers, basemap, geocoder)
    → Event Bus (broadcasts clicks, hovers, viewport changes)
        → Parent app UI (dashboards, sidebars, charts)
        → AI agents (read events, write spec updates)
```

### Widget Positioning

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

### Component Reuse

Where possible, internal React components should be built as standalone, composable pieces. The spec layer translates JSON into these components — so the rendering internals are clean React code that could be used independently. This keeps the architecture flexible: the JSON spec is one interface, but the components underneath are reusable.

Specific components to build as reusable internals:

- **MapControls** — zoom/compass/locate/fullscreen buttons with grouped border styling. The compass rotates dynamically based on map bearing and pitch using CSS transforms. When the spec has `"controls": { "zoom": true }`, the renderer instantiates these components.
- **Marker rendering** — use React portals (`createPortal`) to render custom React content inside MapLibre marker DOM elements. This allows rich marker content (icons, labels, interactive elements) instead of the default pin. Portals keep the React tree intact while rendering into MapLibre-managed DOM.
- **MapPopup / MarkerTooltip** — popup and tooltip components with fade-in animations, rendered as React overlays attached to map coordinates. When the spec says `"popup": "some content"`, the renderer creates a popup component at the marker's position.
- **MapClusterLayer** — point clustering with configurable colors, thresholds, and radius. Clusters expand on click. Uses MapLibre's native clustering under the hood with React rendering for cluster badges.
- **MapRoute** — GeoJSON LineString rendering with configurable color and width. Manages MapLibre source/layer lifecycle (add on mount, remove on unmount). Useful for the vector layer's line geometry support.
- **Theme awareness** — auto-detect light/dark mode from the document (via class or `prefers-color-scheme`) and switch basemap styles accordingly when no explicit basemap is set in the spec. Watch for theme changes via `MutationObserver` on the document element.

---

## Color System

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

## Next Steps

1. ~~**Viewport**~~ ✅ — `center`, `zoom`, `pitch`, `bearing`, `bounds` in spec + renderer
2. **Markers** — add marker map to spec + render with MapLibre Marker API
3. **Vector layer** — GeoJSON data + basic style
4. **Color system** — continuous + categorical with CartoColor palettes
5. **Controls** — zoom, compass, scale bar as React overlays
6. **Legend** — auto-generated from layer styles
7. **DuckDB WASM** — Parquet queries, SQL in spec, client-side filtering
8. **Events** — feature click/hover, viewport change, map ready broadcasts
9. **Animations** — viewport transitions, layer entrance, time-series playback
