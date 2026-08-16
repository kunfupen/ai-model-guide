# Autonomous research agent

The catalog updates itself. This is the piece that made that possible: the
tracker can tell you *"an ID appeared that I've never seen"*, but turning that
into a correct model page used to need a human. This agent does that step.

```
tracker → "grok-4.6 is new"  →  research agent  →  validated spec  →  scaffold → build → publish
```

## Running it

```bash
node agents/research-agent.mjs --candidate "claude-opus-6"
node agents/research-agent.mjs --candidate "grok-5" --provider xai --json
node agents/research-agent.mjs --candidate anything --dry-run   # offline, no key, no cost
```

Exit codes: `0` submitted · `3` abandoned · `4` gave up · `1` error.
Needs `ANTHROPIC_API_KEY`. `--dry-run` needs nothing.

## Tools

| Tool | Kind | Purpose |
|---|---|---|
| `web_search` | server | Anthropic runs it; capped by `max_uses` |
| `list_catalog` | client | Everything already covered, so it can spot duplicates |
| `read_model_page` | client | A real page to copy house style from |
| `get_schema` | client | The allowed provider / modality / availability values |
| `validate_spec` | client | Check a draft without writing anything |
| `submit_model_spec` | client | Terminal — hands back a validated spec |
| `abandon` | client | Terminal — "this should not be added", a valid outcome |

## Why it is safe to run unattended

The agent is deliberately **incapable** of damaging the catalog. It cannot write
files, run commands, or reach the network except through `web_search`. All it can
do is *return a spec*. Everything protective lives outside it:

1. **Re-validation on submit.** `submit_model_spec` re-runs validation server-side
   rather than trusting that the agent called `validate_spec`, or that it
   submitted the same object it validated.
2. **Benchmarks must be attributable.** A score with no source is rejected. So is
   one citing the benchmark's own definition paper — the exact mistake that once
   left 45 placeholder numbers in this repo looking cited.
3. **Schema enums are read from `lib/schemas.ts`**, so the agent's guardrails
   cannot drift from the real contract. Inventing a provider fails validation.
4. **Duplicate detection** against the live catalog.
5. **The build must pass** — Zod validates every model's frontmatter — before
   anything is kept.
6. **Confidence gating.** Only `high`-confidence specs publish directly; anything
   else opens a PR for a human.
7. **Abandoning is a first-class outcome.** The prompt states plainly that a
   sparse spec or a refusal is not penalised, but being wrong is. Aliases,
   rumours, retired models and config variants are meant to be abandoned.
8. **Everything is a git commit**, so any bad call is one `git revert` away.

## Cost

A typical run is a handful of searches and a dozen turns — cents. The workflow
caps research at **3 candidates per run**, and `--max-searches` (default 12)
bounds the searching. `RESEARCH_AGENT_MAX_TURNS` (default 24) stops runaway loops.

## Verifying it offline

`--dry-run` rehearses the whole loop with scripted tool calls and no API access.
It deliberately submits two *invalid* specs first, so you can watch the guardrails
reject an unsourced benchmark and a definition-paper citation before a valid spec
passes. Use it after touching tools or validation.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required for real runs |
| `RESEARCH_AGENT_MODEL` | `claude-sonnet-4-6` | Model driving the agent |
| `RESEARCH_AGENT_MAX_TURNS` | `24` | Hard loop ceiling |

## Where it runs

`.github/workflows/autonomous-update.yml` — every 6 hours, or on demand with a
specific candidate. See `docs/AGENTIC-TRACKING.md` for the whole pipeline.
