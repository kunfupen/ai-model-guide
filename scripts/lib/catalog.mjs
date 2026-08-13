// Shared helpers for reading the model catalog from disk.
// Used by the release tracker, the scaffolder, and the eval runner so they all
// agree on what "already in the catalog" means.

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..", "..");
export const MODELS_DIR = path.join(REPO_ROOT, "content", "models");

/** Every model in the catalog, as {slug, file, frontmatter}. */
export async function readCatalog() {
  const files = (await fs.readdir(MODELS_DIR)).filter((f) => f.endsWith(".mdx"));
  const out = [];
  for (const file of files) {
    const raw = await fs.readFile(path.join(MODELS_DIR, file), "utf8");
    const { data, content } = matter(raw);
    out.push({ slug: file.replace(/\.mdx$/, ""), file, frontmatter: data, body: content });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * Normalize a model name/ID for fuzzy comparison against the catalog.
 * "Claude Opus 4.8", "claude-opus-4-8", "claude-opus-4.8-20260528" all collapse
 * to a comparable "claudeopus48".
 */
export function normalizeModelKey(nameOrId) {
  return String(nameOrId)
    .toLowerCase()
    // drop trailing date stamps like -20260528 / @20260528
    .replace(/[-@_]?20\d{6}\b/g, "")
    // drop common noise words that don't distinguish a model
    .replace(/\b(preview|latest|stable|experimental|exp|beta|ga)\b/g, "")
    // collapse everything non-alphanumeric
    .replace(/[^a-z0-9]/g, "");
}

/** Providers we prefix slugs with; stripped so a wire ID can match a slug. */
const PROVIDER_PREFIXES = [
  "anthropic",
  "openai",
  "google",
  "microsoft",
  "meta",
  "moonshot",
  "zhipu",
  "nvidia",
  "xai",
];

/**
 * Every normalized spelling that should count as "already in the catalog" for a
 * given entry: its slug, its slug without the provider prefix, and its display
 * name. Wire IDs like `claude-opus-4-8` land on the same key as the display name
 * "Claude Opus 4.8", which is what makes exact matching sufficient.
 */
export async function knownModelKeys(catalog) {
  const models = catalog ?? (await readCatalog());
  const keys = new Set();
  const add = (v) => {
    const k = normalizeModelKey(v);
    if (k) keys.add(k);
  };
  for (const m of models) {
    add(m.slug);
    for (const p of PROVIDER_PREFIXES) {
      if (m.slug.startsWith(`${p}-`)) add(m.slug.slice(p.length + 1));
    }
    if (m.frontmatter?.name) add(m.frontmatter.name);
  }
  return keys;
}

/**
 * Is this candidate already represented in the catalog?
 *
 * EXACT match on the normalized key only — deliberately.
 *
 * An earlier version also matched on substring containment in both directions,
 * which silently swallowed the single most important case this tracker exists to
 * catch: a point release. `claude-opus-5-1` normalizes to `claudeopus51`, which
 * *contains* `claudeopus5`, so Claude Opus 5.1 was treated as already-known and
 * would never have raised an alert. Same for `gpt-5-6-sol-ultra` vs `gpt-5-6-sol`.
 *
 * Containment is unsafe in both directions — a longer candidate is a MORE
 * specific (new) model, and a shorter one is a different model too. Date suffixes
 * and preview/latest noise are already handled inside normalizeModelKey, so exact
 * matching is both sufficient and the only safe rule. Erring toward "unknown"
 * costs a line in a report; erring toward "known" loses a release entirely.
 */
export function isKnown(candidate, keys) {
  const k = normalizeModelKey(candidate);
  if (!k || k.length < 3) return true; // too vague to be a real signal
  return keys.has(k);
}

export function slugFor(provider, name) {
  const clean = String(name)
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${provider}-${clean}`;
}
