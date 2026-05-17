import { getAllModels } from "@/lib/content";
import { ModelCard } from "@/components/ModelCard";

export default async function Home() {
  const models = await getAllModels();

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
      </section>

      <section className="mt-20">
        <div className="flex items-baseline justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Models
          </h2>
          <p className="font-mono text-xs tabular-nums text-zinc-400 dark:text-zinc-600">
            {String(models.length).padStart(2, "0")} total
          </p>
        </div>

        <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {models.map(({ frontmatter }) => (
            <li key={frontmatter.slug}>
              <ModelCard frontmatter={frontmatter} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
