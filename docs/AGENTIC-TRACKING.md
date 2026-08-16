# Agentic frontier-model tracking

How this repo notices a new frontier model, gets it onto the site, and scores it
against everything else — with as little human work as possible, and without ever
publishing a number we can't stand behind.

## The loop

```
  ┌─ 1. DETECT ──────────────────────────────────────────────┐
  │  .github/workflows/track-frontier-models.yml  (every 6h)  │
  │  scripts/track-releases.mjs                               │
  │    · providers' /v1/models when keys exist (exact)        │
  │    · public docs + changelogs otherwise (free)            │
  │    · diffs against catalog AND an observed-ID baseline    │
  └──────────────────────────┬────────────────────────────────┘
                             │ new ID never seen before
                             ▼
  ┌─ 2. RESEARCH (autonomous) ───────────────────────────────┐
  │  agents/research-agent.mjs — an Anthropic tool-calling    │
  │  loop with web_search plus read-only catalog tools.       │
  │  Confirms the release from OFFICIAL sources, drafts a     │
  │  spec, validates it, then submits or ABANDONS.            │
  │  Aliases, rumours, retired models and config variants     │
  │  are abandoned — that is a correct outcome, not a failure.│
  └──────────────────────────┬────────────────────────────────┘
                             │ validated spec
                             ▼
  ┌─ 3. INGEST ──────────────────────────────────────────────┐
  │  scripts/scaffold-model.mjs --spec agents/out/spec.json   │
  │  → content/models/<slug>.mdx in house style               │
  │  → `pnpm build` validates frontmatter against Zod         │
  └──────────────────────────┬────────────────────────────────┘
                             │ build green
                             ▼
  ┌─ 3b. PUBLISH ────────────────────────────────────────────┐
  │  confidence "high"  → commit straight to main             │
  │  anything lower     → open a PR for review                │
  └──────────────────────────┬────────────────────────────────┘
                             │
  ┌─ 4. SCORE ───────────────────────────────────────────────┐
  │  Add the wire ID to evals/models.json, then run the       │
  │  "Run AMG Eval" workflow.                                 │
  │  evals/run-eval.mjs → our own seeded suite → 0-100        │
  │  → recorded into the MDX → appears on the Benchmarks tab  │
  │  → opens a PR for review                                  │
  └───────────────────────────────────────────────────────────┘
```

The daily `SessionStart` hook (`.claude/hooks/session-start.sh`) is the fifth
path: when you open Claude Code in this repo it runs the same detector and hands
Claude the results, so an agent can carry a detection through steps 2–4 in one go.

## Why a baseline file, not just "is it in the catalog?"

The obvious check — *report anything a provider lists that we don't have* — fires
constantly. Providers document plenty of old, retired, and aliased models the
catalog never chose to include, so that check reported `gpt-4.1`, `claude-opus-4-1`
and a dozen others on the very first run.

`scripts/tracker-state.json` is a committed baseline of every ID the tracker has
ever observed. A **release** is an ID in neither the catalog nor the baseline —
i.e. something genuinely new appearing in the world. First run seeds the baseline
silently; after that the signal is clean.

Rebuild it any time:

```bash
node scripts/track-releases.mjs --seed-baseline
```

## Running it by hand

```bash
pnpm track            # human-readable report; exit 10 == found something
pnpm track:json       # machine-readable
```

Exit codes: `0` nothing new · `10` new model(s) · `1` hard error.

Keys are **optional but recommended**. Measured coverage as built:

| Provider | Without a key | With a key |
|---|---|---|
| Anthropic | ✅ works — two raw-markdown docs pages | ✅ exact, immediate |
| OpenAI | ✅ works — the official `openai-openapi` spec on GitHub, which carries the model-ID enum newest-first | ✅ exact, immediate |
| Google | ⚠️ `ai.google.dev` returns **403** to unattended clients | ✅ exact, immediate |
| xAI | ⚠️ `docs.x.ai` returns **403** to unattended clients | ✅ exact, immediate |

So with no secrets at all you get reliable detection for Anthropic and OpenAI,
and the tracker reports the blocked sources as errors rather than pretending they
returned nothing. Set `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` /
`XAI_API_KEY` as repo secrets to cover all four exactly. (Those 403s were observed
from a sandboxed network; a GitHub-hosted runner may fare better, but don't count
on it — keys are the dependable path for Google and xAI.)

## Adding a detected model

```bash
cat > /tmp/spec.json <<'JSON'
{
  "name": "Claude Opus 6",
  "provider": "anthropic",
  "releaseDate": "2026-11-02",
  "contextWindow": 1000000,
  "modalities": ["text", "vision"],
  "pricing": { "inputPer1M": 5, "outputPer1M": 25 },
  "availability": ["api", "claude-ai", "bedrock", "vertex"],
  "strengths": ["reasoning", "coding", "agentic-tasks"],
  "officialDocs": "https://platform.claude.com/docs/en/about-claude/models/overview",
  "sections": {
    "intro": "…",
    "bestFor": ["…"]
  }
}
JSON
pnpm scaffold -- --spec /tmp/spec.json
pnpm build      # Zod validates the frontmatter
```

Benchmarks are intentionally **optional** in the spec. The scaffolder writes
`benchmarks: []` and an explicit note when none are supplied.

## The rule that matters

> **Never invent a benchmark number.** Omit it.

Every automated path here is built around that. The tracker reports *candidates*,
not confirmed releases. The scaffolder defaults to no benchmarks. The eval runner
refuses to record a score from a run with API failures. When a provider publishes
only a variant (MMLU-Pro rather than MMLU, SWE-bench Pro rather than Verified),
the correct action is to leave the cell empty and say why on the model page — the
Benchmarks tab already renders coverage counts and an "Awaiting published scores"
section so gaps read as data rather than neglect.

## Cost and safety notes

`.github/workflows/autonomous-update.yml` runs the whole loop every 6 hours with
no human in it. That is deliberate — the safety is **structural**, not a gate:

- **Detection is free.** Research costs cents; the workflow caps it at 3
  candidates per run and bounds searches and turns per candidate.
- **The agent cannot touch the repo.** It has no filesystem or shell access and
  no network beyond `web_search`. It can only *return a spec*.
- **Specs are re-validated on submit**, not merely trusted — see `agents/README.md`.
- **A benchmark with no source, or one citing the benchmark's own definition
  paper, is rejected.** That is the failure mode that once left 45 placeholder
  numbers in this repo looking cited.
- **`pnpm build` must pass** (Zod over every model's frontmatter) before anything
  is kept.
- **Confidence gates publication.** Only `high`-confidence specs commit straight
  to `main`; anything lower opens a PR.
- **Every change is an ordinary commit**, so a bad call is one `git revert` away.

To put a human back in the loop permanently, set `force_pr: true` as the default
in the workflow — every update then arrives as a PR instead.

## The rule that survives automation

> **Never publish a number you cannot source. Omit it.**

Every layer enforces this independently: the agent's system prompt states it, the
validator rejects violations, the scaffolder defaults to no benchmarks, the eval
runner refuses to record a score from a run with API failures, and the UI marks
anything unverified and bars it from ranking.
