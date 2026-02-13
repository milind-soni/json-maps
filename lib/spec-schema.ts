import { z } from "zod";
import { PALETTES } from "./palettes";

/* ---- Popup ---- */

const PopupSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
});

/* ---- Marker ---- */

const MarkerSchema = z.object({
  coordinates: z.tuple([z.number(), z.number()]),
  color: z.string().optional(),
  label: z.string().optional(),
  tooltip: z.string().optional(),
  popup: z.union([z.string(), PopupSchema]).optional(),
  draggable: z.boolean().optional(),
});

/* ---- Color system ---- */

const paletteNames = Object.keys(PALETTES);

const ContinuousColorSchema = z.object({
  type: z.literal("continuous"),
  attr: z.string().min(1),
  palette: z.string().refine((v) => paletteNames.includes(v), {
    message: `palette must be one of: ${paletteNames.join(", ")}`,
  }),
  domain: z.tuple([z.number(), z.number()]).optional(),
  nullColor: z.string().optional(),
});

const CategoricalColorSchema = z.object({
  type: z.literal("categorical"),
  attr: z.string().min(1),
  palette: z.string().refine((v) => paletteNames.includes(v), {
    message: `palette must be one of: ${paletteNames.join(", ")}`,
  }),
  categories: z.array(z.string()).optional(),
  nullColor: z.string().optional(),
});

const ColorValueSchema = z.union([
  z.string(),
  ContinuousColorSchema,
  CategoricalColorSchema,
]);

/* ---- Data-driven size ---- */

const ContinuousSizeSchema = z.object({
  type: z.literal("continuous"),
  attr: z.string().min(1),
  domain: z.tuple([z.number(), z.number()]),
  range: z.tuple([z.number(), z.number()]),
});

const SizeValueSchema = z.union([z.number(), ContinuousSizeSchema]);

/* ---- Layer system ---- */

const LayerStyleSchema = z.object({
  fillColor: ColorValueSchema.optional(),
  pointColor: ColorValueSchema.optional(),
  lineColor: ColorValueSchema.optional(),
  lineWidth: z.number().optional(),
  pointRadius: SizeValueSchema.optional(),
  opacity: z.number().min(0).max(1).optional(),
});

const GeoJsonLayerSchema = z.object({
  type: z.literal("geojson"),
  data: z.union([z.string(), z.record(z.string(), z.unknown())]),
  style: LayerStyleSchema.optional(),
  tooltip: z.array(z.string()).optional(),
});

const LayerSchema = GeoJsonLayerSchema;

/* ---- Map spec ---- */

export const MapSpecSchema = z.object({
  basemap: z.string().optional(),
  center: z.tuple([z.number(), z.number()]).optional(),
  zoom: z.number().min(0).max(24).optional(),
  pitch: z.number().min(0).max(85).optional(),
  bearing: z.number().optional(),
  bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  markers: z.record(z.string(), MarkerSchema).optional(),
  layers: z.record(z.string(), LayerSchema).optional(),
});

/* ---- Validation helpers ---- */

export type ValidationResult =
  | { success: true; data: z.infer<typeof MapSpecSchema> }
  | { success: false; error: string };

/**
 * Validate a parsed JSON object against the MapSpec schema.
 * Returns typed data on success, or a human-readable error string on failure.
 */
export function validateSpec(input: unknown): ValidationResult {
  const result = MapSpecSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }

  // Build a concise error message from Zod issues
  const messages = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });

  return { success: false, error: messages.join("; ") };
}

/**
 * Format validation errors into a string suitable for a repair prompt
 * sent back to the AI so it can self-correct.
 */
export function formatSpecIssues(input: unknown): string | null {
  const result = MapSpecSchema.safeParse(input);
  if (result.success) return null;

  const lines = [
    "The generated map spec has the following errors. Output ONLY the patches needed to fix them:",
  ];
  for (const issue of result.error.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    lines.push(`- ${path}: ${issue.message}`);
  }
  return lines.join("\n");
}

/**
 * Attempt to parse and fix a spec by stripping unknown keys and coercing values.
 * Returns the cleaned spec, or null if the input is fundamentally invalid.
 */
export function autoFixSpec(input: unknown): z.infer<typeof MapSpecSchema> | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null;
  }

  // Use passthrough to keep unknown keys, then strip them
  const result = MapSpecSchema.safeParse(input);
  if (result.success) return result.data;

  // Try stripping unknown keys at the top level
  const stripped = MapSpecSchema.strip().safeParse(input);
  if (stripped.success) return stripped.data;

  return null;
}
