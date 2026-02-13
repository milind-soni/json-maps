# json-maps

A declarative JSON spec for interactive maps. Write JSON, get a map.

Built on [MapLibre GL](https://maplibre.org/) (free, no API key) with [CARTO](https://carto.com/) basemaps and React.

## Quick Start

```json
{
  "basemap": "dark",
  "center": [77.59, 12.97],
  "zoom": 12,
  "pitch": 45
}
```

Every field is optional. An empty `{}` gives you a light basemap at world view.

## Spec

| Field | Type | Description |
|-------|------|-------------|
| `basemap` | `"light"` \| `"dark"` \| `"streets"` \| URL | Map style |
| `center` | `[lng, lat]` | Map center |
| `zoom` | `number` | Zoom level 0-24 |
| `pitch` | `number` | Camera tilt 0-85 |
| `bearing` | `number` | Camera rotation -180 to 180 |
| `bounds` | `[west, south, east, north]` | Fit to bounding box |

More coming: markers, layers, controls, widgets, color system, DuckDB WASM data engine, event system.

## Development

```bash
npm install
npm run dev
```

## License

MIT
