import { Suspense } from "react";
import type { Metadata } from "next";
import { getAllModels } from "@/lib/content";
import { CompareClient } from "@/components/CompareClient";

export const metadata: Metadata = {
  title: "Compare",
  description:
    "Put up to four AI models side by side — context window, pricing, modalities, availability, and benchmark scores.",
};

export default async function ComparePage() {
  const models = await getAllModels();

  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <section className="max-w-2xl">
        <p className="eyebrow-rule text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          Side by side
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-zinc-900 sm:text-6xl dark:text-zinc-50">
          Compare models.
        </h1>
        <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Pick up to four and see the specs that actually decide it — context, price,
          modalities, and every benchmark either model reports. Your selection lives in
          the URL, so a comparison is shareable.
        </p>
      </section>

      <div className="mt-16">
        <Suspense fallback={<div className="h-96" />}>
          <CompareClient models={models.map((m) => m.frontmatter)} />
        </Suspense>
      </div>
    </main>
  );
}
