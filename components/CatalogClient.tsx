"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ModelFrontmatter } from "@/lib/schemas";
import { filterAndSort, parseQuery } from "@/lib/filterModels";
import { ModelCard } from "./ModelCard";
import { FilterBar } from "./FilterBar";
import { SortMenu } from "./SortMenu";
import { SearchBox } from "./SearchBox";

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
      <div className="mb-6">
        <SearchBox />
      </div>

      <FilterBar />

      <div className="mt-10 flex items-baseline justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          Models
        </h2>
        <div className="flex items-center gap-4">
          {isFiltered && (
            <Link
              href="/"
              scroll={false}
              className="text-xs font-medium text-zinc-500 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:decoration-zinc-700 dark:hover:text-zinc-100"
            >
              Clear filters
            </Link>
          )}
          <p className="font-mono text-xs tabular-nums text-zinc-400 dark:text-zinc-600">
            {isFiltered ? `${pad(showing)} of ${pad(total)}` : `${pad(total)} total`}
          </p>
          <SortMenu />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <div
            aria-hidden
            className="grid h-12 w-12 place-items-center rounded-full border border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </div>
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            No models match the current filters.
          </p>
          <Link
            href="/"
            scroll={false}
            className="mt-3 text-sm font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
          >
            Clear all filters
          </Link>
        </div>
      ) : (
        <ul
          key={searchParams.toString()}
          className="stagger mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {filtered.map((f, i) => (
            <li key={f.slug} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
              <ModelCard frontmatter={f} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
