#!/usr/bin/env node
// AMG Eval runner.
//
//   node evals/run-eval.mjs --self-test            # prove the suite + graders are sound (no API calls)
//   node evals/run-eval.mjs --dry-run --model X    # print what would be sent
//   node evals/run-eval.mjs --model anthropic-claude-opus-5
//   node evals/run-eval.mjs --all
//   node evals/run-eval.mjs --model X --record     # write the score into the model's MDX
//
// Results are written to evals/results/<slug>.json and summarised on stdout.

import { promises as fs } from "node:fs";
import path from "node:path";
import { buildSuite, CATEGORIES, SUITE_VERSION } from "./suite.mjs";
import { grade } from "./graders.mjs";
import { complete, hasKey, missingKeyMessage } from "./providers.mjs";
import { REPO_ROOT, readCatalog } from "../scripts/lib/catalog.mjs";

const RESULTS_DIR = path.join(REPO_ROOT, "evals", "results");
const REGISTRY_PATH = path.join(REPO_ROOT, "evals", "models.json");
export const BENCHMARK_NAME = `AMG Eval v${SUITE_VERSION}`;

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => {
  const i = argv.indexOf(f);
  return i === -1 ? d : argv[i + 1];
};

const SEED = Number(val("--seed", "20260724"));
const CONCURRENCY = Number(val("--concurrency", "4"));

function summarise(results) {
  const byCat = {};
  for (const c of CATEGORIES) byCat[c] = { earned: 0, possible: 0 };
  let earned = 0;
  let possible = 0;
  for (const r of results) {
    const w = r.weight ?? 1;
    earned += r.score * w;
    possible += w;
    if (!byCat[r.category]) byCat[r.category] = { earned: 0, possible: 0 };
    byCat[r.category].earned += r.score * w;
    byCat[r.category].possible += w;
  }
  const categories = {};
  for (const [c, v] of Object.entries(byCat)) {
    if (v.possible > 0) categories[c] = Number(((v.earned / v.possible) * 100).toFixed(1));
  }
  return { overall: Number(((earned / possible) * 100).toFixed(1)), categories };
}

/** Grade the built-in reference answers. Every task must score 1.0. */
async function selfTest() {
  const suite = buildSuite(SEED);
  console.log(`AMG Eval ${BENCHMARK_NAME} — self-test (seed ${SEED}, ${suite.tasks.length} tasks)\n`);
  const results = [];
  let failures = 0;
  for (const t of suite.tasks) {
    if (t.reference === undefined) {
      console.log(`  ??  ${t.id.padEnd(18)} no reference answer defined`);
      failures++;
      continue;
    }
    const score = await grade(t.reference, t.grader);
    results.push({ ...t, score });
    const ok = score === 1;
    if (!ok) failures++;
    console.log(`  ${ok ? "ok" : "FAIL"}  ${t.id.padEnd(18)} ${(score * 100).toFixed(0)}%  [${t.category}]`);
  }
  const { overall, categories } = summarise(results);
  console.log(`\nReference answers score: ${overall}%`);
  console.log("Per category:", categories);
  if (failures > 0) {
    console.error(`\n${failures} task(s) failed self-test — the suite or graders are broken.`);
    process.exit(1);
  }
  console.log("\nSelf-test passed: every task is solvable and every grader agrees with its reference answer.");
}

async function runOne({ slug, provider, apiModel, displayName }) {
  const suite = buildSuite(SEED);
  const dryRun = has("--dry-run");

  if (!dryRun && !hasKey(provider)) {
    console.error(`Skipping ${slug}: ${missingKeyMessage(provider)}`);
    return null;
  }

  const queue = [...suite.tasks];
  const results = [];
  const workers = Array.from({ length: Math.max(1, CONCURRENCY) }, async () => {
    for (;;) {
      const task = queue.shift();
      if (!task) return;
      if (dryRun) {
        results.push({ ...task, score: 0, dryRun: true, promptChars: task.prompt.length });
        continue;
      }
      const res = await complete({
        provider,
        model: apiModel,
        prompt: task.prompt,
        maxTokens: task.maxTokens ?? 1024,
      });
      const score = res.ok ? await grade(res.text, task.grader) : 0;
      results.push({
        id: task.id,
        category: task.category,
        weight: task.weight ?? 1,
        score,
        ok: res.ok,
        error: res.error ?? null,
        responseChars: res.text?.length ?? 0,
      });
      process.stdout.write(res.ok ? (score === 1 ? "." : "x") : "!");
    }
  });
  await Promise.all(workers);
  if (!dryRun) process.stdout.write("\n");

  results.sort((a, b) => a.id.localeCompare(b.id));
  const apiFailures = results.filter((r) => r.ok === false);
  const { overall, categories } = summarise(results);

  const record = {
    benchmark: BENCHMARK_NAME,
    suiteVersion: SUITE_VERSION,
    seed: SEED,
    slug,
    displayName,
    provider,
    apiModel,
    runAt: new Date().toISOString(),
    overall,
    categories,
    taskCount: results.length,
    apiFailureCount: apiFailures.length,
    tasks: results,
  };

  if (dryRun) {
    console.log(`[dry run] ${slug} -> ${provider}/${apiModel}: ${results.length} prompts, ` +
      `${results.reduce((s, r) => s + (r.promptChars ?? 0), 0)} prompt chars total`);
    return record;
  }

  await fs.mkdir(RESULTS_DIR, { recursive: true });
  await fs.writeFile(path.join(RESULTS_DIR, `${slug}.json`), JSON.stringify(record, null, 2) + "\n", "utf8");

  console.log(`${displayName} (${apiModel}): ${overall}%`);
  console.log("  ", categories);
  if (apiFailures.length) {
    console.warn(`   ${apiFailures.length}/${results.length} task(s) failed at the API layer — score is NOT trustworthy.`);
    console.warn(`   first error: ${apiFailures[0].error}`);
  }
  return record;
}

async function main() {
  if (has("--self-test")) return selfTest();

  const registry = JSON.parse(await fs.readFile(REGISTRY_PATH, "utf8")).models;
  const catalog = await readCatalog();
  const nameFor = (slug) => catalog.find((m) => m.slug === slug)?.frontmatter?.name ?? slug;

  let targets = [];
  const one = val("--model");
  if (one) {
    const entry = registry[one];
    if (!entry) {
      console.error(`No API model ID registered for "${one}". Add it to evals/models.json.`);
      process.exit(2);
    }
    targets = [{ slug: one, ...entry, displayName: nameFor(one) }];
  } else if (has("--all")) {
    targets = Object.entries(registry).map(([slug, e]) => ({ slug, ...e, displayName: nameFor(slug) }));
  } else {
    console.error(
      "Usage: run-eval.mjs --self-test | --model <slug> [--record] | --all [--dry-run] [--seed N]",
    );
    process.exit(2);
  }

  console.log(`AMG Eval ${BENCHMARK_NAME} — seed ${SEED}, ${targets.length} model(s)\n`);
  const records = [];
  for (const t of targets) {
    const rec = await runOne(t);
    if (rec) records.push(rec);
  }

  if (has("--record") && !has("--dry-run")) {
    const { recordScores } = await import("./record-result.mjs");
    await recordScores(records);
  }

  const failed = records.filter((r) => r.apiFailureCount > 0);
  if (failed.length) {
    console.warn(`\n${failed.length} model(s) had API-layer failures; treat those scores as provisional.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
