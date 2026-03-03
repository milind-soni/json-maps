import { z } from "zod";
import { MapSpecSchema } from "./spec-schema";

/* ---- Shared sub-schemas ---- */

const StoryOverlaySchema = z.object({
  text: z.string().min(1),
  position: z.enum(["top", "bottom", "center"]),
  style: z.enum(["title", "subtitle", "caption"]).optional(),
});

const StoryMediaSchema = z.object({
  type: z.enum(["image", "video"]),
  url: z.string().min(1),
  alt: z.string().optional(),
  caption: z.string().optional(),
});

const ViewSchema = z.object({
  center: z.tuple([z.number(), z.number()]),
  zoom: z.number().min(0).max(24),
  pitch: z.number().min(0).max(85).optional(),
  bearing: z.number().optional(),
});

/* ---- Chapter schema ---- */

const StoryChapterSchema = z.object({
  id: z.string().min(1),
  heading: z.string().min(1),
  content: z.string().min(1),
  media: StoryMediaSchema.optional(),
  view: ViewSchema,
  easing: z.enum(["linear", "ease-in", "ease-out", "ease-in-out"]).optional(),
  spec: z.record(z.string(), z.unknown()).optional(),
  overlay: StoryOverlaySchema.optional(),
  duration: z.string().optional(),
});

/* ---- Story spec schema ---- */

export const StorySpecSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  author: z.string().optional(),
  theme: z.enum(["light", "dark"]).optional(),
  layout: z.enum(["sidebar-left", "sidebar-right", "overlay-center", "overlay-left"]).optional(),
  baseSpec: MapSpecSchema.optional(),
  chapters: z.array(StoryChapterSchema).min(1),
});

/* ---- Validation helpers ---- */

export type StoryValidationResult =
  | { success: true; data: z.infer<typeof StorySpecSchema> }
  | { success: false; error: string };

/**
 * Validate a parsed JSON object against the StorySpec schema.
 */
export function validateStorySpec(input: unknown): StoryValidationResult {
  const result = StorySpecSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const messages = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });

  return { success: false, error: messages.join("; ") };
}

/**
 * Format validation errors into a string suitable for an AI repair prompt.
 */
export function formatStorySpecIssues(input: unknown): string | null {
  const result = StorySpecSchema.safeParse(input);
  if (result.success) return null;

  const lines = [
    "The generated story spec has the following errors. Output ONLY the corrected JSON:",
  ];
  for (const issue of result.error.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    lines.push(`- ${path}: ${issue.message}`);
  }
  return lines.join("\n");
}

/**
 * Attempt to fix a story spec by stripping unknown keys.
 * Returns the cleaned spec, or null if fundamentally invalid.
 */
export function autoFixStorySpec(
  input: unknown,
): z.infer<typeof StorySpecSchema> | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null;
  }

  const result = StorySpecSchema.safeParse(input);
  if (result.success) return result.data;

  const stripped = StorySpecSchema.strip().safeParse(input);
  if (stripped.success) return stripped.data;

  return null;
}
