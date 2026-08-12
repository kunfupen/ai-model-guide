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

/** Set of normalized keys covering every model already in the catalog. */
export async function knownModelKeys(catalog) {
  const models = catalog ?? (await readCatalog());
  const keys = new Set();
  for (const m of models) {
    keys.add(normalizeModelKey(m.slug));
    if (m.frontmatter?.name) keys.add(normalizeModelKey(m.frontmatter.name));
  }
  return keys;
}

/**
 * Is this candidate already represented in the catalog?
 * Uses containment in both directions so "gpt-5.6" matches "GPT-5.6 Sol" only
 * when the candidate is at least as specific as the catalog entry.
 */
export function isKnown(candidate, keys) {
  const k = normalizeModelKey(candidate);
  if (!k || k.length < 3) return true; // too vague to be a real signal
  if (keys.has(k)) return true;
  for (const known of keys) {
    if (known.length >= 6 && (k.includes(known) || known.includes(k))) return true;
  }
  return false;
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
