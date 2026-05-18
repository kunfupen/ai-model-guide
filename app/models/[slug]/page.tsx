import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllModelSlugs, getModelBySlug } from "@/lib/content";
import { SpecsTable } from "@/components/SpecsTable";
import { BenchmarksTable } from "@/components/BenchmarksTable";
import { ProviderChip } from "@/components/ProviderChip";
import { TweetEmbed } from "@/components/TweetEmbed";
import { mdxComponents } from "@/components/MDXComponents";

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
      title: `${frontmatter.name} — AI Model Guide`,
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

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/"
        className="text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← All models
      </Link>

      <header className="mt-10">
        <div className="flex items-center gap-4">
          <ProviderChip provider={frontmatter.provider} size="md" />
          <span className="text-xs text-zinc-400 dark:text-zinc-600">·</span>
          <time
            dateTime={frontmatter.releaseDate}
            className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
          >
            Released {formatDate(frontmatter.releaseDate)}
          </time>
        </div>
        <h1 className="mt-5 text-5xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {frontmatter.name}
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
    </main>
  );
}
