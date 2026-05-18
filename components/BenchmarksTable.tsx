import type { ModelFrontmatter } from "@/lib/schemas";

type Benchmark = ModelFrontmatter["benchmarks"][number];

export function BenchmarksTable({ benchmarks }: { benchmarks: Benchmark[] }) {
  if (benchmarks.length === 0) return null;

  return (
    <section className="mt-16">
      <h2 className="border-b border-zinc-200 pb-3 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Benchmarks
      </h2>
      <ul className="mt-6 space-y-5">
        {benchmarks.map((b) => {
          const max = b.max ?? 100;
          const pct = Math.min(100, Math.max(0, (b.score / max) * 100));
          return (
            <li key={b.name}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">
                  {b.source ? (
                    <a
                      href={b.source}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-900 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
                    >
                      {b.name}
                    </a>
                  ) : (
                    b.name
                  )}
                </span>
                <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                  {b.score}
                  <span className="text-zinc-400 dark:text-zinc-600"> / {max}</span>
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                <div
                  className="h-full rounded-full bg-zinc-900 transition-[width] dark:bg-zinc-100"
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
