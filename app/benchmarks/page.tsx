import type { Metadata } from "next";
import { getAllModels } from "@/lib/content";
import { BenchmarksComparison } from "@/components/BenchmarksComparison";

export const metadata: Metadata = {
  title: "Benchmarks — AI Model Guide",
  description:
    "How every model in the catalog scores on each task, ranked side by side with the leader highlighted.",
};

export default async function BenchmarksPage() {
  const models = await getAllModels();
  const frontmatters = models.map((m) => m.frontmatter);

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <section className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          Head to head
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-zinc-900 sm:text-6xl dark:text-zinc-50">
          Benchmarks, compared.
        </h1>
        <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          How every model in the catalog performs on each task — ranked, shown as a
          percentage of the maximum score, with the top model on each benchmark marked
          <span className="font-medium text-zinc-900 dark:text-zinc-100"> ★ Best</span>.
        </p>
      </section>

      <div className="mt-16">
        <BenchmarksComparison models={frontmatters} />
      </div>

      <p className="mt-16 border-t border-zinc-200 pt-6 text-xs leading-6 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        Scores are indicative and collected from each provider&apos;s published figures
        and common public leaderboards; methodologies differ between models, so treat
        these as a directional guide rather than a controlled head-to-head. Always
        validate on your own tasks. Click any model to see its full card.
      </p>
    </main>
  );
}
