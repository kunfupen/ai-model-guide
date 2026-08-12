# AMG Eval — our own benchmark

Third-party leaderboards take days or weeks to score a new frontier model. This
catalog kept hitting the same wall: a model launches, we can describe it, but the
Benchmarks tab has nothing to show. AMG Eval fixes that — we run our own suite,
so a brand-new model gets a comparable score the day it ships.

It is deliberately **small and honest** rather than sweeping. It will not tell you
which model is smartest. It tells you how models compare on a fixed set of tasks
under identical conditions, and you can reproduce every number yourself.

## Quick start

```bash
pnpm eval:self-test                              # no API keys needed
pnpm eval -- --model anthropic-claude-opus-5     # score one model
pnpm eval -- --all --record                      # score everything, write to the site
```

## Design

**1. Contamination-resistant.** Almost every task is procedurally generated from
a seed over invented entities (`vantrel`, depot `Kessreth`, inspector `Ravik`).
The numbers, names, banned words, and puzzle orderings all change with the seed,
so no task can be memorised from training data. Change the seed and you get a
fresh exam of identical difficulty:

```bash
pnpm eval -- --model X --seed 987654
```

**2. Deterministically graded.** There is no LLM-as-judge anywhere in the scoring
path. Every task is checked by code — exact match, numeric comparison, regex,
JSON shape, line structure, or *executing the model's code against hidden tests*.
The same response always earns the same score.

**3. Self-verifying.** Every task ships with a reference answer. `--self-test`
grades those references and requires 100%, which proves the exam is solvable and
the graders are correct. It runs in CI on every push. There is also a negative
test: junk output such as `"I'm not sure"` must score **0** on every task — an
early version of the constraint task passed on a refusal, and that bug was caught
exactly this way.

**4. Fair.** Identical prompt text, identical token budget, temperature 0 (or the
provider's nearest deterministic setting), and the same retry policy for every
model. No per-provider prompt tuning. Anything a provider cannot honour is
recorded in the result rather than silently worked around.

**5. Cheap.** ~12 prompts per model, so a full run costs cents and finishes in
minutes.

## Categories

| Category | What it probes | Grading |
|---|---|---|
| `instruction-following` | Exact format compliance, negative constraints | line structure, regex, composite |
| `structured-output` | JSON extraction and aggregation from a manifest | parsed-JSON field equality |
| `numeric-reasoning` | Multi-step arithmetic, percentages, simple algebra | final-number match |
| `code-correctness` | Writing a function to spec | **executed** against hidden tests |
| `long-context-retrieval` | A planted fact inside ~120 generated log lines | substring match |
| `constraint-satisfaction` | A small ordering puzzle with a unique solution | exact match |

`code-correctness` is weighted 1.5×; everything else 1×. The headline score is the
weighted percentage; per-category breakdowns are in `evals/results/<slug>.json`.

## Honest limitations

Read these before quoting a number.

- **It is small.** ~12 tasks cannot separate two frontier models by a point or
  two. Treat gaps under ~5 points as noise.
- **It is not a reasoning ceiling test.** These tasks are tractable by design so
  they grade deterministically. A model can ace AMG Eval and still be weaker at
  research-grade problems.
- **Config sensitivity.** Providers expose different reasoning-effort settings.
  We use each provider's default at temperature 0 and do not tune per model — so
  a model with a high-effort mode may score below its advertised peak.
- **Scores are recorded only on clean runs.** If any task fails at the API layer
  (rate limit, bad model ID, timeout), the run is reported but **not** written to
  the site — a network failure must never masquerade as a low score.
- **Model IDs must be verified.** `evals/models.json` maps catalog slugs to wire
  IDs and every entry is flagged `"verified": false` until a human confirms it
  against provider docs. A wrong ID shows up as an API error, never a silent zero.

## Files

| File | Role |
|---|---|
| `suite.mjs` | Task generation from a seed, plus reference answers |
| `graders.mjs` | Deterministic graders, including sandboxed code execution |
| `providers.mjs` | One uniform `complete()` across OpenAI/Anthropic/Google/xAI |
| `run-eval.mjs` | Runner, self-test, scoring, reporting |
| `record-result.mjs` | Writes scores into model MDX frontmatter |
| `models.json` | Catalog slug → API model ID registry |
| `results/` | Raw per-task output, committed for transparency |

## Reproducing a published score

Every score on the site links here. To check one:

```bash
git clone https://github.com/kunfupen/ai-model-guide && cd ai-model-guide
pnpm install
ANTHROPIC_API_KEY=sk-... pnpm eval -- --model anthropic-claude-opus-5 --seed 20260724
```

The seed used for any recorded score is in `evals/results/<slug>.json`.
