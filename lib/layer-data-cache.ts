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
