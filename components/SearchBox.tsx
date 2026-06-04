"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function SearchBox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlValue = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep local state in sync if the URL changes externally (e.g. Clear filters).
  // This is an intentional external-system sync, not derived render state.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(urlValue);
  }, [urlValue]);

  // Debounced write-through to the URL.
  useEffect(() => {
    const id = setTimeout(() => {
      const current = searchParams.get("q") ?? "";
      if (value === current) return;
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) params.set("q", value.trim());
      else params.delete("q");
      const qs = params.toString();
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    }, 180);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // "/" focuses the search, Escape clears it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el as HTMLElement | null)?.isContentEditable;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && el === inputRef.current) {
        setValue("");
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </span>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search models…"
        aria-label="Search models"
        className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-12 text-sm text-zinc-900 shadow-sm transition-colors placeholder:text-zinc-400 hover:border-zinc-300 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:hover:border-zinc-700 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            setValue("");
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 grid h-5 w-5 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      ) : (
        <kbd
          aria-hidden
          className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 sm:block dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500"
        >
          /
        </kbd>
      )}
    </div>
  );
}
