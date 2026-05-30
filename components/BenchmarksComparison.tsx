import Link from "next/link";
import type { ModelFrontmatter } from "@/lib/schemas";
import { ProviderChip } from "./ProviderChip";

// Preferred display order; anything else falls to the end, alphabetically.
const BENCHMARK_ORDER = ["MMLU", "HumanEval", "SWE-bench Verified", "GPQA Diamond"];

const BENCHMARK_BLURB: Record<string, string> = {
  MMLU: "Broad multitask knowledge (57 subjects)",
  HumanEval: "Python code-generation correctness",
  "SWE-bench Verified": "Resolving real GitHub issues",
  "GPQA Diamond": "Graduate-level science reasoning",
};

type Row = {
  slug: string;
  model: string;
  provider: ModelFrontmatter["provider"];
  score: number;
  max: number;
  pct: number;
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
  const groups = new Map<string, Row[]>();
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
    <div className="space-y-16">
      {names.map((name) => {
        const rows = (groups.get(name) ?? [])
          .slice()
          .sort((a, b) => b.pct - a.pct);
        const leaderPct = rows[0]?.pct ?? 0;

        return (
          <section key={name}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-zinc-200 pb-3 dark:border-zinc-800">
              <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {name}
              </h2>
              {BENCHMARK_BLURB[name] && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {BENCHMARK_BLURB[name]}
                </span>
              )}
            </div>

            <ul className="mt-6 space-y-3.5">
              {rows.map((r) => {
                const isLeader = r.pct === leaderPct;
                return (
                  <li key={r.slug}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <Link
                        href={`/models/${r.slug}`}
                        className="group flex min-w-0 items-center gap-2"
                      >
                        <ProviderChip provider={r.provider} />
                        <span className="truncate font-medium text-zinc-900 group-hover:underline group-hover:decoration-zinc-300 group-hover:underline-offset-4 dark:text-zinc-100">
                          {r.model}
                        </span>
                        {isLeader && (
                          <span className="shrink-0 rounded-full bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white dark:bg-zinc-100 dark:text-zinc-900">
                            ★ Best
                          </span>
                        )}
                      </Link>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                        {r.score}
                        <span className="text-zinc-400 dark:text-zinc-600">
                          {" "}
                          / {r.max}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                      <div
                        className={`h-full rounded-full transition-[width] ${
                          isLeader
                            ? "bg-zinc-900 dark:bg-zinc-100"
                            : "bg-zinc-300 dark:bg-zinc-700"
                        }`}
                        style={{ width: `${r.pct}%` }}
                        aria-hidden
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
