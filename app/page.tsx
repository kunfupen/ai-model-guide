import Link from "next/link";
import { getAllModels } from "@/lib/content";

export default async function Home() {
  const models = await getAllModels();

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight">AI Model Guide</h1>
        <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
          A curated catalog of popular AI models — specs, availability, and distilled
          guidance from the people who build them.
        </p>
      </header>

      <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        Models
      </h2>
      <ul className="mt-4 space-y-3">
        {models.map(({ frontmatter }) => (
          <li key={frontmatter.slug}>
            <Link
              href={`/models/${frontmatter.slug}`}
              className="block rounded-lg border border-zinc-200 p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {frontmatter.provider}
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight">
                {frontmatter.name}
              </h3>
              <p className="mt-1 text-sm text-zinc-500">
                {frontmatter.contextWindow.toLocaleString()} ctx ·{" "}
                {frontmatter.modalities.join(", ")} · {frontmatter.strengths.join(", ")}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
