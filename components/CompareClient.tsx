"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ModelFrontmatter } from "@/lib/schemas";
import { ProviderChip } from "./ProviderChip";
import { ProviderLogo } from "./ProviderLogo";

const MAX_COLUMNS = 4;

function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
  return String(tokens);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "best" means different things per row, so each row declares its own rule. */
type Better = "higher" | "lower" | null;

export function CompareClient({ models }: { models: ModelFrontmatter[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");

  const selectedSlugs = useMemo(() => {
    const raw = searchParams.get("models");
    if (!raw) return [];
    // Dedupe: a hand-edited URL like ?models=x,x would otherwise render two
    // identical columns sharing a React key.
    return [
      ...new Set(
        raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((s) => models.some((m) => m.slug === s)),
      ),
    ].slice(0, MAX_COLUMNS);
  }, [searchParams, models]);

  const selected = selectedSlugs
    .map((s) => models.find((m) => m.slug === s))
    .filter((m): m is ModelFrontmatter => Boolean(m));

  const setSlugs = (slugs: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slugs.length) params.set("models", slugs.join(","));
    else params.delete("models");
    const qs = params.toString();
    router.replace(qs ? `/compare?${qs}` : "/compare", { scroll: false });
  };

  const add = (slug: string) => {
    if (selectedSlugs.includes(slug) || selectedSlugs.length >= MAX_COLUMNS) return;
    setSlugs([...selectedSlugs, slug]);
    setQuery("");
    setPicking(false);
  };
  const remove = (slug: string) => setSlugs(selectedSlugs.filter((s) => s !== slug));

  const addable = models
    .filter((m) => !selectedSlugs.includes(m.slug))
    .filter((m) =>
      query.trim()
        ? `${m.name} ${m.provider}`.toLowerCase().includes(query.trim().toLowerCase())
        : true,
    )
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));

  // Every benchmark present on any selected model, in a stable order.
  const benchmarkNames = useMemo(() => {
    const seen = new Set<string>();
    for (const m of selected) for (const b of m.benchmarks) seen.add(b.name);
    return [...seen].sort();
  }, [selected]);

  /** Index of the winning column for a row, or null when nothing wins. */
  const winner = (values: (number | null)[], better: Better): number | null => {
    if (!better) return null;
    const real = values.filter((v): v is number => v !== null);
    if (real.length < 2) return null;
    const best = better === "higher" ? Math.max(...real) : Math.min(...real);
    // A tie has no single winner — don't crown one arbitrarily.
    if (real.filter((v) => v === best).length > 1) return null;
    return values.findIndex((v) => v === best);
  };

  const specRows: {
    label: string;
    better: Better;
    value: (m: ModelFrontmatter) => { display: React.ReactNode; num: number | null };
  }[] = [
    {
      label: "Context window",
      better: "higher",
      value: (m) => ({ display: `${formatContext(m.contextWindow)} tokens`, num: m.contextWindow }),
    },
    {
      label: "Input / 1M",
      better: "lower",
      value: (m) => ({
        display: m.pricing ? `$${m.pricing.inputPer1M}` : "—",
        num: m.pricing?.inputPer1M ?? null,
      }),
    },
    {
      label: "Output / 1M",
      better: "lower",
      value: (m) => ({
        display: m.pricing ? `$${m.pricing.outputPer1M}` : "—",
        num: m.pricing?.outputPer1M ?? null,
      }),
    },
    {
      label: "Released",
      better: null,
      value: (m) => ({ display: formatDate(m.releaseDate), num: null }),
    },
    {
      label: "Modalities",
      better: null,
      value: (m) => ({ display: m.modalities.join(" · "), num: null }),
    },
    {
      label: "Availability",
      better: null,
      value: (m) => ({ display: m.availability.join(", "), num: null }),
    },
    {
      label: "Best for",
      better: null,
      value: (m) => ({ display: m.strengths.length ? m.strengths.join(" · ") : "—", num: null }),
    },
  ];

  if (selected.length === 0) {
    return (
      <div>
        <ModelPicker
          models={addable}
          query={query}
          setQuery={setQuery}
          onPick={add}
          alwaysOpen
        />
        <p className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Pick up to {MAX_COLUMNS} models to compare them side by side.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {selected.map((m) => (
          <span
            key={m.slug}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1 pl-2.5 pr-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <ProviderLogo provider={m.provider} className="h-3.5 w-3.5" />
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{m.name}</span>
            <button
              type="button"
              onClick={() => remove(m.slug)}
              aria-label={`Remove ${m.name} from comparison`}
              className="grid h-5 w-5 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        {selected.length < MAX_COLUMNS && (
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-zinc-300 px-3 py-1 text-sm font-medium text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
          >
            <span aria-hidden>+</span> Add model
          </button>
        )}
        <button
          type="button"
          onClick={() => setSlugs([])}
          className="ml-auto text-xs font-medium text-zinc-500 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:decoration-zinc-700 dark:hover:text-zinc-100"
        >
          Clear all
        </button>
      </div>

      {picking && (
        <div className="mb-6">
          <ModelPicker models={addable} query={query} setQuery={setQuery} onPick={add} />
        </div>
      )}

      <div className="surface-card overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th scope="col" className="w-40 px-5 py-4 text-left text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
                Spec
              </th>
              {selected.map((m) => (
                <th key={m.slug} scope="col" className="px-5 py-4 text-left align-bottom">
                  <Link href={`/models/${m.slug}`} className="group block">
                    <ProviderChip provider={m.provider} />
                    <span className="mt-1.5 block font-semibold tracking-tight text-zinc-900 group-hover:underline group-hover:decoration-zinc-300 group-hover:underline-offset-4 dark:text-zinc-100">
                      {m.name.replace(/\s*\(preview\)/i, "")}
                    </span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {specRows.map((row) => {
              const cells = selected.map((m) => row.value(m));
              const win = winner(cells.map((c) => c.num), row.better);
              return (
                <tr key={row.label} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  <th scope="row" className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                    {row.label}
                  </th>
                  {cells.map((c, i) => (
                    <td
                      key={i}
                      className={`px-5 py-3 ${
                        i === win
                          ? "font-semibold text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {c.display}
                      {i === win && (
                        <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          best
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}

            {benchmarkNames.length > 0 && (
              <tr className="border-b border-zinc-100 dark:border-zinc-900">
                <th
                  scope="row"
                  colSpan={selected.length + 1}
                  className="bg-zinc-50 px-5 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:bg-zinc-900/50 dark:text-zinc-600"
                >
                  Benchmarks
                </th>
              </tr>
            )}
            {benchmarkNames.map((name) => {
              const entries = selected.map(
                (m) => m.benchmarks.find((b) => b.name === name) ?? null,
              );
              // Only verified scores can win a benchmark row.
              const nums = entries.map((b) =>
                b && b.verified !== false ? b.score / (b.max ?? 100) : null,
              );
              const win = winner(nums, "higher");
              return (
                <tr key={name} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  <th scope="row" className="px-5 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-500">
                    {name}
                  </th>
                  {entries.map((b, i) => (
                    <td
                      key={i}
                      className={`px-5 py-3 font-mono tabular-nums ${
                        i === win
                          ? "font-semibold text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {b ? (
                        <>
                          {b.score}
                          <span className="text-zinc-400 dark:text-zinc-600">/{b.max ?? 100}</span>
                          {b.verified === false && (
                            <span className="ml-1.5 font-sans text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-600">
                              unverified
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-700">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs leading-6 text-zinc-400 dark:text-zinc-600">
        &ldquo;Best&rdquo; marks the strongest value in this comparison only, and only when
        one model clearly leads — ties are left unmarked. Unverified placeholder scores
        can never win a benchmark row.
      </p>
    </div>
  );
}

function ModelPicker({
  models,
  query,
  setQuery,
  onPick,
  alwaysOpen = false,
}: {
  models: ModelFrontmatter[];
  query: string;
  setQuery: (v: string) => void;
  onPick: (slug: string) => void;
  alwaysOpen?: boolean;
}) {
  return (
    <div className={alwaysOpen ? "" : "surface-card p-4"}>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search models to compare…"
        aria-label="Search models to compare"
        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 shadow-sm transition-colors placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
      />
      <ul className="stagger mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {models.slice(0, 12).map((m, i) => (
          <li key={m.slug} style={{ "--i": i } as React.CSSProperties}>
            <button
              type="button"
              onClick={() => onPick(m.slug)}
              className="surface-card flex w-full items-center gap-2.5 p-3 text-left"
            >
              <ProviderLogo provider={m.provider} className="h-4 w-4 shrink-0" />
              <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {m.name.replace(/\s*\(preview\)/i, "")}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {models.length === 0 && (
        <p className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No models match &ldquo;{query}&rdquo;.
        </p>
      )}
    </div>
  );
}
