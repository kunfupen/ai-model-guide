import type { ReactNode } from "react";
import type { ModelFrontmatter } from "@/lib/schemas";

type Row = { label: string; value: ReactNode };

export function SpecsTable({ frontmatter }: { frontmatter: ModelFrontmatter }) {
  const rows: Row[] = [
    { label: "Provider", value: frontmatter.provider },
    {
      label: "Context window",
      value: `${frontmatter.contextWindow.toLocaleString()} tokens`,
    },
    { label: "Modalities", value: frontmatter.modalities.join(", ") },
    { label: "Availability", value: frontmatter.availability.join(", ") },
    {
      label: "Strengths",
      value: frontmatter.strengths.length ? frontmatter.strengths.join(", ") : "—",
    },
  ];

  if (frontmatter.pricing) {
    rows.push({
      label: "Input price",
      value: `$${frontmatter.pricing.inputPer1M}/M tokens`,
    });
    rows.push({
      label: "Output price",
      value: `$${frontmatter.pricing.outputPer1M}/M tokens`,
    });
  }

  rows.push({
    label: "Docs",
    value: (
      <a
        href={frontmatter.officialDocs}
        target="_blank"
        rel="noreferrer"
        className="text-blue-600 underline underline-offset-2 hover:text-blue-700 dark:text-blue-400"
      >
        {frontmatter.officialDocs}
      </a>
    ),
  });

  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <dt className="text-sm font-medium text-zinc-500">{r.label}</dt>
          <dd className="text-sm text-zinc-900 dark:text-zinc-100">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
