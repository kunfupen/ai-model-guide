import Link from "next/link";
import type { ToolFrontmatter, ToolCategory, ToolPricing } from "@/lib/schemas";

const CATEGORY_META: Record<ToolCategory, { label: string; dot: string }> = {
  ide: { label: "IDE", dot: "bg-blue-500" },
  runner: { label: "Runner", dot: "bg-emerald-500" },
  "agent-cli": { label: "Agent CLI", dot: "bg-amber-500" },
  framework: { label: "Framework", dot: "bg-violet-500" },
  hosting: { label: "Hosting", dot: "bg-rose-500" },
};

const PRICING_LABEL: Record<ToolPricing, string> = {
  free: "Free",
  freemium: "Freemium",
  paid: "Paid",
  "open-source": "Open source",
};

export function ToolCard({ frontmatter }: { frontmatter: ToolFrontmatter }) {
  const cat = CATEGORY_META[frontmatter.category];
  return (
    <Link
      href={`/tools/${frontmatter.slug}`}
      className="group flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          <span className={`h-1.5 w-1.5 rounded-full ${cat.dot}`} aria-hidden />
          {cat.label}
        </span>
        <span className="text-xs text-zinc-400 transition-colors group-hover:text-zinc-700 dark:text-zinc-600 dark:group-hover:text-zinc-300">
          ↗
        </span>
      </div>

      <h3 className="mt-4 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {frontmatter.name}
      </h3>

      {frontmatter.strengths.length > 0 && (
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {frontmatter.strengths.slice(0, 3).join(" · ")}
        </p>
      )}

      <div className="mt-auto pt-6 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>{PRICING_LABEL[frontmatter.pricingModel]}</span>
        <span className="font-mono text-zinc-400 dark:text-zinc-600">
          {frontmatter.license}
        </span>
      </div>
    </Link>
  );
}
