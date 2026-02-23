import registryData from "./data-registry.json";

export interface RegistryEntry {
  id: string;
  name: string;
  description: string;
  url: string;
  format:
    | "geojson"
    | "mvt"
    | "raster"
    | "pmtiles"
    | "parquet"
    | "geojson-api";
  category: "boundaries" | "live-data" | "basemaps" | "datasets" | "tiles";
  tags: string[];
  license: string;
  source: string;
  properties?: string[];
  joinKey?: string;
  geometry?: "point" | "line" | "polygon" | "mixed";
  size?: string;
  /** For live data: suggested refresh interval in seconds */
  refreshInterval?: number;
  /** Default viewport bounds [west, south, east, north] */
  bounds?: [number, number, number, number];
  /** For MVT entries: source layer name */
  sourceLayer?: string;
}

export const registry: RegistryEntry[] = registryData as RegistryEntry[];

/** Look up a registry entry by ID. */
export function getEntry(id: string): RegistryEntry | undefined {
  return registry.find((e) => e.id === id);
}

/** Search registry entries by a query string (matches id, name, tags, description). */
export function searchRegistry(query: string): RegistryEntry[] {
  const q = query.toLowerCase();
  return registry.filter(
    (e) =>
      e.id.includes(q) ||
      e.name.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.tags.some((t) => t.includes(q)),
  );
}

/** Get all entries in a category. */
export function getByCategory(
  category: RegistryEntry["category"],
): RegistryEntry[] {
  return registry.filter((e) => e.category === category);
}

/**
 * Resolve a `registry:<id>` string to its URL and entry.
 * Returns null if the string doesn't start with `registry:` or the ID isn't found.
 */
export function resolveRegistryUrl(
  dataValue: string,
): { url: string; entry: RegistryEntry } | null {
  if (!dataValue.startsWith("registry:")) return null;
  const id = dataValue.slice("registry:".length);
  const entry = getEntry(id);
  if (!entry) return null;
  return { url: entry.url, entry };
}

/**
 * Generate a summary of the registry for inclusion in AI system prompts.
 * Groups entries by category and formats them as readable text.
 */
export function generateRegistrySummary(): string {
  const lines: string[] = [];
  lines.push(
    "Available data sources (use these URLs directly — do NOT make up URLs):",
  );

  const categories: Array<{
    key: RegistryEntry["category"];
    label: string;
  }> = [
    { key: "boundaries", label: "Boundaries" },
    { key: "live-data", label: "Live Data" },
    { key: "datasets", label: "Datasets" },
    { key: "tiles", label: "Tiles (MVT)" },
  ];

  for (const { key, label } of categories) {
    const entries = getByCategory(key);
    if (entries.length === 0) continue;

    lines.push(`  ${label}:`);
    for (const e of entries) {
      let line = `    - ${e.name}: ${e.url}`;
      const meta: string[] = [];
      if (e.format !== "geojson") meta.push(e.format);
      if (e.size) meta.push(e.size);
      if (meta.length > 0) line += ` (${meta.join(", ")})`;
      if (e.properties && e.properties.length > 0) {
        line += ` — properties: ${e.properties.join(", ")}`;
      }
      if (e.sourceLayer) {
        line += `. sourceLayer: "${e.sourceLayer}"`;
      }
      lines.push(line);
    }
  }

  return lines.join("\n");
}
