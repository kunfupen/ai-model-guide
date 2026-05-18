"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function FilterChip({
  paramKey,
  value,
  label,
  dotClass,
}: {
  paramKey: string;
  value: string;
  label: string;
  dotClass?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current =
    searchParams.get(paramKey)?.split(",").filter(Boolean) ?? [];
  const isActive = current.includes(value);

  const toggle = useCallback(() => {
    const next = isActive
      ? current.filter((v) => v !== value)
      : [...current, value];
    const params = new URLSearchParams(searchParams.toString());
    if (next.length === 0) params.delete(paramKey);
    else params.set(paramKey, next.join(","));
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  }, [router, searchParams, paramKey, value, isActive, current]);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isActive}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        isActive
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-600"
      }`}
    >
      {dotClass && (
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden />
      )}
      {label}
    </button>
  );
}
