// Validates a draft model spec before anything is written to disk.
//
// The allowed enum values are parsed OUT of lib/schemas.ts rather than
// duplicated here, so adding a provider to the schema automatically teaches the
// research agent about it and this file can never drift from the real contract.

import { promises as fs } from "node:fs";
import path from "node:path";
import { REPO_ROOT, readCatalog, normalizeModelKey } from "./catalog.mjs";

const SCHEMA_PATH = path.join(REPO_ROOT, "lib", "schemas.ts");

/** Pull `z.enum([...])` members for a named export out of the schema source. */
function parseEnum(source, exportName) {
  const re = new RegExp(`export const ${exportName} = z\\.enum\\(\\[([\\s\\S]*?)\\]\\)`, "m");
  const m = source.match(re);
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

export async function loadSchemaEnums() {
  const src = await fs.readFile(SCHEMA_PATH, "utf8");
  return {
    providers: parseEnum(src, "Provider"),
    modalities: parseEnum(src, "Modality"),
    availability: parseEnum(src, "Availability"),
  };
}

/**
 * Benchmark "sources" that describe the benchmark itself rather than attesting a
 * model's score. Citing one of these is how 45 placeholder numbers ended up
 * looking sourced, so the agent is blocked from repeating it.
 */
const DEFINITION_PAPERS = [
  "arxiv.org/abs/2009.03300", // MMLU
  "arxiv.org/abs/2107.03374", // HumanEval
  "arxiv.org/abs/2311.12022", // GPQA
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @returns {Promise<{ok: boolean, errors: string[], warnings: string[]}>}
 */
export async function validateSpec(spec) {
  const errors = [];
  const warnings = [];
  const { providers, modalities, availability } = await loadSchemaEnums();

  const req = ["name", "provider", "releaseDate", "contextWindow", "modalities", "availability", "officialDocs"];
  for (const k of req) {
    if (spec?.[k] === undefined || spec?.[k] === null || spec?.[k] === "") {
      errors.push(`missing required field: ${k}`);
    }
  }
  if (errors.length) return { ok: false, errors, warnings };

  if (!providers.includes(spec.provider)) {
    errors.push(
      `provider "${spec.provider}" is not in the schema enum [${providers.join(", ")}]. ` +
        `A genuinely new provider must be added to lib/schemas.ts, ProviderChip, FilterBar, ProviderLogo and the OG colour map first.`,
    );
  }
  if (!ISO_DATE.test(String(spec.releaseDate))) {
    errors.push(`releaseDate must be YYYY-MM-DD, got "${spec.releaseDate}"`);
  } else if (spec.releaseDate > new Date().toISOString().slice(0, 10)) {
    errors.push(`releaseDate "${spec.releaseDate}" is in the future`);
  }

  if (!Number.isInteger(spec.contextWindow) || spec.contextWindow <= 0) {
    errors.push(`contextWindow must be a positive integer, got ${spec.contextWindow}`);
  }

  for (const m of spec.modalities ?? []) {
    if (!modalities.includes(m)) errors.push(`modality "${m}" not in [${modalities.join(", ")}]`);
  }
  if (!Array.isArray(spec.modalities) || spec.modalities.length === 0) {
    errors.push("modalities must list at least one value");
  }
  for (const a of spec.availability ?? []) {
    if (!availability.includes(a)) errors.push(`availability "${a}" not in [${availability.join(", ")}]`);
  }
  if (!Array.isArray(spec.availability) || spec.availability.length === 0) {
    errors.push("availability must list at least one value");
  }

  try {
    new URL(spec.officialDocs);
  } catch {
    errors.push(`officialDocs must be a URL, got "${spec.officialDocs}"`);
  }

  if (spec.pricing) {
    for (const k of ["inputPer1M", "outputPer1M"]) {
      if (typeof spec.pricing[k] !== "number" || spec.pricing[k] < 0) {
        errors.push(`pricing.${k} must be a non-negative number`);
      }
    }
  }

  // Benchmarks: the project's hard rule is that an unsourced or
  // definition-paper-sourced score must not be published as fact.
  for (const b of spec.benchmarks ?? []) {
    const label = `benchmark "${b?.name ?? "?"}"`;
    if (!b?.name) errors.push("a benchmark entry is missing name");
    if (typeof b?.score !== "number" || b.score < 0) errors.push(`${label} score must be a non-negative number`);
    if (b?.max !== undefined && (typeof b.max !== "number" || b.max <= 0)) {
      errors.push(`${label} max must be a positive number`);
    }
    if (!b?.source) {
      errors.push(`${label} has no source. Omit the benchmark instead of publishing an unsourced score.`);
      continue;
    }
    try {
      new URL(b.source);
    } catch {
      errors.push(`${label} source is not a URL`);
      continue;
    }
    if (DEFINITION_PAPERS.some((d) => String(b.source).includes(d))) {
      errors.push(
        `${label} cites the benchmark's own definition paper (${b.source}), which does not attest this model's score. ` +
          `Use a leaderboard or the provider's published figure, or omit the benchmark.`,
      );
    }
  }

  // Duplicate detection against the live catalog.
  const catalog = await readCatalog();
  const key = normalizeModelKey(spec.slug ?? spec.name);
  const dupe = catalog.find(
    (m) => normalizeModelKey(m.slug) === key || normalizeModelKey(m.frontmatter?.name ?? "") === key,
  );
  if (dupe) errors.push(`model already in the catalog as ${dupe.file}`);

  if (!spec.benchmarks || spec.benchmarks.length === 0) {
    warnings.push("no benchmarks supplied — that is acceptable and preferred over guessing");
  }
  if (!spec.pricing) warnings.push("no pricing supplied (fine for open-weight models)");

  return { ok: errors.length === 0, errors, warnings };
}
