// Deterministic graders. No LLM-as-judge anywhere in the scoring path — every
// task is machine-checkable, so the same response always earns the same score
// and results are reproducible by anyone who clones the repo.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const execFileP = promisify(execFile);

const norm = (s) => String(s ?? "").trim();
const squash = (s) => norm(s).toLowerCase().replace(/\s+/g, " ");

/** Strip markdown code fences so JSON/code tasks aren't penalised for wrapping. */
export function stripFences(text) {
  const t = norm(text);
  const fence = t.match(/```(?:[a-zA-Z]+)?\s*\n([\s\S]*?)```/);
  return fence ? fence[1].trim() : t;
}

/** Last standalone number in the text — how we read a "final answer". */
function lastNumber(text) {
  const matches = norm(text).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/g);
  return matches ? Number(matches[matches.length - 1]) : NaN;
}

const GRADERS = {
  /** Normalized exact match against any accepted answer. */
  exact: (resp, g) => {
    const got = squash(resp);
    const accept = (g.accept ?? [g.answer]).map(squash);
    return accept.includes(got) ? 1 : 0;
  },

  /** The final number in the response must equal `answer` (within tolerance). */
  numeric: (resp, g) => {
    const got = lastNumber(resp);
    if (Number.isNaN(got)) return 0;
    const tol = g.tolerance ?? 0;
    return Math.abs(got - g.answer) <= tol ? 1 : 0;
  },

  /** Every required substring must appear (case-insensitive). */
  containsAll: (resp, g) => {
    const hay = squash(resp);
    const need = g.substrings ?? [];
    const hit = need.filter((s) => hay.includes(squash(s))).length;
    if (g.partial) return need.length ? hit / need.length : 0;
    return hit === need.length ? 1 : 0;
  },

  /** None of these may appear — used to test constraint obedience. */
  excludesAll: (resp, g) => {
    const hay = squash(resp);
    return (g.substrings ?? []).some((s) => hay.includes(squash(s))) ? 0 : 1;
  },

  /** At least `min` of these substrings must appear — a light topicality check. */
  containsAny: (resp, g) => {
    const hay = squash(resp);
    const hit = (g.substrings ?? []).filter((s) => hay.includes(squash(s))).length;
    return hit >= (g.min ?? 1) ? 1 : 0;
  },

  /** Sentence-count bounds, so "I don't know" can't satisfy a writing task. */
  sentences: (resp, g) => {
    const n = norm(resp).split(/[.!?]+(?:\s|$)/).map(norm).filter(Boolean).length;
    if (g.min !== undefined && n < g.min) return 0;
    if (g.max !== undefined && n > g.max) return 0;
    return 1;
  },

  /**
   * Composite AND — every sub-grader must pass. Prevents "negative constraint"
   * tasks from being satisfied by refusing to answer.
   */
  all: async (resp, g) => {
    for (const sub of g.of ?? []) {
      const s = await grade(resp, sub);
      if (s < 1) return 0;
    }
    return 1;
  },

  /** Every regex must match. */
  regexAll: (resp, g) => {
    const text = norm(resp);
    const pats = (g.patterns ?? []).map((p) => new RegExp(p, g.flags ?? "m"));
    const hit = pats.filter((re) => re.test(text)).length;
    if (g.partial) return pats.length ? hit / pats.length : 0;
    return hit === pats.length ? 1 : 0;
  },

  /** Exact line count, and optionally every line matching a pattern. */
  lines: (resp, g) => {
    const ls = norm(resp).split("\n").map(norm).filter(Boolean);
    if (g.count !== undefined && ls.length !== g.count) return 0;
    if (g.eachMatches) {
      const re = new RegExp(g.eachMatches);
      if (!ls.every((l) => re.test(l))) return 0;
    }
    return 1;
  },

  /** Must parse as JSON and satisfy shape/value checks. */
  json: (resp, g) => {
    let parsed;
    try {
      parsed = JSON.parse(stripFences(resp));
    } catch {
      return 0;
    }
    let score = 1;
    for (const [pointer, expected] of Object.entries(g.equals ?? {})) {
      const actual = pointer
        .split(".")
        .reduce((acc, k) => (acc == null ? acc : acc[/^\d+$/.test(k) ? Number(k) : k]), parsed);
      const same =
        typeof expected === "number" || typeof expected === "boolean"
          ? actual === expected
          : squash(actual) === squash(expected);
      if (!same) score = 0;
    }
    for (const key of g.requiredKeys ?? []) {
      if (!(key in (parsed ?? {}))) score = 0;
    }
    if (g.arrayLength !== undefined && (!Array.isArray(parsed) || parsed.length !== g.arrayLength)) {
      score = 0;
    }
    return score;
  },

  /**
   * Execute the model's JavaScript against hidden test cases in a subprocess.
   * The model never sees the tests, so it can't special-case them.
   */
  codeExec: async (resp, g) => {
    const code = stripFences(resp);
    if (!code) return 0;
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "amg-eval-"));
    const file = path.join(dir, "candidate.mjs");
    const harness = `
${code}

const cases = ${JSON.stringify(g.cases)};
let pass = 0;
for (const c of cases) {
  try {
    const got = ${g.entry}(...c.args);
    if (JSON.stringify(got) === JSON.stringify(c.expect)) pass++;
  } catch {}
}
console.log(JSON.stringify({ pass, total: cases.length }));
`;
    try {
      await fs.writeFile(file, harness, "utf8");
      const { stdout } = await execFileP(process.execPath, [file], { timeout: 10_000 });
      const line = stdout.trim().split("\n").pop();
      const { pass, total } = JSON.parse(line);
      return total ? pass / total : 0;
    } catch {
      return 0;
    } finally {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  },
};

/** Grade one response. Returns 0..1. */
export async function grade(response, grader) {
  const fn = GRADERS[grader.type];
  if (!fn) throw new Error(`Unknown grader type: ${grader.type}`);
  const score = await fn(response, grader);
  return Math.max(0, Math.min(1, Number(score) || 0));
}

export const GRADER_TYPES = Object.keys(GRADERS);
