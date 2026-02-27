import { z } from "zod";

const TextOverlaySchema = z.object({
  text: z.string().min(1),
  position: z.enum(["top", "bottom", "center"]),
  style: z.enum(["title", "subtitle", "caption"]).optional(),
});

const ViewSchema = z.object({
  center: z.tuple([z.number(), z.number()]),
  zoom: z.number().min(0).max(24),
  pitch: z.number().min(0).max(85).optional(),
  bearing: z.number().optional(),
});

const KeyframeSchema = z.object({
  time: z.number().min(0),
  duration: z.number().min(0),
  easing: z.enum(["linear", "ease-in", "ease-out", "ease-in-out"]).optional(),
  view: ViewSchema,
  spec: z.record(z.string(), z.unknown()).optional(),
  overlay: TextOverlaySchema.optional(),
});

export const AnimationSpecSchema = z.object({
  fps: z.number().min(1).max(60).default(30),
  duration: z.number().min(0.1),
  width: z.number().min(100).max(3840).default(1920),
  height: z.number().min(100).max(2160).default(1080),
  keyframes: z.array(KeyframeSchema).min(1),
});

export type AnimationSpecValidationResult =
  | { success: true; data: z.infer<typeof AnimationSpecSchema> }
  | { success: false; error: string };

export function validateAnimationSpec(input: unknown): AnimationSpecValidationResult {
  const result = AnimationSpecSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }

  const messages = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });

  return { success: false, error: messages.join("; ") };
}

export function autoFixAnimationSpec(input: unknown): z.infer<typeof AnimationSpecSchema> | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null;
  }

  const result = AnimationSpecSchema.safeParse(input);
  if (result.success) return result.data;

  // Try with defaults applied
  const withDefaults = {
    fps: 30,
    width: 1920,
    height: 1080,
    ...(input as Record<string, unknown>),
  };

  const retry = AnimationSpecSchema.safeParse(withDefaults);
  if (retry.success) return retry.data;

  return null;
}
