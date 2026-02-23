import { PALETTES } from "@/lib/palettes";
import type { ColorValue, SizeValue } from "@/lib/spec";

export const DEFAULT_CENTER: [number, number] = [0, 20];
export const DEFAULT_ZOOM = 1.5;

export const POSITION_CLASSES: Record<string, string> = {
  "top-left": "top-2 left-2",
  "top-right": "top-2 right-2",
  "bottom-left": "bottom-2 left-2",
  "bottom-right": "bottom-2 right-2",
};

export const LAYER_SUB_IDS = ["-fill", "-line", "-circle", "-heatmap", "-cluster", "-cluster-count", "-raster"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function colorValueToExpression(color: ColorValue): any {
  if (typeof color === "string") return color;

  const palette = PALETTES[color.palette];
  if (!palette || palette.length === 0) return "#888888";

  if (color.type === "continuous") {
    const [min, max] = color.domain ?? [0, 1];
    const steps = palette.length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expr: any[] = ["interpolate", ["linear"], ["get", color.attr]];
    for (let i = 0; i < steps; i++) {
      expr.push(min + (max - min) * (i / (steps - 1)));
      expr.push(palette[i]);
    }
    return expr;
  }

  if (color.type === "categorical") {
    if (!color.categories || color.categories.length === 0)
      return palette[0] ?? "#888888";
    // Deduplicate categories — MapLibre requires unique branch labels
    const seen = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const expr: any[] = ["match", ["get", color.attr]];
    let colorIdx = 0;
    for (const cat of color.categories) {
      if (seen.has(cat)) continue;
      seen.add(cat);
      expr.push(cat);
      expr.push(palette[colorIdx % palette.length]);
      colorIdx++;
    }
    expr.push(color.nullColor ?? "#cccccc");
    return expr;
  }

  return "#888888";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sizeValueToExpression(size: SizeValue, fallback: number): any {
  if (typeof size === "number") return size;
  if (size.type === "continuous") {
    const [dMin, dMax] = size.domain;
    const [rMin, rMax] = size.range;
    return ["interpolate", ["linear"], ["get", size.attr], dMin, rMin, dMax, rMax];
  }
  return fallback;
}
