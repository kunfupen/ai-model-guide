#!/usr/bin/env node
// Frontier-model release tracker.
//
// Polls each provider for the models they currently expose, diffs that against
// the catalog, and reports anything new. Designed to run unattended on a cron.
//
//   node scripts/track-releases.mjs              # human-readable report
//   node scripts/track-releases.mjs --json       # machine-readable
//   node scripts/track-releases.mjs --github     # also write $GITHUB_OUTPUT / step summary
//
// Exit codes: 0 = nothing new, 10 = new model(s) found, 1 = hard error.
// It works with NO API keys (falls back to public docs/changelog pages); keys
// just make detection faster and exact.

import { promises as fs } from "node:fs";
import path from "node:path";
import { readCatalog, knownModelKeys, isKnown, REPO_ROOT } from "./lib/catalog.mjs";
import { PROVIDER_SOURCES, isNoise, cleanId } from "./sources.mjs";

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const forGithub = argv.includes("--github");
const seedBaseline = argv.includes("--seed-baseline");
const TIMEOUT_MS = 30_000;

// Delta detection.
//
// "Every model not in the catalog" is the wrong signal — providers document
// plenty of old and retired models we never chose to catalog, and those would
// fire on every single run. What we actually want is a model we have NEVER SEEN
// BEFORE appearing at a provider. So we keep a committed baseline of observed
// IDs; a release is the moment an ID shows up that is in neither the catalog
// nor the baseline.
const STATE_PATH = path.join(REPO_ROOT, "scripts", "tracker-state.json");

async function loadState() {
  try {
    const raw = JSON.parse(await fs.readFile(STATE_PATH, "utf8"));
    return { seenIds: new Set(raw.seenIds ?? []), lastCheck: raw.lastCheck ?? null, runs: raw.runs ?? 0 };
  } catch {
    return { seenIds: new Set(), lastCheck: null, runs: 0 };
  }
}

async function saveState(state, allObserved) {
  const merged = new Set([...state.seenIds, ...allObserved]);
  const payload = {
    _comment:
      "Baseline of every model ID the tracker has ever observed. A new frontier release is an ID that appears in neither this list nor the catalog. Delete this file and re-run with --seed-baseline to rebuild.",
    lastCheck: new Date().toISOString(),
    runs: (state.runs ?? 0) + 1,
    seenIds: [...merged].sort(),
  };
  await fs.writeFile(STATE_PATH, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return merged;
}

async function fetchText(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "ai-model-guide-tracker/1.0", ...headers },
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, status: res.status };
    return { ok: true, text: await res.text() };
  } catch (err) {
    return { ok: false, error: err?.name === "AbortError" ? "timeout" : String(err?.message ?? err) };
  } finally {
    clearTimeout(timer);
  }
}

/** Collect candidate model identifiers for one provider. */
async function probeProvider(key, spec) {
  const candidates = new Map(); // id -> {id, name, released, via}
  const errors = [];
  let usedApi = false;

  // Tier 1: authenticated models endpoint (exact, immediate).
  const apiKey = spec.api?.envKey ? process.env[spec.api.envKey] : null;
  if (spec.api && apiKey) {
    const res = await fetchText(spec.api.url, spec.api.headers(apiKey));
    if (res.ok) {
      try {
        const json = JSON.parse(res.text);
        for (const m of spec.api.extract(json)) {
          if (m.id && !isNoise(m.id)) candidates.set(m.id, { ...m, via: "api" });
        }
        usedApi = true;
      } catch (e) {
        errors.push(`${key} api: unparseable JSON (${String(e.message).slice(0, 80)})`);
      }
    } else {
      errors.push(`${key} api: ${res.error}`);
    }
  }

  // Tier 2: public pages. Always run — they sometimes announce before the API
  // flips, and they are the only path when no key is configured.
  for (const src of spec.open ?? []) {
    const res = await fetchText(src.url);
    if (!res.ok) {
      errors.push(`${key} ${new URL(src.url).hostname}: ${res.error}`);
      continue;
    }
    const found = res.text.match(src.pattern) ?? [];
    for (const raw of found) {
      const id = cleanId(raw);
      if (!id || id.length < 5 || isNoise(id)) continue;
      if (!candidates.has(id)) candidates.set(id, { id, name: id, released: null, via: "docs" });
    }
  }

  return { provider: key, label: spec.label, usedApi, candidates: [...candidates.values()], errors };
}

async function main() {
  const catalog = await readCatalog();
  const keys = await knownModelKeys(catalog);

  const probes = await Promise.all(
    Object.entries(PROVIDER_SOURCES).map(([k, spec]) => probeProvider(k, spec)),
  );

  const state = await loadState();
  const observed = [];
  const findings = [];
  const errors = [];
  for (const p of probes) {
    errors.push(...p.errors);
    for (const c of p.candidates) {
      observed.push(c.id);
      const inCatalog = isKnown(c.id, keys) || isKnown(c.name, keys);
      const seenBefore = state.seenIds.has(c.id);
      if (!inCatalog && !seenBefore) {
        findings.push({ provider: p.provider, label: p.label, id: c.id, name: c.name, released: c.released, via: c.via });
      }
    }
  }

  const isFirstRun = state.runs === 0;
  await saveState(state, observed);

  // On a cold start every ID is technically "new"; that's a baseline, not news.
  if (isFirstRun || seedBaseline) {
    const seeded = observed.length;
    findings.length = 0;
    if (!asJson) {
      console.log(`Baseline seeded with ${seeded} observed model ID(s) across ${probes.length} providers.`);
      console.log("Future runs will report only IDs that appear for the first time.\n");
    }
  }

  // Most specific first, so "gpt-5.7-sol" outranks a bare "gpt-5".
  findings.sort((a, b) => b.id.length - a.id.length || a.id.localeCompare(b.id));

  const report = {
    checkedAt: new Date().toISOString(),
    catalogSize: catalog.length,
    providersProbed: probes.map((p) => ({ provider: p.provider, viaApi: p.usedApi, candidates: p.candidates.length })),
    newModels: findings,
    errors,
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Frontier tracker — ${report.checkedAt}`);
    console.log(`Catalog: ${catalog.length} models\n`);
    for (const p of report.providersProbed) {
      console.log(`  ${p.provider.padEnd(10)} ${String(p.candidates).padStart(3)} candidates ${p.viaApi ? "(via API)" : "(via public docs)"}`);
    }
    if (findings.length === 0) {
      console.log("\nNo unrecognised models. Catalog is up to date.");
    } else {
      console.log(`\n${findings.length} candidate model(s) not in the catalog:\n`);
      for (const f of findings) {
        console.log(`  [${f.label}] ${f.id}${f.released ? `  (released ${f.released.slice(0, 10)})` : ""}  via ${f.via}`);
      }
      console.log("\nThese are CANDIDATES, not confirmed releases — a docs page may mention");
      console.log("an alias, a retired model, or a variant. Verify against official sources");
      console.log("before adding, and never invent benchmark numbers.");
    }
    if (errors.length) {
      console.log(`\n${errors.length} source error(s):`);
      for (const e of errors) console.log(`  - ${e}`);
    }
  }

  if (forGithub) {
    const out = process.env.GITHUB_OUTPUT;
    if (out) {
      await fs.appendFile(out, `found=${findings.length}\n`);
      await fs.appendFile(out, `models=${findings.map((f) => f.id).join(",")}\n`);
    }
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) {
      const lines = [`## Frontier model tracker`, "", `Catalog: **${catalog.length}** models.`, ""];
      if (findings.length) {
        lines.push(`### ${findings.length} candidate(s) not in the catalog`, "", "| Provider | Model ID | Seen via |", "|---|---|---|");
        for (const f of findings) lines.push(`| ${f.label} | \`${f.id}\` | ${f.via} |`);
      } else {
        lines.push("No unrecognised models — catalog is up to date.");
      }
      if (errors.length) lines.push("", "<details><summary>Source errors</summary>", "", ...errors.map((e) => `- ${e}`), "</details>");
      await fs.appendFile(summary, lines.join("\n") + "\n");
    }
  }

  process.exit(findings.length > 0 ? 10 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
