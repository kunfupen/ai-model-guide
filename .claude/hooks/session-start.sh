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
AUTOMATED MODEL-CATALOG CHECK (daily, via SessionStart hook).

Goal: find AI models released or updated by OpenAI, Anthropic, Google, or
Microsoft that are NOT already in content/models/, add them, and open a PR.

Scope — ONLY these four providers this run: openai, anthropic, google, microsoft.
Ignore all other providers.

Steps:
1. List existing models: `ls content/models/*.mdx` and note names/slugs already present.
2. Web-search each provider for their latest models (this year and last). Suggested
   queries: "latest <provider> AI model <current-year> release". Also check the
   provider's official model docs/pricing pages.
3. For each model found that is genuinely NEW (not already a file in content/models/):
   - REQUIRE an official source (provider docs / official announcement) for the
     model's existence and core specs. If you cannot find an official source, SKIP it.
   - Create content/models/<provider>-<slug>.mdx following the exact frontmatter
     schema in lib/schemas.ts. Use anthropic-claude-4-8-opus.mdx as the template.
   - Fill specs (context window, pricing, modalities, availability) from official
     pages. For benchmarks you cannot verify from a credible source, OMIT them or
     add a clear "TODO: verify" — never invent numbers.
   - If the provider is new to the enum, it's already added (microsoft is supported).
4. Validate: run `pnpm build` (Zod validates all frontmatter; the build must pass).
   Fix any validation errors before continuing.
5. If — and only if — you added at least one model and the build passes:
   - Create a branch like `model-updates/<today>`.
   - Commit with a clear message listing the models added and their sources.
   - Push and open a Pull Request (do NOT push to main directly). In the PR body,
     list each new model with its official source link, and flag any spec you
     could not fully verify so a human can review.
6. If you found nothing new (catalog already current), do nothing further — no
   branch, no PR. Just briefly tell the user the catalog is up to date.

Be conservative: it is better to skip an uncertain model than to publish wrong
specs. This was configured to run at most once per day.
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
