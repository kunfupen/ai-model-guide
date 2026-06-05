import Link from "next/link";
import type { ModelFrontmatter } from "@/lib/schemas";
import { ProviderChip } from "./ProviderChip";

function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
  return `${tokens}`;
}

function formatReleased(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1));
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

// "New" if released within the last ~75 days. Pure date math, no client clock
// needed at render — evaluated when the page is built/requested.
function isRecent(iso: string, days = 75): boolean {
  const released = Date.parse(iso);
  if (Number.isNaN(released)) return false;
  return Date.now() - released <= days * 86_400_000;
}

export function ModelCard({ frontmatter }: { frontmatter: ModelFrontmatter }) {
  const ctx = formatContext(frontmatter.contextWindow);
  const isPreview = /preview/i.test(frontmatter.name);
  const isNew = !isPreview && isRecent(frontmatter.releaseDate);
  const headline = frontmatter.benchmarks
    .slice()
    .sort((a, b) => b.score / (b.max ?? 100) - a.score / (a.max ?? 100))[0];

  return (
    <Link
      href={`/models/${frontmatter.slug}`}
      className="surface-card group flex h-full flex-col p-6"
    >
      <div className="flex items-center justify-between">
        <ProviderChip provider={frontmatter.provider} />
        <span className="text-xs font-medium tabular-nums text-zinc-400 dark:text-zinc-600">
          {formatReleased(frontmatter.releaseDate)}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <h3 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {frontmatter.name.replace(/\s*\(preview\)/i, "")}
        </h3>
        {isNew && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            New
          </span>
        )}
        {isPreview && (
          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400">
            Preview
          </span>
        )}
      </div>

      {frontmatter.strengths.length > 0 && (
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Best for {frontmatter.strengths.slice(0, 3).join(" · ")}.
        </p>
      )}

      {headline && (
        <div className="mt-5">
          <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            <span>{headline.name}</span>
            <span className="font-mono tabular-nums text-zinc-600 dark:text-zinc-300">
              {headline.score}
              <span className="text-zinc-400 dark:text-zinc-600">/{headline.max ?? 100}</span>
            </span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
            <div
              className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
              style={{ width: `${Math.min(100, (headline.score / (headline.max ?? 100)) * 100)}%` }}
              aria-hidden
            />
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-mono tabular-nums">{ctx} ctx</span>
        <span aria-hidden className="text-zinc-300 dark:text-zinc-700">·</span>
        <span>{frontmatter.modalities.join(" · ")}</span>
      </div>

      <div className="mt-auto flex items-end justify-between pt-6">
        {frontmatter.pricing ? (
          <p className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            <span className="text-zinc-900 dark:text-zinc-100">
              ${frontmatter.pricing.inputPer1M}
            </span>
            <span className="text-zinc-400 dark:text-zinc-600"> in </span>
            <span className="text-zinc-900 dark:text-zinc-100">
              ${frontmatter.pricing.outputPer1M}
            </span>
            <span className="text-zinc-400 dark:text-zinc-600"> out / 1M</span>
          </p>
        ) : (
          <p className="text-xs text-zinc-400 dark:text-zinc-600">Pricing varies</p>
        )}
        <span
          aria-hidden
          className="text-zinc-300 transition-all duration-300 ease-out group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:text-zinc-700 dark:group-hover:text-zinc-100"
        >
          →
        </span>
      </div>
    </Link>
  );
}
