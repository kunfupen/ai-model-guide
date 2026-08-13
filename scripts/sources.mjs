// Where to look for newly-released frontier models, per provider.
//
// Two tiers, by design:
//   TIER 1 "api"  — the provider's own /v1/models endpoint. Exact IDs, flips the
//                   instant a model is callable. Needs a key.
//   TIER 2 "open" — auth-free docs/changelog pages, several of which are served
//                   as raw markdown. Slightly laggier but costs nothing, so the
//                   scheduled tracker works with no secrets configured at all.
//
// Sources were verified reachable during research; `extract` turns a payload
// into candidate model identifiers, which are then diffed against the catalog.

export const PROVIDER_SOURCES = {
  anthropic: {
    label: "Anthropic",
    api: {
      url: "https://api.anthropic.com/v1/models?limit=100",
      envKey: "ANTHROPIC_API_KEY",
      headers: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" }),
      extract: (json) =>
        (json?.data ?? []).map((m) => ({ id: m.id, name: m.display_name ?? m.id, released: m.created_at })),
    },
    open: [
      {
        url: "https://platform.claude.com/docs/en/release-notes/overview.md",
        // Dateless modern IDs (claude-opus-5) plus dated legacy ones.
        pattern: /\bclaude-[a-z]+(?:-\d+){1,2}(?:-\d{8})?\b/g,
      },
      {
        url: "https://platform.claude.com/docs/en/about-claude/models/overview.md",
        pattern: /\bclaude-[a-z]+(?:-\d+){1,2}(?:-\d{8})?\b/g,
      },
    ],
  },

  openai: {
    label: "OpenAI",
    api: {
      url: "https://api.openai.com/v1/models",
      envKey: "OPENAI_API_KEY",
      headers: (key) => ({ authorization: `Bearer ${key}` }),
      extract: (json) =>
        (json?.data ?? []).map((m) => ({
          id: m.id,
          name: m.id,
          released: m.created ? new Date(m.created * 1000).toISOString() : null,
        })),
    },
    open: [
      {
        url: "https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml",
        pattern: /\bgpt-\d[\d.]*(?:-[a-z]+)*(?:-\d{4}-\d{2}-\d{2})?\b/g,
      },
      {
        // developers.openai.com serves a raw-markdown twin of every docs page.
        // The HTML page is a JS-heavy SPA that 403s scrapers; the .md does not.
        url: "https://developers.openai.com/api/docs/changelog.md",
        pattern: /\bgpt-\d[\d.]*(?:-[a-z]+)*(?:-\d{4}-\d{2}-\d{2})?\b/g,
      },
    ],
  },

  google: {
    label: "Google (Gemini)",
    api: {
      url: "https://generativelanguage.googleapis.com/v1beta/models",
      envKey: "GEMINI_API_KEY",
      headers: (key) => ({ "x-goog-api-key": key }),
      extract: (json) =>
        (json?.models ?? []).map((m) => ({
          id: String(m.name ?? "").replace(/^models\//, ""),
          name: m.displayName ?? m.name,
          released: null,
        })),
    },
    // NOTE: ai.google.dev returns 403 to unattended scrapers from some networks.
    // Set GEMINI_API_KEY so the models endpoint above is used — that is the
    // reliable path for Google. The pages below are a best-effort fallback.
    open: [
      {
        url: "https://ai.google.dev/gemini-api/docs/changelog",
        pattern: /\bgemini-\d[\d.]*(?:-[a-z]+)*\b/g,
      },
      {
        url: "https://raw.githubusercontent.com/google-gemini/cookbook/main/README.md",
        pattern: /\bgemini-\d[\d.]*(?:-[a-z]+)*\b/g,
      },
    ],
  },

  xai: {
    label: "xAI (Grok)",
    api: {
      url: "https://api.x.ai/v1/models",
      envKey: "XAI_API_KEY",
      headers: (key) => ({ authorization: `Bearer ${key}` }),
      extract: (json) =>
        (json?.data ?? []).map((m) => ({ id: m.id, name: m.id, released: null })),
    },
    open: [
      {
        url: "https://docs.x.ai/docs/models",
        pattern: /\bgrok-\d[\d.]*(?:-[a-z]+)*\b/g,
      },
    ],
  },
};

/**
 * Identifiers that look like models but are not frontier chat models we'd want
 * to catalog. Filtered out to keep the signal-to-noise usable.
 */
export const NOISE = [
  /embedding/i,
  /moderation/i,
  /whisper/i,
  /tts|audio-speech/i,
  /dall-?e|image-gen/i,
  /realtime/i,
  /transcribe/i,
  /-instruct-\d+b/i,
  /aqa/i,
  /learnlm/i,
  /babbage|davinci|curie|ada/i,
  /gpt-3|gpt-4-0|gpt-4-1106|gpt-35/i,
  /\bmodels\b/i,
  // Floating aliases and config variants of a model, not distinct releases.
  // These produced a false alarm (issue #25) reporting three spellings of one
  // Grok 4.20 build: "...-experimental-beta-latest", "...-multi-agent-...", etc.
  /[-.]latest$/i,
  /experimental/i,
  /[-.]beta\b/i,
  /[-.]preview$/i,
  /non-reasoning/i,
  /[-.]multi-agent\b/i,
];

export function isNoise(id) {
  return NOISE.some((re) => re.test(id));
}

/** Trim regex artifacts like a trailing hyphen or period off a captured ID. */
export function cleanId(raw) {
  return String(raw).trim().replace(/[-.\s]+$/, "");
}
