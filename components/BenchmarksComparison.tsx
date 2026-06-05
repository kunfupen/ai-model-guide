import type { ModelFrontmatter } from "@/lib/schemas";
import { BenchmarkSection, type BenchmarkRow } from "./BenchmarkSection";

// Preferred display order; anything else falls to the end, alphabetically.
const BENCHMARK_ORDER = ["MMLU", "HumanEval", "SWE-bench Verified", "GPQA Diamond"];

const BENCHMARK_BLURB: Record<string, string> = {
  MMLU: "Broad multitask knowledge (57 subjects)",
  HumanEval: "Python code-generation correctness",
  "SWE-bench Verified": "Resolving real GitHub issues",
  "GPQA Diamond": "Graduate-level science reasoning",
};

function orderBenchmarks(names: string[]): string[] {
  return names.slice().sort((a, b) => {
    const ia = BENCHMARK_ORDER.indexOf(a);
    const ib = BENCHMARK_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export function BenchmarksComparison({ models }: { models: ModelFrontmatter[] }) {
  // Group every model's score under each benchmark (task).
  const groups = new Map<string, BenchmarkRow[]>();
  for (const m of models) {
    for (const b of m.benchmarks) {
      const max = b.max ?? 100;
      const rows = groups.get(b.name) ?? [];
      rows.push({
        slug: m.slug,
        model: m.name,
        provider: m.provider,
        score: b.score,
        max,
        pct: Math.min(100, Math.max(0, (b.score / max) * 100)),
      });
      groups.set(b.name, rows);
    }
  }

  const names = orderBenchmarks(Array.from(groups.keys()));

  if (names.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No benchmark data available yet.
      </p>
    );
  }

  return (
    <div className="stagger space-y-16">
      {names.map((name, i) => {
        const rows = (groups.get(name) ?? [])
          .slice()
          .sort((a, b) => b.pct - a.pct);

        return (
          <div key={name} style={{ "--i": i * 2 } as React.CSSProperties}>
            <BenchmarkSection
              name={name}
              blurb={BENCHMARK_BLURB[name]}
              rows={rows}
            />
          </div>
        );
      })}
    </div>
  );
}
