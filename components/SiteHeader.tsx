"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/", label: "Models", match: (p: string) => p === "/" || p.startsWith("/models") },
  { href: "/benchmarks", label: "Benchmarks", match: (p: string) => p.startsWith("/benchmarks") },
  { href: "/tools", label: "Tools", match: (p: string) => p.startsWith("/tools") },
];

// The palette listens for ⌘K / Ctrl-K globally; dispatch a synthetic event so
// the visible button and the keyboard shortcut share one code path.
function openCommandPalette() {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
  );
}

export function SiteHeader() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-white/70 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-950/70">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2.5 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
        >
          <span
            aria-hidden
            className="grid h-7 w-7 place-items-center rounded-lg bg-zinc-900 text-[13px] font-bold text-white shadow-sm transition-transform duration-300 ease-out group-hover:scale-105 dark:bg-zinc-100 dark:text-zinc-900"
          >
            AI
          </span>
          <span>Model Guide</span>
        </Link>

        <nav className="flex items-center gap-0.5 text-sm sm:gap-1">
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label="Open command palette"
            className="search-trigger mr-1 hidden items-center gap-2 rounded-full border border-zinc-200 bg-white py-1.5 pl-3 pr-2 text-xs text-zinc-500 transition-all hover:border-zinc-300 hover:text-zinc-900 sm:flex dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <span>Search</span>
            <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] dark:border-zinc-700 dark:bg-zinc-900">
              ⌘K
            </kbd>
          </button>
          {/* Mobile: icon-only search trigger */}
          <button
            type="button"
            onClick={openCommandPalette}
            aria-label="Open command palette"
            className="search-trigger grid h-8 w-8 place-items-center rounded-full text-zinc-500 transition-all hover:bg-zinc-100 hover:text-zinc-900 sm:hidden dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </button>
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-full px-2.5 py-1.5 font-medium transition-colors sm:px-3 ${
                  active
                    ? "text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {active && (
                  <span
                    aria-hidden
                    className="nav-pill absolute inset-0 -z-10 rounded-full bg-zinc-100 dark:bg-zinc-800/80"
                  />
                )}
                {item.label}
              </Link>
            );
          })}
          <span aria-hidden className="mx-0.5 h-4 w-px bg-zinc-200 sm:mx-1 dark:bg-zinc-800" />
          <a
            href="https://github.com/kunfupen/ai-model-guide"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub repository"
            className="hidden h-8 w-8 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 sm:grid dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
