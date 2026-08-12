// Writes AMG Eval scores into the model MDX files as a normal benchmark entry,
// so the score flows into the Benchmarks tab, the model card headline bar, and
// the coverage counts with no other code changes.
//
// Edits the frontmatter as text (rather than re-serialising via gray-matter) to
// keep diffs minimal and preserve the hand-written formatting of every other field.

import { promises as fs } from "node:fs";
import path from "node:path";
import { MODELS_DIR } from "../scripts/lib/catalog.mjs";

const RESULTS_URL = "https://github.com/kunfupen/ai-model-guide/tree/main/evals";

function upsertBenchmark(source, { name, score, sourceUrl }) {
  const fmMatch = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fmMatch) throw new Error("No frontmatter found");
  let fm = fmMatch[1];

  const entry =
    `  - name: ${name}\n` +
    `    score: ${score}\n` +
    `    max: 100\n` +
    `    source: ${sourceUrl}`;

  // Remove any previous entry for this benchmark so re-runs replace, not stack.
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  fm = fm.replace(new RegExp(`\\n  - name: ${escaped}\\n(?:    .*\\n?)*`, "g"), "\n");

  if (/^benchmarks:\s*\[\]\s*$/m.test(fm)) {
    fm = fm.replace(/^benchmarks:\s*\[\]\s*$/m, `benchmarks:\n${entry}`);
  } else if (/^benchmarks:\s*$/m.test(fm)) {
    fm = fm.replace(/^benchmarks:\s*$/m, `benchmarks:\n${entry}`);
  } else {
    // Append to the end of the existing benchmarks block.
    fm = fm.replace(/(^benchmarks:\n(?:(?:  - name:.*|    .*)\n?)*)/m, (block) => `${block.replace(/\n*$/, "")}\n${entry}\n`);
  }

  return source.replace(fmMatch[0], `---\n${fm.replace(/\n+$/, "")}\n---\n`);
}

export async function recordScores(records) {
  let written = 0;
  for (const rec of records) {
    if (!rec) continue;
    if (rec.apiFailureCount > 0) {
      console.warn(`Not recording ${rec.slug}: ${rec.apiFailureCount} API failure(s) make the score unreliable.`);
      continue;
    }
    const file = path.join(MODELS_DIR, `${rec.slug}.mdx`);
    let source;
    try {
      source = await fs.readFile(file, "utf8");
    } catch {
      console.warn(`Not recording ${rec.slug}: ${path.basename(file)} not found.`);
      continue;
    }
    const next = upsertBenchmark(source, {
      name: rec.benchmark,
      score: rec.overall,
      sourceUrl: RESULTS_URL,
    });
    if (next !== source) {
      await fs.writeFile(file, next, "utf8");
      written++;
      console.log(`Recorded ${rec.benchmark} ${rec.overall} into ${path.basename(file)}`);
    }
  }
  if (written) {
    console.log(`\nUpdated ${written} model page(s). Run \`pnpm build\` to validate.`);
  }
  return written;
}

export { upsertBenchmark };
