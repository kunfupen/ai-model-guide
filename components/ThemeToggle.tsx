"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const ORDER: Theme[] = ["light", "dark", "system"];

function apply(theme: Theme) {
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && systemDark);
  root.classList.toggle("dark", dark);
}

const ICONS: Record<Theme, React.ReactNode> = {
  light: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  ),
  dark: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  system: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  ),
};

const LABEL: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme | null) ?? "system";
    setTheme(stored);
    setMounted(true);

    // Keep "system" responsive to OS changes.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem("theme") as Theme | null ?? "system") === "system") {
        apply("system");
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
    localStorage.setItem("theme", next);
    apply(next);
  };

  // Avoid hydration mismatch: render a stable placeholder until mounted.
  if (!mounted) {
    return (
      <span
        aria-hidden
        className="ml-1 grid h-8 w-8 place-items-center rounded-full text-zinc-400"
      >
        {ICONS.system}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${LABEL[theme]} (click to change)`}
      aria-label={`Switch theme, currently ${LABEL[theme]}`}
      className="ml-1 grid h-8 w-8 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-100"
    >
      {ICONS[theme]}
    </button>
  );
}
