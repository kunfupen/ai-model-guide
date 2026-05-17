import type { ReactNode } from "react";
import type { ModelFrontmatter } from "@/lib/schemas";

const AVAILABILITY_LABELS: Record<string, string> = {
  api: "API",
  "claude-ai": "Claude.ai",
  chatgpt: "ChatGPT",
  "gemini-app": "Gemini app",
  bedrock: "AWS Bedrock",
  vertex: "Vertex AI",
  azure: "Azure",
  "open-weights": "Open weights",
};

function formatContext(tokens: number): string {
  return `${tokens.toLocaleString()} tokens`;
}

type Row = { label: string; value: ReactNode; mono?: boolean };

export function SpecsTable({ frontmatter }: { frontmatter: ModelFrontmatter }) {
  const rows: Row[] = [
    {
      label: "Context window",
      value: formatContext(frontmatter.contextWindow),
      mono: true,
    },
    {
      label: "Modalities",
      value: frontmatter.modalities.join(", "),
    },
    {
      label: "Availability",
      value: frontmatter.availability
        .map((a) => AVAILABILITY_LABELS[a] ?? a)
        .join(", "),
    },
    {
      label: "Strengths",
      value: frontmatter.strengths.length ? frontmatter.strengths.join(", ") : "—",
    },
  ];

  if (frontmatter.pricing) {
    rows.push({
      label: "Input price",
      value: `$${frontmatter.pricing.inputPer1M.toFixed(2)} / 1M tokens`,
      mono: true,
    });
    rows.push({
      label: "Output price",
      value: `$${frontmatter.pricing.outputPer1M.toFixed(2)} / 1M tokens`,
      mono: true,
    });
  }

  rows.push({
    label: "Docs",
    value: (
      <a
        href={frontmatter.officialDocs}
        target="_blank"
        rel="noreferrer"
        className="text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
      >
        {new URL(frontmatter.officialDocs).hostname.replace(/^www\./, "")}
      </a>
    ),
  });

  return (
    <dl className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {rows.map((r) => (
        <div
          key={r.label}
          className="grid grid-cols-[10rem_1fr] items-baseline gap-6 py-3"
        >
          <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
            {r.label}
          </dt>
          <dd
            className={`text-sm text-zinc-900 dark:text-zinc-100 ${
              r.mono ? "font-mono tabular-nums" : ""
            }`}
          >
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
