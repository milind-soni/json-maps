/**
 * Compact spec reference for LLM context.
 * Adapted from jsonmaps lib/catalog.ts — kept in sync manually.
 */

export const SPEC_REFERENCE = `# jsonmaps Spec Reference

jsonmaps renders interactive maps from a declarative JSON spec. Pass a MapSpec object to create_map to generate a viewable map URL.

## MapSpec Fields

- basemap: "light" | "dark" | "streets" (or custom MapLibre style URL)
- center: [longitude, latitude] — e.g. [-73.98, 40.75] for New York
- zoom: 0-24 (city ~11, neighborhood ~14, street ~17)
- pitch: 0-85 (tilt angle in degrees)
- bearing: rotation in degrees
- bounds: [west, south, east, north] — auto-fit to bounds
- projection: "mercator" | "globe"
- markers: named map of markers
- layers: named map of data layers
- controls: map UI controls
- legend: named map of legend overlays
- widgets: named map of stat card overlays

## Markers

Each marker has:
- coordinates: [longitude, latitude] (required)
- color: hex string (e.g. "#e74c3c")
- icon: "map-pin", "star", "heart", "flag", "coffee", "utensils", "hotel", "building-2", "tree-pine", "mountain", "plane", "train", "car", "ship", "bus", "truck", "church", "shopping-cart", "camera", "landmark", "tent"
- label: text below marker
- tooltip: hover text
- popup: string OR { title, description, image }
- draggable: boolean

## Layers

### GeoJSON (type: "geojson")
- data: URL string or inline GeoJSON object
- style: { fillColor, pointColor, lineColor, lineWidth, pointRadius, opacity }
- tooltip: string or ["prop1", "prop2"]
- cluster: true for point clustering
- clusterOptions: { radius, maxZoom, minPoints, colors }

### Route (type: "route")
- coordinates: [[lng,lat], ...] for manual path
- OR from/to: [lng,lat] for OSRM auto-routing
- waypoints: intermediate stops
- profile: "driving" | "walking" | "cycling"
- style: { color, width, opacity, dashed }

### Heatmap (type: "heatmap")
- data: URL or inline GeoJSON of Points
- weight: property name for point weight
- radius: pixel radius (default 30)
- intensity: multiplier (default 1)
- palette: color ramp name (default "OrYel")

### Vector Tiles (type: "mvt")
- url: tile URL with {z}/{x}/{y} template (NOT for .pmtiles files — use type "pmtiles" instead)
- sourceLayer: layer name in tiles (required)
- style: same as GeoJSON
- filter: MapLibre filter expression

### Raster Tiles (type: "raster")
- url: tile URL with {z}/{x}/{y} template (NOT for .pmtiles files — use type "pmtiles" instead)
- tileSize: pixels (default 256)
- opacity: 0-1

### GeoParquet (type: "parquet")
- data: URL to .parquet file
- style, tooltip, cluster: same as GeoJSON

### PMTiles (type: "pmtiles") — PREFERRED for any .pmtiles URL
- IMPORTANT: If a URL ends in .pmtiles, ALWAYS use type "pmtiles", never "mvt" or "raster"
- url: URL to a .pmtiles file (static hosting, no tile server needed)
- sourceLayer: layer name in vector tiles (required for vector PMTiles, omit for raster)
- style: same as GeoJSON (for vector PMTiles)
- opacity: 0-1 (for raster PMTiles)
- filter: MapLibre filter expression
- attribution: attribution text

## Data-Driven Styling

Continuous color: { "type": "continuous", "attr": "population", "palette": "Sunset", "domain": [0, 1000000] }
Categorical color: { "type": "categorical", "attr": "type", "palette": "Bold", "categories": ["residential", "commercial"] } — categories array is REQUIRED for colors to vary
Continuous size: { "type": "continuous", "attr": "mag", "domain": [0, 8], "range": [2, 12] }

## Palettes

Sequential: Burg, RedOr, OrYel, Peach, PinkYl, Mint, BluGrn, DarkMint, Emrld, BluYl, Teal, Purp, Sunset, SunsetDark, Magenta
Diverging: TealRose, Geyser, Temps, Fall, ArmyRose, Tropic
Categorical: Bold, Pastel, Antique, Vivid, Prism, Safe

## Controls

- zoom: zoom buttons
- compass: north arrow
- fullscreen: fullscreen toggle
- locate: locate-me button
- basemapSwitcher: light/dark/streets toggle
- search: geocoding search bar
- layerSwitcher: layer visibility panel
- position: "top-left" | "top-right" | "bottom-left" | "bottom-right"

## SQL Widgets (DuckDB-WASM)

Widgets can run SQL queries against layer data in-browser using DuckDB-WASM. Add a sql field to any widget:
- sql.query: SQL string. Table names = layer IDs. Use $west, $east, $south, $north, $zoom for viewport bounds.
- sql.refreshOn: "viewport" (re-runs on pan/zoom) or "once" (runs once on load, default)
- sql.debounce: ms delay for viewport queries (default 0 — instant updates while panning)
- Use {{column}} templates in value, description, and rows to display query results from row 0.
- DuckDB-WASM loads lazily — only when a widget has sql. GeoJSON features get lng/lat columns extracted from Point geometry.

Example:
{
  "layers": {
    "quakes": {
      "type": "geojson",
      "data": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson"
    }
  },
  "widgets": {
    "stats": {
      "position": "top-left",
      "title": "Earthquakes in View",
      "sql": {
        "query": "SELECT COUNT(*) as count, ROUND(AVG(mag),1) as avg_mag FROM quakes WHERE lng BETWEEN $west AND $east AND lat BETWEEN $south AND $north",
        "refreshOn": "viewport"
      },
      "value": "{{count}}",
      "description": "Avg magnitude: {{avg_mag}}"
    }
  }
}

## Common Coordinates

- New York: [-73.98, 40.75]
- San Francisco: [-122.41, 37.77]
- London: [-0.12, 51.50]
- Tokyo: [139.69, 35.68]
- Paris: [2.35, 48.85]
- Mumbai: [72.87, 19.07]

## Examples

Simple markers:
{
  "basemap": "dark",
  "center": [2.35, 48.85],
  "zoom": 12,
  "markers": {
    "eiffel": { "coordinates": [2.2945, 48.8584], "color": "#f39c12", "icon": "landmark", "tooltip": "Eiffel Tower" }
  }
}

Data layer with styling:
{
  "center": [-120, 37],
  "zoom": 3,
  "layers": {
    "quakes": {
      "type": "geojson",
      "data": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson",
      "style": { "pointColor": { "type": "continuous", "attr": "mag", "palette": "OrYel", "domain": [0, 8] } },
      "tooltip": ["place", "mag"]
    }
  }
}

Route:
{
  "center": [-73.975, 40.765],
  "zoom": 14,
  "layers": {
    "route": { "type": "route", "from": [-73.9855, 40.758], "to": [-73.9654, 40.7829], "profile": "driving", "style": { "color": "#3b82f6", "width": 4 } }
  }
}

PMTiles with categorical styling:
{
  "center": [-98, 39],
  "zoom": 5,
  "layers": {
    "cropland": {
      "type": "pmtiles",
      "url": "https://data.source.coop/fiboa/us-usda-cropland/us_usda_cropland.pmtiles",
      "sourceLayer": "us_usda_cropland",
      "style": { "fillColor": { "type": "categorical", "attr": "crop:name", "palette": "Bold", "categories": ["Corn", "Soybeans", "Winter Wheat", "Cotton", "Alfalfa"] }, "opacity": 0.7 },
      "tooltip": ["crop:name"]
    }
  }
}

SQL widget with live viewport stats:
{
  "basemap": "dark",
  "center": [-120, 37],
  "zoom": 3,
  "layers": {
    "quakes": {
      "type": "geojson",
      "data": "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson",
      "style": { "pointColor": { "type": "continuous", "attr": "mag", "palette": "OrYel", "domain": [0, 8] } },
      "tooltip": ["place", "mag"]
    }
  },
  "widgets": {
    "stats": {
      "position": "top-left",
      "title": "Earthquakes in View",
      "sql": { "query": "SELECT COUNT(*) as count, ROUND(AVG(mag),1) as avg_mag FROM quakes WHERE lng BETWEEN $west AND $east AND lat BETWEEN $south AND $north", "refreshOn": "viewport" },
      "value": "{{count}}",
      "description": "Avg magnitude: {{avg_mag}}"
    }
  }
}
`;
