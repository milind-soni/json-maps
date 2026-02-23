import { PMTiles } from "pmtiles";

export interface PMTilesMeta {
  tileType: "vector" | "raster" | "unknown";
  layers: {
    id: string;
    fields: Record<string, string>;
  }[];
  bounds: [number, number, number, number] | null;
  center: [number, number] | null;
  minZoom: number;
  maxZoom: number;
}

/**
 * Fetch PMTiles metadata (header + TileJSON) from a URL.
 * Uses HTTP range requests — only reads the header, not the full file.
 */
export async function fetchPMTilesMeta(url: string): Promise<PMTilesMeta> {
  const pm = new PMTiles(url);
  const header = await pm.getHeader();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metadata = (await pm.getMetadata()) as any;

  // Determine tile type from header
  // TileType enum: 0=unknown, 1=mvt, 2=png, 3=jpeg, 4=webp, 5=avif
  const tileType = header.tileType === 1 ? "vector" as const
    : [2, 3, 4, 5].includes(header.tileType) ? "raster" as const
    : "unknown" as const;

  // Extract vector_layers from TileJSON metadata
  const vectorLayers = metadata?.vector_layers ?? metadata?.tilestats?.layers ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layers = vectorLayers.map((vl: any) => ({
    id: vl.id as string,
    fields: (vl.fields ?? {}) as Record<string, string>,
  }));

  const bounds = header.minLon != null && header.maxLon != null
    ? [header.minLon, header.minLat, header.maxLon, header.maxLat] as [number, number, number, number]
    : null;

  const center = header.centerLon != null && header.centerLat != null
    ? [header.centerLon, header.centerLat] as [number, number]
    : null;

  return {
    tileType,
    layers,
    bounds,
    center,
    minZoom: header.minZoom,
    maxZoom: header.maxZoom,
  };
}
