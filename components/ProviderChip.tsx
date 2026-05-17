import type { Provider } from "@/lib/schemas";

const PROVIDER_META: Record<Provider, { label: string; dot: string }> = {
  openai: { label: "OpenAI", dot: "bg-emerald-500" },
  anthropic: { label: "Anthropic", dot: "bg-amber-500" },
  google: { label: "Google", dot: "bg-sky-500" },
  meta: { label: "Meta", dot: "bg-indigo-500" },
};

export function ProviderChip({
  provider,
  size = "sm",
}: {
  provider: Provider;
  size?: "sm" | "md";
}) {
  const meta = PROVIDER_META[provider];
  const dotSize = size === "md" ? "h-2 w-2" : "h-1.5 w-1.5";
  const textSize = size === "md" ? "text-sm" : "text-xs";
  return (
    <span
      className={`inline-flex items-center gap-2 font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 ${textSize}`}
    >
      <span className={`rounded-full ${dotSize} ${meta.dot}`} aria-hidden />
      {meta.label}
    </span>
  );
}
