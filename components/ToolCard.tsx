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
      className="surface-card group flex h-full flex-col p-6"
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          <span className={`chip-dot h-1.5 w-1.5 rounded-full ${cat.dot}`} aria-hidden />
          {cat.label}
        </span>
        <span
          aria-hidden
          className="pop-on-hover text-zinc-300 transition-all duration-300 ease-out group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:text-zinc-700 dark:group-hover:text-zinc-100"
        >
          →
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
