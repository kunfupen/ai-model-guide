import { notFound } from "next/navigation";
import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getAllModelSlugs, getModelBySlug } from "@/lib/content";
import { SpecsTable } from "@/components/SpecsTable";
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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/"
        className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        ← All models
      </Link>
      <header className="mt-6 mb-8">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          {frontmatter.provider}
        </p>
        <h1 className="mt-1 text-4xl font-bold tracking-tight">
          {frontmatter.name}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Released {frontmatter.releaseDate}
        </p>
      </header>
      <SpecsTable frontmatter={frontmatter} />
      <article className="mt-10">
        <MDXRemote source={body} components={mdxComponents} />
      </article>
    </main>
  );
}
