"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { SortKey } from "@/lib/filterModels";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "name", label: "Name (A→Z)" },
  { key: "cheapest", label: "Cheapest input" },
  { key: "context", label: "Largest context" },
];

export function SortMenu() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentKey = (searchParams.get("sort") ?? "newest") as SortKey;
  const activeLabel =
    SORT_OPTIONS.find((o) => o.key === currentKey)?.label ?? SORT_OPTIONS[0].label;

  const setSort = (key: SortKey, detailsEl: HTMLDetailsElement | null) => {
    const params = new URLSearchParams(searchParams.toString());
    // "newest" is the default — omit it from the URL to keep links clean.
    if (key === "newest") params.delete("sort");
    else params.set("sort", key);
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    if (detailsEl) detailsEl.open = false;
  };

  return (
    <details className="sort-menu group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 transition-all hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-600 [&::-webkit-details-marker]:hidden">
        <span className="text-zinc-500 dark:text-zinc-500">Sort:</span>
        <span>{activeLabel}</span>
        <span aria-hidden className="sort-arrow text-zinc-400 dark:text-zinc-600">↓</span>
      </summary>
      <ul className="sort-panel absolute right-0 z-20 mt-2 min-w-[12rem] rounded-lg border border-zinc-200 bg-white py-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {SORT_OPTIONS.map((o) => (
          <li key={o.key}>
            <button
              type="button"
              onClick={(e) =>
                setSort(o.key, e.currentTarget.closest("details"))
              }
              className={`block w-full px-3 py-1.5 text-left text-xs transition-colors ${
                o.key === currentKey
                  ? "font-medium text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {o.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
