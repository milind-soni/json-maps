export interface LayerSchema {
  columns: Record<string, string>;
  sampleValues: Record<string, unknown[]>;
  rowCount: number;
}

type LayerDataListener = (layerId: string) => void;

class LayerDataCache {
  private geojsonData = new Map<string, GeoJSON.FeatureCollection>();
  private parquetUrls = new Map<string, string>();
  private listeners: LayerDataListener[] = [];

  setGeoJSON(id: string, fc: GeoJSON.FeatureCollection): void {
    this.geojsonData.set(id, fc);
    this.notify(id);
  }

  setParquetURL(id: string, url: string): void {
    this.parquetUrls.set(id, url);
  }

  getGeoJSON(id: string): GeoJSON.FeatureCollection | undefined {
    return this.geojsonData.get(id);
  }

  getParquetURL(id: string): string | undefined {
    return this.parquetUrls.get(id);
  }

  remove(id: string): void {
    this.geojsonData.delete(id);
    this.parquetUrls.delete(id);
  }

  /** Extract column names, types, and sample values from all cached GeoJSON */
  getSchemas(): Record<string, LayerSchema> {
    const schemas: Record<string, LayerSchema> = {};
    for (const [id, fc] of this.geojsonData) {
      if (!fc.features.length) continue;
      const columns: Record<string, string> = {};
      const sampleValues: Record<string, unknown[]> = {};
      for (const f of fc.features.slice(0, 3)) {
        if (!f.properties) continue;
        for (const [key, val] of Object.entries(f.properties)) {
          if (!columns[key]) columns[key] = typeof val;
          if (!sampleValues[key]) sampleValues[key] = [];
          if (sampleValues[key].length < 2) sampleValues[key].push(val);
        }
      }
      // lng/lat are extracted from geometry during DuckDB ingestion — report them here too
      // so the schema is accurate before DuckDB is initialized
      if (fc.features[0]?.geometry && "coordinates" in fc.features[0].geometry) {
        columns.lng = "number";
        columns.lat = "number";
      }
      schemas[id] = { columns, sampleValues, rowCount: fc.features.length };
    }
    return schemas;
  }

  onData(listener: LayerDataListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(id: string): void {
    for (const l of this.listeners) {
      try { l(id); } catch { /* ignore */ }
    }
  }
}

export const layerDataCache = new LayerDataCache();
