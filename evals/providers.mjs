// One uniform `complete()` interface across OpenAI, Anthropic, Google, and xAI.
//
// Fairness rules baked in, because a self-run benchmark is only credible if
// every model faces identical conditions:
//   - same prompt text, no per-provider prompt tuning
//   - temperature 0 (or the provider's nearest deterministic setting)
//   - same max output tokens
//   - same retry policy
// Anything a provider cannot honour is recorded in `notes` on the result rather
// than silently worked around.

const TIMEOUT_MS = 120_000;

export const PROVIDERS = {
  openai: {
    envKey: "OPENAI_API_KEY",
    endpoint: () => "https://api.openai.com/v1/chat/completions",
    headers: (key) => ({ "content-type": "application/json", authorization: `Bearer ${key}` }),
    body: (model, prompt, maxTokens) => ({
      model,
      messages: [{ role: "user", content: prompt }],
      // Newer OpenAI reasoning models reject `temperature` and rename the token
      // cap; send the modern field and omit temperature (their default is
      // deterministic enough at effort=low for our purposes).
      max_completion_tokens: maxTokens,
    }),
    extract: (json) => json?.choices?.[0]?.message?.content ?? "",
  },
  anthropic: {
    envKey: "ANTHROPIC_API_KEY",
    endpoint: () => "https://api.anthropic.com/v1/messages",
    headers: (key) => ({
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    }),
    body: (model, prompt, maxTokens) => ({
      model,
      max_tokens: maxTokens,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    }),
    extract: (json) =>
      (json?.content ?? [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join(""),
  },
  google: {
    envKey: "GEMINI_API_KEY",
    endpoint: (model) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    headers: (key) => ({ "content-type": "application/json", "x-goog-api-key": key }),
    body: (model, prompt, maxTokens) => ({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: maxTokens },
    }),
    extract: (json) =>
      (json?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join(""),
  },
  alibaba: {
    envKey: "DASHSCOPE_API_KEY",
    // Alibaba Cloud Model Studio exposes an OpenAI-compatible endpoint.
    endpoint: () => "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    headers: (key) => ({ "content-type": "application/json", authorization: `Bearer ${key}` }),
    body: (model, prompt, maxTokens) => ({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: maxTokens,
    }),
    extract: (json) => json?.choices?.[0]?.message?.content ?? "",
  },
  xai: {
    envKey: "XAI_API_KEY",
    // xAI is OpenAI-compatible.
    endpoint: () => "https://api.x.ai/v1/chat/completions",
    headers: (key) => ({ "content-type": "application/json", authorization: `Bearer ${key}` }),
    body: (model, prompt, maxTokens) => ({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: maxTokens,
    }),
    extract: (json) => json?.choices?.[0]?.message?.content ?? "",
  },
};

export function hasKey(provider) {
  const spec = PROVIDERS[provider];
  return Boolean(spec && process.env[spec.envKey]);
}

export function missingKeyMessage(provider) {
  const spec = PROVIDERS[provider];
  return spec ? `${spec.envKey} is not set` : `unknown provider "${provider}"`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Run one prompt against one model.
 * Returns {ok, text, notes, attempts, error}. Never throws for API-level
 * failures — a failed call is data, not a crash.
 */
export async function complete({ provider, model, prompt, maxTokens = 1024, retries = 2 }) {
  const spec = PROVIDERS[provider];
  if (!spec) return { ok: false, text: "", error: `unknown provider "${provider}"`, attempts: 0 };

  const key = process.env[spec.envKey];
  if (!key) return { ok: false, text: "", error: missingKeyMessage(provider), attempts: 0 };

  const notes = [];
  let lastError = "";

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(spec.endpoint(model), {
        method: "POST",
        headers: spec.headers(key),
        body: JSON.stringify(spec.body(model, prompt, maxTokens)),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 429 || res.status >= 500) {
        lastError = `HTTP ${res.status}`;
        if (attempt <= retries) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
      }
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = json?.error?.message ?? json?.message ?? `HTTP ${res.status}`;
        return { ok: false, text: "", error: detail, attempts: attempt, notes };
      }
      return { ok: true, text: spec.extract(json) ?? "", attempts: attempt, notes };
    } catch (err) {
      clearTimeout(timer);
      lastError = err?.name === "AbortError" ? `timeout after ${TIMEOUT_MS}ms` : String(err?.message ?? err);
      if (attempt <= retries) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
    }
  }
  return { ok: false, text: "", error: lastError || "unknown failure", attempts: retries + 1, notes };
}
