#!/usr/bin/env node
// Autonomous research agent.
//
// Given a candidate model identifier, it researches the release with web search,
// checks it against the live catalog, drafts a spec, validates it, and either
// submits it or abandons the candidate. It is the bridge between the tracker
// (which only knows "this ID is new") and scaffold-model.mjs (which needs a
// complete, correct spec).
//
//   node agents/research-agent.mjs --candidate "claude-opus-6"
//   node agents/research-agent.mjs --candidate "grok-5" --provider xai --json
//   node agents/research-agent.mjs --candidate x --dry-run   # offline plumbing test
//
// Exit codes: 0 submitted · 3 abandoned · 4 gave up (turn/budget limit) · 1 error.

import { promises as fs } from "node:fs";
import path from "node:path";
import { serverTools, clientTools, runClientTool, CLIENT_TOOL_NAMES } from "./tools.mjs";
import { REPO_ROOT } from "../scripts/lib/catalog.mjs";

const API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = process.env.RESEARCH_AGENT_MODEL ?? "claude-sonnet-4-6";
const MAX_TURNS = Number(process.env.RESEARCH_AGENT_MAX_TURNS ?? 24);

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => {
  const i = argv.indexOf(f);
  return i === -1 ? d : argv[i + 1];
};

const SYSTEM = `You research newly-released AI models for a public catalog and produce a validated spec.

The catalog's single most important rule: NEVER publish a number or claim you cannot source.
Omitting a field is always correct. Inventing one is never correct. You are not penalised for
returning a sparse spec or for abandoning a candidate — you are penalised for being wrong.

Your task, given a candidate model identifier:

1. Call list_catalog and get_schema first. If the candidate is already covered, call abandon.
2. Use web_search to establish, from OFFICIAL sources (the provider's docs, model page, pricing
   page or announcement):
     - that this is a real, RELEASED model (not a rumour, alias, retired model, or config variant
       such as "-latest", "-preview", "-experimental", or a reasoning-effort suffix)
     - release date, context window, modalities, availability, pricing
   If you cannot confirm it is a genuine distinct release, call abandon. That is a good outcome.
3. Benchmarks are OPTIONAL and held to a higher bar:
     - Only include a score you can attribute to a leaderboard or the provider's own published
       figure, with a URL that actually attests THAT MODEL's score.
     - Never cite a benchmark's definition paper (the MMLU/HumanEval/GPQA arXiv entries) as a source.
     - Never carry a score over from a different model or version.
     - Never mix incompatible suites (SWE-bench Pro is not SWE-bench Verified; MMLU-Pro is not MMLU).
     - If a figure comes from a high-effort or non-default configuration, say so in the benchmarkNote.
     - When in doubt, omit. A model with no benchmarks is fine.
4. Call read_model_page on a recent, similar model to match house style and tone.
5. Draft the spec, call validate_spec, fix every error, repeat until it passes.
6. Call submit_model_spec with honest confidence and a candid uncertainties list.

Spec shape:
{
  "name": "Claude Opus 6",            // display name, as the provider writes it
  "provider": "anthropic",            // must be in the schema enum
  "releaseDate": "2026-11-02",        // YYYY-MM-DD, not in the future
  "contextWindow": 1000000,           // integer tokens
  "modalities": ["text","vision"],
  "pricing": { "inputPer1M": 5, "outputPer1M": 25 },   // omit entirely for open-weight models
  "availability": ["api","claude-ai"],
  "strengths": ["reasoning","coding"],
  "officialDocs": "https://...",
  "announcementUrl": "https://...",   // optional
  "benchmarks": [ { "name":"SWE-bench Verified", "score":97.0, "max":100, "source":"https://..." } ],
  "sections": {
    "intro": "2-4 sentences: what it is and when to reach for it.",
    "bestFor": ["bullet", "bullet"],
    "benchmarkNote": "Which scores are included, which are omitted, and WHY."
  }
}

Set confidence "high" only when the release, its date, and its core specs are all confirmed by
official sources. Anything relying on third-party reporting is at most "medium".`;

function log(...a) {
  if (!has("--json")) console.error(...a);
}

async function callApi(body, key) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${detail.slice(0, 400)}`);
  }
  return res.json();
}

/**
 * Offline rehearsal of the loop. Exercises tool dispatch, validation and the
 * terminal path with a scripted sequence of tool calls, so the plumbing can be
 * verified without an API key or spending anything.
 */
async function dryRun(candidate) {
  log(`[dry-run] rehearsing the agent loop for "${candidate}" (no API calls)\n`);
  const script = [
    { name: "list_catalog", input: {} },
    { name: "get_schema", input: {} },
    { name: "read_model_page", input: { slug: "anthropic-claude-opus-5" } },
    // Deliberately invalid: proves the validator rejects an unsourced benchmark.
    {
      name: "validate_spec",
      input: {
        spec: {
          name: "Dry Run Model",
          provider: "anthropic",
          releaseDate: "2026-01-01",
          contextWindow: 200000,
          modalities: ["text"],
          availability: ["api"],
          officialDocs: "https://example.com/docs",
          benchmarks: [{ name: "MMLU", score: 90, max: 100 }],
        },
      },
    },
    // Deliberately invalid: proves definition-paper citations are rejected.
    {
      name: "validate_spec",
      input: {
        spec: {
          name: "Dry Run Model",
          provider: "anthropic",
          releaseDate: "2026-01-01",
          contextWindow: 200000,
          modalities: ["text"],
          availability: ["api"],
          officialDocs: "https://example.com/docs",
          benchmarks: [
            { name: "MMLU", score: 90, max: 100, source: "https://arxiv.org/abs/2009.03300" },
          ],
        },
      },
    },
    // Valid.
    {
      name: "validate_spec",
      input: {
        spec: {
          name: "Dry Run Model",
          provider: "anthropic",
          releaseDate: "2026-01-01",
          contextWindow: 200000,
          modalities: ["text"],
          availability: ["api"],
          officialDocs: "https://example.com/docs",
          benchmarks: [],
        },
      },
    },
    { name: "abandon", input: { reason: "dry run — no real candidate researched" } },
  ];

  for (const step of script) {
    const out = await runClientTool(step.name, step.input);
    const preview = out.content.length > 260 ? out.content.slice(0, 260) + "…" : out.content;
    log(`  → ${step.name}\n    ${preview.replace(/\n/g, "\n    ")}\n`);
    if (out.terminal) return out.payload;
  }
  return { outcome: "gave_up", reason: "dry run ended without a terminal tool" };
}

async function main() {
  const candidate = val("--candidate");
  if (!candidate) {
    console.error('Usage: research-agent.mjs --candidate "<model id or name>" [--provider p] [--json] [--dry-run]');
    process.exit(2);
  }

  if (has("--dry-run")) {
    const result = await dryRun(candidate);
    if (has("--json")) console.log(JSON.stringify(result, null, 2));
    else log(`\n[dry-run] outcome: ${result.outcome}`);
    process.exit(result.outcome === "submitted" ? 0 : 3);
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    console.error("ANTHROPIC_API_KEY is not set. Use --dry-run to exercise the loop offline.");
    process.exit(1);
  }

  const providerHint = val("--provider");
  const messages = [
    {
      role: "user",
      content:
        `Research this candidate model and either submit a validated spec or abandon it.\n\n` +
        `Candidate identifier: ${candidate}\n` +
        (providerHint ? `Likely provider: ${providerHint}\n` : "") +
        `Today's date: ${new Date().toISOString().slice(0, 10)}\n\n` +
        `Start by checking the catalog and the schema.`,
    },
  ];

  const tools = [...serverTools(Number(val("--max-searches", "12"))), ...clientTools];
  let result = null;

  for (let turn = 1; turn <= MAX_TURNS && !result; turn++) {
    const response = await callApi(
      { model: MODEL, max_tokens: 4096, system: SYSTEM, tools, messages },
      key,
    );

    messages.push({ role: "assistant", content: response.content });

    const toolUses = (response.content ?? []).filter(
      (b) => b.type === "tool_use" && CLIENT_TOOL_NAMES.has(b.name),
    );

    if (toolUses.length === 0) {
      // No client tool call: either it's still searching (server tool) or it stopped.
      if (response.stop_reason === "end_turn") {
        const text = (response.content ?? [])
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("");
        log(`\nAgent ended without a terminal tool. Final message:\n${text.slice(0, 600)}`);
        result = { outcome: "gave_up", reason: "agent ended turn without submitting or abandoning" };
        break;
      }
      continue; // server-side tool ran; loop for the next assistant turn
    }

    const toolResults = [];
    for (const use of toolUses) {
      log(`  turn ${turn}: ${use.name}`);
      const out = await runClientTool(use.name, use.input);
      toolResults.push({ type: "tool_result", tool_use_id: use.id, content: out.content });
      if (out.terminal) result = out.payload;
    }
    messages.push({ role: "user", content: toolResults });
  }

  if (!result) result = { outcome: "gave_up", reason: `hit the ${MAX_TURNS}-turn limit` };

  // Persist the spec so the workflow can pipe it into the scaffolder.
  if (result.outcome === "submitted") {
    const outDir = path.join(REPO_ROOT, "agents", "out");
    await fs.mkdir(outDir, { recursive: true });
    const file = path.join(outDir, "spec.json");
    await fs.writeFile(file, JSON.stringify(result.spec, null, 2) + "\n", "utf8");
    result.specPath = file;
  }

  if (has("--json")) console.log(JSON.stringify(result, null, 2));
  else {
    log(`\noutcome: ${result.outcome}`);
    if (result.outcome === "submitted") {
      log(`confidence: ${result.confidence}`);
      log(`spec: ${result.specPath}`);
      if (result.uncertainties?.length) log(`uncertainties:\n  - ${result.uncertainties.join("\n  - ")}`);
    } else {
      log(`reason: ${result.reason}`);
    }
  }

  process.exit(result.outcome === "submitted" ? 0 : result.outcome === "abandoned" ? 3 : 4);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
