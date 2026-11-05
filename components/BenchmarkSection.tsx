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
  /** False for illustrative placeholders awaiting a verification pass. */
  verified: boolean;
  /** Who produced the number; undefined when the source's provenance is unclear. */
  reportedBy?: "vendor" | "independent";
};

/** Small tag saying who measured a score. Exported for the model page too. */
export function SourceTag({ reportedBy }: { reportedBy?: "vendor" | "independent" }) {
  if (reportedBy === "vendor")
    return (
      <span
        title="Self-reported: the model's own lab published this number (its docs, launch table or README)"
        className="shrink-0 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400"
      >
        Self-reported
      </span>
    );
  if (reportedBy === "independent")
    return (
      <span
        title="Independent: a third party ran this benchmark itself (e.g. Vals AI, Artificial Analysis)"
        className="shrink-0 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700 ring-1 ring-inset ring-sky-500/20 dark:text-sky-400"
      >
        Independent
      </span>
    );
  return null;
}

const TOP_N = 5;

export function BenchmarkSection({
  name,
  blurb,
  rows,
  legacyRows = [],
  totalModels,
  firstParty = false,
  legacy = false,
}: {
  name: string;
  blurb?: string;
  /** Scores from current models — the only ones ranked and eligible for ★ Best. */
  rows: BenchmarkRow[];
  /** Scores from superseded models, shown on request, never ranked as Best. */
  legacyRows?: BenchmarkRow[];
  totalModels?: number;
  firstParty?: boolean;
  /** Saturated benchmark kept for historical context only. */
  legacy?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);

  // Only a verified score can hold "best on this benchmark" — an unverified
  // placeholder must never be presented as the leader.
  const leaderPct = rows.find((r) => r.verified)?.pct ?? -1;
  const unverifiedCount = rows.filter((r) => !r.verified).length;
  const hasMore = rows.length > TOP_N;
  const visible = expanded ? rows : rows.slice(0, TOP_N);
  const hiddenCount = rows.length - TOP_N;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {name}
          </h2>
          {firstParty && (
            <span
              title="We run this benchmark ourselves, in-house"
              className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-400"
            >
              First-party
            </span>
          )}
          {legacy && (
            <span
              title="Saturated — top models cluster too tightly for this to separate them. Kept for historical context."
              className="inline-flex items-center rounded-full bg-zinc-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 ring-1 ring-inset ring-zinc-500/20 dark:text-zinc-400"
            >
              Legacy
            </span>
          )}
          {unverifiedCount > 0 && (
            <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-600">
              {unverifiedCount} unverified
            </span>
          )}
          {typeof totalModels === "number" && (
            <span className="font-mono text-[11px] tabular-nums text-zinc-400 dark:text-zinc-600">
              {rows.length}/{totalModels} current models
            </span>
          )}
        </div>
        {blurb && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">{blurb}</span>
        )}
      </div>

      {rows.length === 0 && (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
          No current model has a score here — only superseded ones.
        </p>
      )}

      <ul className="mt-6 space-y-3.5">
        {visible.map((r, i) => {
          const isLeader = r.verified && r.pct === leaderPct;
          return (
            <li key={r.slug}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <Link
                  href={`/models/${r.slug}`}
                  className="group flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
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
                  {!r.verified && (
                    <span
                      title="Illustrative placeholder — not yet traced to an official or corroborated source"
                      className="shrink-0 rounded-full border border-dashed border-zinc-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:border-zinc-600 dark:text-zinc-500"
                    >
                      Unverified
                    </span>
                  )}
                  {r.verified && <SourceTag reportedBy={r.reportedBy} />}
                </Link>
                <span
                  className={`shrink-0 font-mono text-xs tabular-nums ${
                    r.verified ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-400 dark:text-zinc-600"
                  }`}
                >
                  {r.score}
                  <span className="text-zinc-400 dark:text-zinc-600"> / {r.max}</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                <div
                  className={`bar-fill h-full rounded-full ${
                    !r.verified
                      ? "bg-zinc-200 dark:bg-zinc-800"
                      : isLeader
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

      {legacyRows.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowLegacy((v) => !v)}
            aria-expanded={showLegacy}
            className="text-xs font-medium text-zinc-500 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:decoration-zinc-700 dark:hover:text-zinc-100"
          >
            {showLegacy
              ? "Hide legacy models"
              : `Show ${legacyRows.length} legacy model${legacyRows.length === 1 ? "" : "s"}`}
          </button>
          {showLegacy && (
            <ul className="mt-4 space-y-3 border-l-2 border-dashed border-zinc-200 pl-4 dark:border-zinc-800">
              {legacyRows.map((r) => (
                <li key={r.slug}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <Link href={`/models/${r.slug}`} className="group flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <ProviderChip provider={r.provider} />
                      <span className="truncate text-zinc-500 group-hover:underline group-hover:decoration-zinc-300 group-hover:underline-offset-4 dark:text-zinc-400">
                        {r.model}
                      </span>
                      <span className="shrink-0 rounded-full bg-zinc-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 ring-1 ring-inset ring-zinc-500/20 dark:text-zinc-400">
                        Legacy
                      </span>
                      {!r.verified ? (
                        <span className="shrink-0 rounded-full border border-dashed border-zinc-300 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:border-zinc-600 dark:text-zinc-500">
                          Unverified
                        </span>
                      ) : (
                        <SourceTag reportedBy={r.reportedBy} />
                      )}
                    </Link>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-400 dark:text-zinc-600">
                      {r.score}
                      <span> / {r.max}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
                    <div className="h-full rounded-full bg-zinc-200 dark:bg-zinc-800" style={{ width: `${r.pct}%` }} aria-hidden />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
