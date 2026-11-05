import type { Metadata } from "next";
import { getAllModels } from "@/lib/content";
import { BenchmarksComparison } from "@/components/BenchmarksComparison";

export const metadata: Metadata = {
  title: "Benchmarks",
  description:
    "How every model in the catalog scores on each task, ranked side by side with the leader highlighted.",
};

export default async function BenchmarksPage() {
  const models = await getAllModels();
  const frontmatters = models.map((m) => m.frontmatter);

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <section className="max-w-2xl">
        <p className="eyebrow-rule text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          Head to head
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-zinc-900 sm:text-6xl dark:text-zinc-50">
          Benchmarks, compared.
        </h1>
        <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          How every current model performs on each task — ranked, shown as a
          percentage of the maximum score, with the top model on each benchmark marked
          <span className="font-medium text-zinc-900 dark:text-zinc-100"> ★ Best</span>.
          Each score says who measured it: the lab itself, or an independent tester.
        </p>
      </section>

      <div className="mt-16">
        <BenchmarksComparison models={frontmatters} />
      </div>

      <p className="mt-16 border-t border-zinc-200 pt-6 text-xs leading-6 text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        Scores are collected from each provider&apos;s published figures and common
        public leaderboards; methodologies differ between models, so treat these as a
        directional guide rather than a controlled head-to-head.{" "}
        <span className="font-medium text-zinc-500 dark:text-zinc-400">Self-reported</span>{" "}
        scores come from the model&apos;s own lab — often at maximum effort, on its own
        harness.{" "}
        <span className="font-medium text-zinc-500 dark:text-zinc-400">Independent</span>{" "}
        scores were run by a third party such as Vals AI or Artificial Analysis. Scores
        with neither tag come from aggregators whose original source isn&apos;t clear. When
        a lab&apos;s number and an independent one disagree, trust the independent one.{" "}
        <span className="font-medium text-zinc-500 dark:text-zinc-400">Legacy</span> models
        — superseded by a newer model from the same lab — are left out of the rankings
        and never marked ★ Best, but can be shown in each section. Entries tagged{" "}
        <span className="font-medium text-zinc-500 dark:text-zinc-400">Unverified</span>{" "}
        are illustrative placeholders that have not yet been traced to an official or
        corroborated source — they are shown for completeness, rendered in a lighter
        bar, and are never eligible for ★ Best. Benchmark sections marked Legacy are
        saturated: frontier models cluster too tightly on them to separate, so they rank
        last and are kept only for historical context. The{" "}
        <span className="font-medium text-zinc-500 dark:text-zinc-400">First-party</span>{" "}
        suite is one we run ourselves; see{" "}
        <a
          href="https://github.com/kunfupen/ai-model-guide/tree/main/evals"
          className="underline decoration-zinc-300 underline-offset-4 dark:decoration-zinc-700"
        >
          evals/README
        </a>{" "}
        for its methodology and limits. Always validate on your own tasks.
      </p>
    </main>
  );
}
