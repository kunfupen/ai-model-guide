import { Suspense } from "react";
import Link from "next/link";
import { getAllModels } from "@/lib/content";
import { CatalogClient } from "@/components/CatalogClient";

export default async function Home() {
  const models = await getAllModels();
  const frontmatters = models.map((m) => m.frontmatter);

  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <section className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          A curated catalog
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-zinc-900 sm:text-6xl dark:text-zinc-50">
          The AI models, evaluated.
        </h1>
        <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Specs, availability, and distilled guidance for the models from OpenAI,
          Anthropic, Google, and Meta — written for the developers who actually have
          to pick one.
        </p>
        <div className="mt-8">
          <Link
            href="/benchmarks"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:border-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-100"
          >
            Compare benchmarks
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      <div className="mt-20">
        <Suspense fallback={<div className="h-96" />}>
          <CatalogClient models={frontmatters} />
        </Suspense>
      </div>
    </main>
  );
}
