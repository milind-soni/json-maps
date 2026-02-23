import type { ViewportBounds } from "./spec";
import type { SQLQueryResult } from "./sql-template";
import { layerDataCache } from "./layer-data-cache";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AsyncDuckDB = any;

let dbPromise: Promise<AsyncDuckDB> | null = null;
const registeredTables = new Set<string>();

async function initDuckDB(): Promise<AsyncDuckDB> {
  // Load from esm.sh to avoid Turbopack bundling issues — esm.sh auto-bundles apache-arrow
  // @ts-ignore — runtime CDN import, not resolvable by TypeScript
  const duckdb = await import(/* webpackIgnore: true */ "https://esm.sh/@duckdb/duckdb-wasm@1.32.0");
  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);

  if (!bundle.mainWorker || !bundle.mainModule) {
    throw new Error("[duckdb] Bundle selection failed — no mainWorker or mainModule");
  }

  // Convert to absolute URLs so the worker can resolve resources
  const workerScriptUrl = new URL(bundle.mainWorker, globalThis.location.origin).href;
  const mainModule = new URL(bundle.mainModule, globalThis.location.origin).href;
  const pthreadWorker = bundle.pthreadWorker
    ? new URL(bundle.pthreadWorker, globalThis.location.origin).href
    : undefined;

  // Create blob worker to avoid CORS/CSP issues (pattern from sqlrooms)
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${workerScriptUrl}");`], { type: "text/javascript" }),
  );

  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);

  const db = new duckdb.AsyncDuckDB(logger, worker);

  await db.instantiate(mainModule, pthreadWorker);
  URL.revokeObjectURL(workerUrl);

  // Load spatial extension (separate statements — DuckDB can't batch in one query() call)
  const conn = await db.connect();
  try {
    await conn.query("INSTALL spatial;");
    await conn.query("LOAD spatial;");
  } catch {
    console.warn("[duckdb] Spatial extension not available — continuing without it");
  } finally {
    await conn.close();
  }

  return db;
}

function getDuckDB(): Promise<AsyncDuckDB> {
  if (!dbPromise) {
    dbPromise = initDuckDB().catch((err) => {
      // Reset so next call retries instead of returning the same rejected promise
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

async function ingestGeoJSON(
  layerId: string,
  fc: GeoJSON.FeatureCollection,
): Promise<void> {
  if (registeredTables.has(layerId)) return;
  const db = await getDuckDB();
  const conn = await db.connect();

  try {
    // Flatten features into row objects with lng/lat extracted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: Record<string, any>[] = [];
    for (const f of fc.features) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row: Record<string, any> = { ...f.properties };
      if (f.geometry && f.geometry.type === "Point") {
        const coords = (f.geometry as GeoJSON.Point).coordinates;
        row.lng = coords[0];
        row.lat = coords[1];
      } else if (f.geometry && "coordinates" in f.geometry) {
        // For polygons/lines, extract first coordinate as a simple centroid
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const flat = (c: any): [number, number] => {
          if (typeof c[0] === "number") return c as [number, number];
          return flat(c[0]);
        };
        const [lng, lat] = flat(f.geometry.coordinates);
        row.lng = lng;
        row.lat = lat;
      }
      rows.push(row);
    }

    if (rows.length === 0) return;

    // Register JSON data and create table
    const jsonStr = JSON.stringify(rows);
    await db.registerFileText(`${layerId}.json`, jsonStr);
    await conn.query(
      `CREATE OR REPLACE TABLE "${layerId}" AS SELECT * FROM read_json_auto('${layerId}.json')`,
    );
    registeredTables.add(layerId);
  } finally {
    await conn.close();
  }
}

async function ingestParquetURL(
  layerId: string,
  url: string,
): Promise<void> {
  if (registeredTables.has(layerId)) return;
  const db = await getDuckDB();
  const conn = await db.connect();

  try {
    await conn.query(
      `CREATE OR REPLACE TABLE "${layerId}" AS SELECT * FROM read_parquet('${url}')`,
    );
    registeredTables.add(layerId);
  } finally {
    await conn.close();
  }
}

/** Ensure a layer's data is available as a DuckDB table */
export async function ensureTable(layerId: string): Promise<boolean> {
  if (registeredTables.has(layerId)) return true;

  // Try parquet URL first (more efficient — DuckDB reads directly)
  const parquetUrl = layerDataCache.getParquetURL(layerId);
  if (parquetUrl) {
    await ingestParquetURL(layerId, parquetUrl);
    return true;
  }

  // Fall back to GeoJSON
  const fc = layerDataCache.getGeoJSON(layerId);
  if (fc) {
    await ingestGeoJSON(layerId, fc);
    return true;
  }

  return false;
}

export async function executeQuery(
  sql: string,
  bounds?: ViewportBounds,
): Promise<SQLQueryResult> {
  const db = await getDuckDB();
  const conn = await db.connect();

  try {
    // Substitute viewport variables
    let query = sql;
    if (bounds) {
      query = query
        .replace(/\$west/g, String(bounds.west))
        .replace(/\$east/g, String(bounds.east))
        .replace(/\$south/g, String(bounds.south))
        .replace(/\$north/g, String(bounds.north))
        .replace(/\$zoom/g, String(Math.round(bounds.zoom)));
    }

    const result = await conn.query(query);
    const columns: string[] = result.schema.fields.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (f: any) => f.name as string,
    );

    // Use columnar access (getChild/get) — more reliable than toArray() row proxies
    const numRows = result.numRows;
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < numRows; i++) {
      const obj: Record<string, unknown> = {};
      for (const col of columns) {
        const vec = result.getChild(col);
        const val = vec?.get(i);
        // Convert BigInt to Number for JSON compatibility
        obj[col] = typeof val === "bigint" ? Number(val) : val;
      }
      rows.push(obj);
    }

    return { columns, rows };
  } finally {
    await conn.close();
  }
}

export function dropTable(layerId: string): void {
  registeredTables.delete(layerId);
  if (dbPromise) {
    dbPromise.then(async (db) => {
      const conn = await db.connect();
      try {
        await conn.query(`DROP TABLE IF EXISTS "${layerId}"`);
      } finally {
        await conn.close();
      }
    }).catch(() => { /* ignore */ });
  }
}

