"use client";

import { useState } from "react";
import Link from "next/link";
import { ProviderChip } from "./ProviderChip";
import type { Provider } from "@/lib/schemas";

export type BenchmarkRow = {
  slug: string;
  model: string;
  provider: Provider;
  score: number;
  max: number;
  pct: number;
};

const TOP_N = 5;

export function BenchmarkSection({
  name,
  blurb,
  rows,
}: {
  name: string;
  blurb?: string;
  rows: BenchmarkRow[];
}) {
  const [expanded, setExpanded] = useState(false);

  const leaderPct = rows[0]?.pct ?? 0;
  const hasMore = rows.length > TOP_N;
  const visible = expanded ? rows : rows.slice(0, TOP_N);
  const hiddenCount = rows.length - TOP_N;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {name}
        </h2>
        {blurb && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">{blurb}</span>
        )}
      </div>

      <ul className="mt-6 space-y-3.5">
        {visible.map((r, i) => {
          const isLeader = r.pct === leaderPct;
          return (
            <li key={r.slug}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <Link
                  href={`/models/${r.slug}`}
                  className="group flex min-w-0 items-center gap-2"
                >
                  <span className="w-5 shrink-0 font-mono text-xs tabular-nums text-zinc-300 dark:text-zinc-600">
                    {String(i + 1).padStart(2, "0")}
                  </span>
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
                  <span className="text-zinc-400 dark:text-zinc-600"> / {r.max}</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                <div
                  className={`bar-fill h-full rounded-full ${
                    isLeader
                      ? "bg-zinc-900 dark:bg-zinc-100"
                      : "bg-zinc-300 dark:bg-zinc-700"
                  }`}
                  style={{
                    width: `${r.pct}%`,
                    animationDelay: `${Math.min(i, TOP_N) * 60}ms`,
                  }}
                  aria-hidden
                />
              </div>
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
        >
          {expanded ? "Show less" : `Show ${hiddenCount} more`}
          <svg
            viewBox="0 0 24 24"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      )}
    </section>
  );
}
