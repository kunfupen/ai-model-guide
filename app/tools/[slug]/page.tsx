import { notFound } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllToolSlugs, getToolBySlug } from "@/lib/content";
import type { ToolFrontmatter } from "@/lib/schemas";
import { mdxComponents } from "@/components/MDXComponents";

export const dynamicParams = false;

const CATEGORY_LABEL: Record<ToolFrontmatter["category"], string> = {
  ide: "IDE",
  runner: "Runner",
  "agent-cli": "Agent CLI",
  framework: "Framework",
  hosting: "Hosting",
};

const PRICING_LABEL: Record<ToolFrontmatter["pricingModel"], string> = {
  free: "Free",
  freemium: "Freemium",
  paid: "Paid",
  "open-source": "Open source",
};

const PLATFORM_LABEL: Record<ToolFrontmatter["platforms"][number], string> = {
  mac: "macOS",
  linux: "Linux",
  windows: "Windows",
  web: "Web",
  ios: "iOS",
  android: "Android",
  "vscode-extension": "VS Code",
  "jetbrains-plugin": "JetBrains",
  terminal: "Terminal",
};

export async function generateStaticParams() {
  const slugs = await getAllToolSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    const { frontmatter } = await getToolBySlug(slug);
    return {
      title: frontmatter.name,
      description: `${frontmatter.name}: purpose, features, and how it fits into an AI development workflow.`,
    };
  } catch {
    return { title: "Tool not found" };
  }
}

function ToolSpecs({ frontmatter }: { frontmatter: ToolFrontmatter }) {
  const rows: { label: string; value: ReactNode; mono?: boolean }[] = [
    { label: "Category", value: CATEGORY_LABEL[frontmatter.category] },
    { label: "License", value: frontmatter.license, mono: true },
    { label: "Pricing", value: PRICING_LABEL[frontmatter.pricingModel] },
    {
      label: "Platforms",
      value: frontmatter.platforms.map((p) => PLATFORM_LABEL[p]).join(", "),
    },
  ];

  if (frontmatter.supportedModels.length > 0) {
    rows.push({
      label: "Supports",
      value: frontmatter.supportedModels.join(", "),
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

  if (frontmatter.repository) {
    rows.push({
      label: "Repository",
      value: (
        <a
          href={frontmatter.repository}
          target="_blank"
          rel="noreferrer"
          className="text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
        >
          {new URL(frontmatter.repository).pathname.replace(/^\//, "")}
        </a>
      ),
    });
  }

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

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let tool;
  try {
    tool = await getToolBySlug(slug);
  } catch {
    notFound();
  }
  const { frontmatter, body } = tool;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/tools"
        className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← All tools
      </Link>

      <header className="mt-10">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {CATEGORY_LABEL[frontmatter.category]}
        </p>
        <h1 className="mt-3 text-5xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {frontmatter.name}
        </h1>
        {frontmatter.strengths.length > 0 && (
          <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            {frontmatter.strengths.join(" · ")}
          </p>
        )}
      </header>

      <section className="mt-12">
        <ToolSpecs frontmatter={frontmatter} />
      </section>

      <article className="editorial mt-16">
        <MDXRemote source={body} components={mdxComponents} />
      </article>
    </main>
  );
}
