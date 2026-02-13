export interface PopupSpec {
  title?: string;
  description?: string;
  image?: string;
}

export interface MarkerSpec {
  coordinates: [number, number];
  color?: string;
  label?: string;
  tooltip?: string;
  popup?: string | PopupSpec;
  draggable?: boolean;
}

export interface MapSpec {
  basemap?: "light" | "dark" | "streets" | (string & {});
  center?: [number, number];
  zoom?: number;
  pitch?: number;
  bearing?: number;
  bounds?: [number, number, number, number];
  markers?: Record<string, MarkerSpec>;
}

export const BASEMAP_STYLES: Record<string, string> = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  streets: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
};

export function resolveBasemapStyle(basemap?: string): string | null {
  if (!basemap) return BASEMAP_STYLES.light!;
  if (BASEMAP_STYLES[basemap]) return BASEMAP_STYLES[basemap]!;
  if (basemap.startsWith("http")) return basemap;
  return null;
}
