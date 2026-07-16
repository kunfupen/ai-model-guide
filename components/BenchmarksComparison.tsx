import Link from "next/link";
import type { ModelFrontmatter } from "@/lib/schemas";
import { BenchmarkSection, type BenchmarkRow } from "./BenchmarkSection";
import { ProviderChip } from "./ProviderChip";

// Preferred display order; anything else falls to the end, alphabetically.
const BENCHMARK_ORDER = [
  "MMLU",
  "HumanEval",
  "SWE-bench Verified",
  "GPQA Diamond",
  "Terminal-Bench 2.1",
  "τ²-bench Telecom",
];

const BENCHMARK_BLURB: Record<string, string> = {
  MMLU: "Broad multitask knowledge (57 subjects)",
  HumanEval: "Python code-generation correctness",
  "SWE-bench Verified": "Resolving real GitHub issues",
  "GPQA Diamond": "Graduate-level science reasoning",
  "Terminal-Bench 2.1": "Agentic coding in a live terminal",
  "τ²-bench Telecom": "Agentic tool-use workflows (customer service)",
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
  const unbenchmarked = models
    .filter((m) => m.benchmarks.length === 0)
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));

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
              totalModels={models.length}
            />
          </div>
        );
      })}

      {unbenchmarked.length > 0 && (
        <section style={{ "--i": names.length * 2 } as React.CSSProperties}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-zinc-200 pb-3 dark:border-zinc-800">
            <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              Awaiting published scores
            </h2>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              No credible published figures yet — we don&apos;t guess
            </span>
          </div>
          <ul className="mt-6 flex flex-wrap gap-2.5">
            {unbenchmarked.map((m) => (
              <li key={m.slug}>
                <Link
                  href={`/models/${m.slug}`}
                  className="group inline-flex items-center gap-2.5 rounded-full border border-zinc-200 bg-white py-1.5 pl-3 pr-4 text-sm transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
                >
                  <ProviderChip provider={m.provider} />
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {m.name.replace(/\s*\(preview\)/i, "")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-6 text-zinc-400 dark:text-zinc-500">
            These are mostly specialized (image/video) models where text benchmarks
            don&apos;t apply, or releases whose providers haven&apos;t published stable
            figures on our tracked benchmarks. Each model page explains the specific
            reason.
          </p>
        </section>
      )}
    </div>
  );
}
