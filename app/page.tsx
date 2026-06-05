import { Suspense } from "react";
import Link from "next/link";
import { getAllModels } from "@/lib/content";
import { CatalogClient } from "@/components/CatalogClient";
import { CatalogSkeleton } from "@/components/CatalogSkeleton";
import { CountUp } from "@/components/CountUp";
import { Reveal } from "@/components/Reveal";
import { HeroBackdrop } from "@/components/HeroBackdrop";

type Stat =
  | { kind: "num"; value: number; suffix?: string; decimals?: number; label: string }
  | { kind: "text"; value: string; label: string };

export default async function Home() {
  const models = await getAllModels();
  const frontmatters = models.map((m) => m.frontmatter);

  const providerCount = new Set(frontmatters.map((m) => m.provider)).size;
  const newest = frontmatters
    .slice()
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))[0];
  const maxContext = Math.max(...frontmatters.map((m) => m.contextWindow));

  const stats: Stat[] = [
    { kind: "num", value: frontmatters.length, label: "Models tracked" },
    { kind: "num", value: providerCount, label: "Providers" },
    { kind: "num", value: maxContext / 1_000_000, suffix: "M", label: "Largest context" },
    { kind: "text", value: newest ? newest.name : "—", label: "Latest addition" },
  ];

  return (
    <main>
      <section className="relative overflow-hidden">
        <HeroBackdrop />
        <div className="mx-auto max-w-5xl px-6 pb-16 pt-24 sm:pt-28">
          <div className="max-w-3xl">
            <span className="animate-rise inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white/60 px-3 py-1 text-xs font-medium text-zinc-600 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Updated for {newest ? new Date(newest.releaseDate).getFullYear() : "2026"} — Claude Opus 4.8, GPT-5.5, Gemini 3.5
            </span>

            <h1 className="animate-rise mt-6 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
              <span className="text-gradient">The AI models,</span>
              <br />
              evaluated.
            </h1>

            <p className="animate-rise mt-7 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              Specs, availability, and distilled guidance for the models from OpenAI,
              Anthropic, Google, and beyond — written for the developers who actually
              have to pick one.
            </p>

            <div className="animate-rise mt-9 flex flex-wrap items-center gap-3">
              <a
                href="#catalog"
                className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-zinc-100 dark:text-zinc-900"
              >
                Browse the catalog
                <span aria-hidden>↓</span>
              </a>
              <Link
                href="/benchmarks"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:border-zinc-900 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-100"
              >
                Compare benchmarks
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>

          <dl className="animate-rise mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 sm:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-800">
            {stats.map((s) => (
              <div key={s.label} className="bg-white px-5 py-5 dark:bg-zinc-950">
                <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                  {s.label}
                </dt>
                <dd className="mt-1.5 truncate text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  {s.kind === "num" ? (
                    <CountUp
                      value={s.value}
                      suffix={s.suffix}
                      decimals={s.decimals ?? 0}
                    />
                  ) : (
                    s.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Reveal id="catalog" className="mx-auto block max-w-5xl scroll-mt-24 px-6 pb-24">
        <Suspense fallback={<CatalogSkeleton />}>
          <CatalogClient models={frontmatters} />
        </Suspense>
      </Reveal>
    </main>
  );
}
