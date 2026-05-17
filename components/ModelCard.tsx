import Link from "next/link";
import type { ModelFrontmatter } from "@/lib/schemas";
import { ProviderChip } from "./ProviderChip";

function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
  return `${tokens}`;
}

export function ModelCard({ frontmatter }: { frontmatter: ModelFrontmatter }) {
  const ctx = formatContext(frontmatter.contextWindow);
  return (
    <Link
      href={`/models/${frontmatter.slug}`}
      className="group flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
    >
      <div className="flex items-center justify-between">
        <ProviderChip provider={frontmatter.provider} />
        <span className="text-xs text-zinc-400 transition-colors group-hover:text-zinc-700 dark:text-zinc-600 dark:group-hover:text-zinc-300">
          ↗
        </span>
      </div>

      <h3 className="mt-4 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {frontmatter.name}
      </h3>

      {frontmatter.strengths.length > 0 && (
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Best for {frontmatter.strengths.slice(0, 3).join(" · ")}.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-mono tabular-nums">{ctx} ctx</span>
        <span aria-hidden className="text-zinc-300 dark:text-zinc-700">·</span>
        <span>{frontmatter.modalities.join(" · ")}</span>
      </div>

      <div className="mt-auto pt-6">
        {frontmatter.pricing ? (
          <p className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            <span className="text-zinc-900 dark:text-zinc-100">
              ${frontmatter.pricing.inputPer1M}
            </span>
            <span className="text-zinc-400 dark:text-zinc-600"> in </span>
            <span className="text-zinc-900 dark:text-zinc-100">
              ${frontmatter.pricing.outputPer1M}
            </span>
            <span className="text-zinc-400 dark:text-zinc-600"> out </span>
            <span className="text-zinc-400 dark:text-zinc-600">/ 1M tokens</span>
          </p>
        ) : (
          <p className="text-xs text-zinc-400 dark:text-zinc-600">Pricing varies</p>
        )}
      </div>
    </Link>
  );
}
