import { parquetMetadataAsync, parquetReadObjects } from "hyparquet";
import type { AsyncBuffer, FileMetaData } from "hyparquet";
import { compressors } from "hyparquet-compressors";

/**
 * Create an AsyncBuffer from a full ArrayBuffer.
 */
function bufferFromArrayBuffer(buf: ArrayBuffer): AsyncBuffer {
  return {
    byteLength: buf.byteLength,
    slice(start: number, end: number) {
      return buf.slice(start, end);
    },
  };
}

/**
 * Fetch a parquet file as an ArrayBuffer.
 * Tries direct fetch first. If CORS blocks it, falls back to /api/proxy.
 */
async function fetchParquetBuffer(url: string): Promise<AsyncBuffer> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    return bufferFromArrayBuffer(buf);
  } catch {
    // CORS or network error — try proxy
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error(`Proxy fetch failed: ${res.status}`);
    const buf = await res.arrayBuffer();
    return bufferFromArrayBuffer(buf);
  }
}

/**
 * Load a GeoParquet file from a URL and return a GeoJSON FeatureCollection.
 *
 * hyparquet auto-detects GeoParquet geometry columns from the `geo` metadata key
 * and decodes WKB geometry to GeoJSON objects via its built-in parsers.
 */
export async function loadGeoParquet(
  url: string,
  geometryColumn?: string,
): Promise<GeoJSON.FeatureCollection> {
  const file = await fetchParquetBuffer(url);
  const metadata: FileMetaData = await parquetMetadataAsync(file);

  // Find geometry column name from GeoParquet metadata
  let geomCol = geometryColumn;
  if (!geomCol) {
    const geoMeta = metadata.key_value_metadata?.find((kv) => kv.key === "geo")?.value;
    if (geoMeta) {
      try {
        const geo = JSON.parse(geoMeta);
        geomCol = geo.primary_column ?? Object.keys(geo.columns ?? {})[0];
      } catch {
        // Invalid geo metadata — fall through to default
      }
    }
    if (!geomCol) geomCol = "geometry";
  }

  // Read all rows as objects — hyparquet auto-decodes geometry columns to GeoJSON
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = await parquetReadObjects({ file, metadata, compressors });

  const features: GeoJSON.Feature[] = [];
  for (const row of rows) {
    const geometry = row[geomCol];
    if (!geometry || !geometry.type) continue;

    // Build properties from all non-geometry columns
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {};
    for (const key of Object.keys(row)) {
      if (key === geomCol) continue;
      const val = row[key];
      // Convert BigInt to Number for JSON compatibility
      if (typeof val === "bigint") {
        properties[key] = Number(val);
      } else if (val instanceof Date) {
        properties[key] = val.toISOString();
      } else {
        properties[key] = val;
      }
    }

    features.push({ type: "Feature", geometry, properties });
  }

  return { type: "FeatureCollection", features };
}
