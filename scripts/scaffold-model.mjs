#!/usr/bin/env node
// Create a model page from a JSON spec, in the catalog's house style.
//
//   node scripts/scaffold-model.mjs --spec new-model.json
//   cat spec.json | node scripts/scaffold-model.mjs
//
// The spec mirrors the MDX frontmatter (see lib/schemas.ts) plus an optional
// `sections` object for prose. Benchmarks are intentionally OPTIONAL — the
// project rule is to omit scores rather than invent them.

import { promises as fs } from "node:fs";
import path from "node:path";
import { MODELS_DIR, slugFor, readCatalog, normalizeModelKey } from "./lib/catalog.mjs";

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function readSpec() {
  const file = arg("--spec");
  if (file) return JSON.parse(await fs.readFile(file, "utf8"));
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) {
    console.error("No spec provided. Use --spec <file.json> or pipe JSON on stdin.");
    process.exit(2);
  }
  return JSON.parse(text);
}

const REQUIRED = ["name", "provider", "releaseDate", "contextWindow", "modalities", "availability", "officialDocs"];

function yamlValue(v) {
  if (Array.isArray(v)) return `[${v.join(", ")}]`;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return String(v);
}

function buildFrontmatter(spec, slug) {
  const lines = ["---", `slug: ${slug}`, `name: ${spec.name}`, `provider: ${spec.provider}`];
  lines.push(`releaseDate: ${spec.releaseDate}`);
  lines.push(`contextWindow: ${spec.contextWindow}`);
  lines.push(`modalities: ${yamlValue(spec.modalities)}`);
  if (spec.pricing) {
    lines.push("pricing:");
    lines.push(`  inputPer1M: ${spec.pricing.inputPer1M}`);
    lines.push(`  outputPer1M: ${spec.pricing.outputPer1M}`);
  }
  lines.push(`availability: ${yamlValue(spec.availability)}`);
  lines.push(`strengths: ${yamlValue(spec.strengths ?? [])}`);
  lines.push(`officialDocs: ${spec.officialDocs}`);
  lines.push(`tweetIds: ${yamlValue(spec.tweetIds ?? [])}`);
  if (Array.isArray(spec.benchmarks) && spec.benchmarks.length > 0) {
    lines.push("benchmarks:");
    for (const b of spec.benchmarks) {
      lines.push(`  - name: ${b.name}`);
      lines.push(`    score: ${b.score}`);
      lines.push(`    max: ${b.max ?? 100}`);
      if (b.source) lines.push(`    source: ${b.source}`);
    }
  } else {
    lines.push("benchmarks: []");
  }
  lines.push("---");
  return lines.join("\n");
}

function buildBody(spec) {
  const s = spec.sections ?? {};
  const shortName = spec.name.replace(/\s*\(preview\)/i, "");
  const parts = [];

  parts.push(`\n## When to reach for ${shortName}\n`);
  parts.push(
    s.intro ??
      `${spec.name} is ${spec.provider}'s latest model${spec.releaseDate ? ` (released ${spec.releaseDate})` : ""}.`,
  );
  if (Array.isArray(s.bestFor) && s.bestFor.length) {
    parts.push("\n" + s.bestFor.map((b) => `- ${b}`).join("\n"));
  }

  parts.push("\n\n## Specs & cost\n");
  const specLines = [`- **Context:** ${Number(spec.contextWindow).toLocaleString()} tokens.`];
  specLines.push(`- **Modalities:** ${spec.modalities.join(", ")}.`);
  if (spec.pricing) {
    specLines.push(
      `- **Pricing:** $${spec.pricing.inputPer1M} / 1M input and $${spec.pricing.outputPer1M} / 1M output.`,
    );
  }
  specLines.push(`- **Availability:** ${spec.availability.join(", ")}.`);
  parts.push(specLines.join("\n"));

  if (!spec.benchmarks || spec.benchmarks.length === 0) {
    parts.push(
      "\n\n> Benchmark scores intentionally omitted until verified against official or corroborated figures.",
    );
  } else if (s.benchmarkNote) {
    parts.push(`\n\n> ${s.benchmarkNote}`);
  }

  parts.push("\n\n## Official resources\n");
  parts.push(`- [Official docs](${spec.officialDocs})`);
  if (spec.announcementUrl) parts.push(`\n- [Announcement](${spec.announcementUrl})`);
  parts.push("\n");
  return parts.join("");
}

const spec = await readSpec();
const missing = REQUIRED.filter((k) => spec[k] === undefined || spec[k] === null);
if (missing.length) {
  console.error(`Spec is missing required fields: ${missing.join(", ")}`);
  process.exit(2);
}

const slug = spec.slug ?? slugFor(spec.provider, spec.name);
const target = path.join(MODELS_DIR, `${slug}.mdx`);

const catalog = await readCatalog();
const dupe = catalog.find((m) => normalizeModelKey(m.slug) === normalizeModelKey(slug));
if (dupe && !process.argv.includes("--force")) {
  console.error(`Model already exists: ${dupe.file} (pass --force to overwrite)`);
  process.exit(1);
}

await fs.writeFile(target, buildFrontmatter(spec, slug) + buildBody(spec), "utf8");
console.log(`Wrote ${path.relative(process.cwd(), target)}`);
console.log("Next: run `pnpm build` to validate the frontmatter against the Zod schema.");
