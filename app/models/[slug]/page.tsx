import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllModelSlugs, getModelBySlug, getAllModels } from "@/lib/content";
import { SpecsTable } from "@/components/SpecsTable";
import { BenchmarksTable } from "@/components/BenchmarksTable";
import { ProviderChip } from "@/components/ProviderChip";
import { ProviderLogo } from "@/components/ProviderLogo";
import { TweetEmbed } from "@/components/TweetEmbed";
import { mdxComponents } from "@/components/MDXComponents";
import { modelCategory } from "@/lib/modelCategory";
import type { ModelFrontmatter } from "@/lib/schemas";

export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = await getAllModelSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    const { frontmatter } = await getModelBySlug(slug);
    return {
      title: frontmatter.name,
      description: `How to use ${frontmatter.name} effectively. Specs, availability, and curated guidance.`,
    };
  } catch {
    return { title: "Model not found" };
  }
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Rank other models by relevance: same provider, then shared strengths. */
function relatedModels(
  current: ModelFrontmatter,
  all: ModelFrontmatter[],
  limit = 3,
): ModelFrontmatter[] {
  return all
    .filter((m) => m.slug !== current.slug)
    .map((m) => {
      let score = 0;
      if (m.provider === current.provider) score += 3;
      score += m.strengths.filter((s) => current.strengths.includes(s)).length;
      score += m.modalities.filter((x) => current.modalities.includes(x)).length * 0.25;
      return { m, score };
    })
    .sort((a, b) => b.score - a.score || b.m.releaseDate.localeCompare(a.m.releaseDate))
    .slice(0, limit)
    .map((x) => x.m);
}

export default async function ModelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let model;
  try {
    model = await getModelBySlug(slug);
  } catch {
    notFound();
  }
  const { frontmatter, body } = model;
  const isPreview = /preview/i.test(frontmatter.name);
  const category = modelCategory(frontmatter);
  const allModels = await getAllModels();
  const related = relatedModels(
    frontmatter,
    allModels.map((m) => m.frontmatter),
  );

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/"
        className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← All models
      </Link>

      <header className="mt-10">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
            <ProviderLogo provider={frontmatter.provider} className="h-5 w-5" />
          </span>
          <ProviderChip provider={frontmatter.provider} size="md" />
          <span className="text-xs text-zinc-400 dark:text-zinc-600">·</span>
          <time
            dateTime={frontmatter.releaseDate}
            className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
          >
            Released {formatDate(frontmatter.releaseDate)}
          </time>
          {isPreview && (
            <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 ring-1 ring-inset ring-amber-500/20 dark:text-amber-400">
              Preview
            </span>
          )}
          {category && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${category.className}`}
            >
              {category.label}
            </span>
          )}
        </div>
        <h1 className="mt-5 text-5xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {frontmatter.name.replace(/\s*\(preview\)/i, "")}
        </h1>
        {frontmatter.strengths.length > 0 && (
          <p className="mt-4 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Best for {frontmatter.strengths.join(" · ")}.
          </p>
        )}
      </header>

      <section className="mt-12">
        <SpecsTable frontmatter={frontmatter} />
      </section>

      <BenchmarksTable benchmarks={frontmatter.benchmarks} />

      <article className="editorial mt-16">
        <MDXRemote source={body} components={mdxComponents} />
      </article>

      {frontmatter.tweetIds.length > 0 && (
        <section className="mt-20">
          <h2 className="border-b border-zinc-200 pb-3 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            From the team
          </h2>
          <div className="mt-6 space-y-4">
            {frontmatter.tweetIds.map((id) => (
              <TweetEmbed key={id} id={id} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-20">
        <h2 className="border-b border-zinc-200 pb-3 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Official resources
        </h2>
        <ul className="mt-4 space-y-2 text-sm">
          <li>
            <a
              href={frontmatter.officialDocs}
              target="_blank"
              rel="noreferrer"
              className="text-zinc-900 underline decoration-zinc-300 underline-offset-4 transition-colors hover:decoration-zinc-900 dark:text-zinc-100 dark:decoration-zinc-700 dark:hover:decoration-zinc-100"
            >
              {new URL(frontmatter.officialDocs).hostname.replace(/^www\./, "")}
            </a>
          </li>
        </ul>
      </section>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="border-b border-zinc-200 pb-3 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Related models
          </h2>
          <ul className="mt-6 space-y-3">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/models/${r.slug}`}
                  className="surface-card group flex items-center justify-between gap-4 p-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <ProviderChip provider={r.provider} />
                    </div>
                    <p className="mt-1.5 font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                      {r.name}
                    </p>
                    {r.strengths.length > 0 && (
                      <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
                        {r.strengths.slice(0, 3).join(" · ")}
                      </p>
                    )}
                  </div>
                  <span
                    aria-hidden
                    className="shrink-0 text-zinc-300 transition-all duration-300 ease-out group-hover:translate-x-0.5 group-hover:text-zinc-900 dark:text-zinc-700 dark:group-hover:text-zinc-100"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
