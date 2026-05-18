"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { ModelFrontmatter } from "@/lib/schemas";
import { filterAndSort, parseQuery } from "@/lib/filterModels";
import { ModelCard } from "./ModelCard";
import { FilterBar } from "./FilterBar";
import { SortMenu } from "./SortMenu";

export function CatalogClient({ models }: { models: ModelFrontmatter[] }) {
  const searchParams = useSearchParams();
  const filtered = useMemo(() => {
    return filterAndSort(
      models,
      parseQuery(new URLSearchParams(searchParams.toString())),
    );
  }, [models, searchParams]);

  const total = models.length;
  const showing = filtered.length;
  const isFiltered = showing !== total;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section>
      <FilterBar />

      <div className="mt-10 flex items-baseline justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          Models
        </h2>
        <div className="flex items-center gap-4">
          <p className="font-mono text-xs tabular-nums text-zinc-400 dark:text-zinc-600">
            {isFiltered ? `${pad(showing)} of ${pad(total)}` : `${pad(total)} total`}
          </p>
          <SortMenu />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-16 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No models match the current filters.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => (
            <li key={f.slug}>
              <ModelCard frontmatter={f} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
