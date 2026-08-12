#!/bin/bash
# SessionStart hook: once per day, ask Claude to look for newly released models
# from OpenAI, Anthropic, Google, and Microsoft that aren't in the catalog yet,
# add them, and open a PR.
#
# A hook is just a shell script — it can't browse the web or reason on its own.
# So instead of doing the work here, we emit `additionalContext`, which injects
# a task instruction into the session. Claude then performs the model hunt using
# its web-search and git tools.
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
STAMP_FILE="$PROJECT_DIR/.claude/.last-model-check"
TODAY="$(date +%Y-%m-%d)"

# Throttle: only run once per calendar day, regardless of how many sessions open.
if [ -f "$STAMP_FILE" ] && [ "$(cat "$STAMP_FILE" 2>/dev/null)" = "$TODAY" ]; then
  exit 0
fi

# Record the attempt up front so repeated opens today won't re-trigger even if
# the user steers the session elsewhere.
echo "$TODAY" > "$STAMP_FILE"

# Build the instruction. Keep provider scope and guardrails explicit so the
# behavior matches what was agreed: scoped providers, official sources only,
# PR (never direct-to-main).
read -r -d '' TASK <<'EOF' || true
AUTOMATED FRONTIER-MODEL CHECK (daily, via SessionStart hook).

This repo has purpose-built tooling for this — use it instead of ad-hoc searching.
Full architecture: docs/AGENTIC-TRACKING.md

Step 1 — DETECT (deterministic, no guessing):
  Run: pnpm track
  It polls OpenAI, Anthropic, Google, and xAI (their /v1/models endpoints when
  keys are set, public docs/changelogs otherwise) and diffs the results against
  both the catalog and a committed baseline of previously-observed IDs.
  Exit 0 = nothing new; exit 10 = candidate(s) found.

  If nothing new: say so briefly and STOP. Do not go hunting.

Step 2 — TRIAGE each candidate:
  The tracker reports CANDIDATES, not confirmed releases. A docs page can mention
  an alias, a retired model, or a variant. Confirm against the provider's official
  announcement/docs that it is a real, newly released model. Skip anything you
  cannot confirm.

Step 3 — INGEST confirmed releases:
  Write a spec JSON and run: pnpm scaffold -- --spec <file>
  Fill specs only from official sources. OMIT benchmarks unless you have an
  official or corroborated figure — never invent one, and never substitute a
  variant (MMLU-Pro is not MMLU; SWE-bench Pro is not SWE-bench Verified).
  If the provider is new, add it to the Provider enum in lib/schemas.ts plus
  ProviderChip, FilterBar, ProviderLogo, and the OG-image colour map.
  Validate with: pnpm build

Step 4 — SCORE on our own benchmark:
  Add the wire model ID to evals/models.json (mark "verified": false until
  confirmed against provider docs), then:
    pnpm eval:self-test                       # must pass first
    pnpm eval -- --model <slug> --record      # needs the provider API key
  If no API key is available in this environment, skip scoring and say so — the
  "Run AMG Eval" GitHub workflow can do it later.

Step 5 — SHIP:
  Branch (model-updates/<today>), commit with sources in the message, push, and
  open a Pull Request. Do NOT push to main directly. In the PR body list each
  model with its official source and flag anything you could not fully verify.

Guiding rule: it is always better to omit a fact than to publish an unverified
one. This hook runs at most once per day.
EOF

# Emit the SessionStart JSON with additionalContext.
# Use a tiny here-doc + jq if available for safe JSON encoding; fall back to a
# minimal manual encoder otherwise.
if command -v jq >/dev/null 2>&1; then
  jq -nc --arg ctx "$TASK" \
    '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}'
else
  # Manual JSON-escape (newlines, quotes, backslashes).
  ESCAPED=$(printf '%s' "$TASK" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || true)
  if [ -n "$ESCAPED" ]; then
    printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":%s}}\n' "$ESCAPED"
  fi
fi
