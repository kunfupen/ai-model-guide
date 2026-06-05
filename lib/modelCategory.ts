import type { ModelFrontmatter } from "./schemas";

export type ModelCategory = {
  label: string;
  /** Tailwind classes for the badge (bg + text + ring). */
  className: string;
};

/**
 * Classify a model into a lightweight "kind" badge so specialized models
 * (image, audio/voice, coding, embedding) read differently from general LLMs.
 * General-purpose chat models intentionally return null — no badge needed.
 * Heuristic over name + strengths; keep it conservative.
 */
export function modelCategory(m: ModelFrontmatter): ModelCategory | null {
  const hay = `${m.name} ${m.strengths.join(" ")}`.toLowerCase();
  const has = (...terms: string[]) => terms.some((t) => hay.includes(t));

  if (has("image", "vision-generation", "image-generation", "image-editing")) {
    return {
      label: "Image",
      className:
        "bg-fuchsia-500/10 text-fuchsia-600 ring-fuchsia-500/20 dark:text-fuchsia-400",
    };
  }
  if (has("voice", "audio", "speech", "tts", "transcri")) {
    return {
      label: "Audio",
      className: "bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-400",
    };
  }
  if (has("video", "video-generation")) {
    return {
      label: "Video",
      className:
        "bg-violet-500/10 text-violet-600 ring-violet-500/20 dark:text-violet-400",
    };
  }
  if (m.name.toLowerCase().includes("codex") || has("code-specialized")) {
    return {
      label: "Coding",
      className:
        "bg-teal-500/10 text-teal-600 ring-teal-500/20 dark:text-teal-400",
    };
  }
  return null;
}
