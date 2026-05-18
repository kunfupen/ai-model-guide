import { z } from "zod";

export const Provider = z.enum(["openai", "anthropic", "google", "meta"]);
export type Provider = z.infer<typeof Provider>;

export const Modality = z.enum(["text", "vision", "audio", "video"]);
export type Modality = z.infer<typeof Modality>;

export const Availability = z.enum([
  "api",
  "claude-ai",
  "chatgpt",
  "gemini-app",
  "bedrock",
  "vertex",
  "azure",
  "open-weights",
]);
export type Availability = z.infer<typeof Availability>;

const dateString = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "releaseDate must be YYYY-MM-DD"),
);

export const ModelFrontmatterSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, "slug must be kebab-case"),
  name: z.string().min(1),
  provider: Provider,
  releaseDate: dateString,
  contextWindow: z.number().int().positive(),
  modalities: z.array(Modality).min(1),
  pricing: z
    .object({
      inputPer1M: z.number().nonnegative(),
      outputPer1M: z.number().nonnegative(),
    })
    .optional(),
  availability: z.array(Availability).min(1),
  strengths: z.array(z.string()).default([]),
  officialDocs: z.string().url(),
  tweetIds: z.array(z.string().regex(/^\d+$/, "tweet IDs are numeric")).default([]),
  benchmarks: z
    .array(
      z.object({
        name: z.string().min(1),
        score: z.number().nonnegative(),
        max: z.number().positive().default(100),
        source: z.string().url().optional(),
      }),
    )
    .default([]),
});
export type ModelFrontmatter = z.infer<typeof ModelFrontmatterSchema>;
