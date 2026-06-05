import { getAllTools } from "@/lib/content";
import { ToolCard } from "@/components/ToolCard";

export const metadata = {
  title: "Tools",
  description:
    "The tools developers use to build with AI: IDEs, local runners, agent CLIs, and frameworks.",
};

export default async function ToolsPage() {
  const tools = await getAllTools();
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <section className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          The tooling layer
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-zinc-900 sm:text-6xl dark:text-zinc-50">
          The tools, not the models.
        </h1>
        <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          IDEs, local runners, and agent CLIs — the things developers actually open
          and type into. Models do the inference; these are what wraps them into a
          usable workflow.
        </p>
      </section>

      <section className="mt-20">
        <div className="flex items-baseline justify-between border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Tools
          </h2>
          <p className="font-mono text-xs tabular-nums text-zinc-400 dark:text-zinc-600">
            {pad(tools.length)} total
          </p>
        </div>
        <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tools.map(({ frontmatter }) => (
            <li key={frontmatter.slug}>
              <ToolCard frontmatter={frontmatter} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
