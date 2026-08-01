import type { Metadata } from "next";
import { AgentDemo } from "@/components/AgentDemo";
import { getAllModels } from "@/lib/content";

export const metadata: Metadata = {
  title: "Agent",
  description:
    "ModelPilot — a ReAct agent that recommends models from this catalog, with every pick grounded in the underlying data.",
};

const CAPABILITIES = [
  {
    title: "Tool calling",
    body: "Seven typed tools — catalog filters, full-text search, cost math, a sandboxed calculator, web search and fetch. Arguments are Pydantic-validated before any code runs.",
  },
  {
    title: "Agent loop",
    body: "A LangGraph StateGraph cycles agent → tools → agent until the model stops calling tools or hits its step budget, then routes to a finalize node.",
  },
  {
    title: "State",
    body: "A SQLite checkpointer keyed by thread id, so follow-up questions keep the constraints from earlier turns.",
  },
  {
    title: "Errors & retries",
    body: "Failures are classified retryable or fatal. Retryable ones back off with jitter; a circuit breaker disables a dead dependency; every failure returns to the model as structured JSON instead of crashing the run.",
  },
  {
    title: "Structured output",
    body: "The final answer is a validated Pydantic object. Every recommended slug is checked against the database — an invented model triggers one repair round, then gets stripped.",
  },
  {
    title: "Data",
    body: "The catalog on this site is compiled into SQLite with an FTS5 index. Prices and specs come from there, never from the model's memory.",
  },
];

export default async function AgentPage() {
  const models = await getAllModels();

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <section className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          ModelPilot
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight text-zinc-900 sm:text-6xl dark:text-zinc-50">
          Ask, don&apos;t browse.
        </h1>
        <p className="mt-6 text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          A single-agent system that answers model-selection questions against these{" "}
          {models.length} models. It plans, calls tools, does the cost arithmetic in Python rather
          than in the model, and returns a structured recommendation you can click straight into.
        </p>
        <p className="mt-4 text-sm leading-6 text-zinc-500 dark:text-zinc-500">
          The trace below is the real thing — every tool call and result the agent made, in order.
        </p>
      </section>

      <div className="mt-12">
        <AgentDemo />
      </div>

      <section className="mt-20 border-t border-zinc-200 pt-10 dark:border-zinc-800">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          How it works
        </h2>
        <dl className="mt-8 grid gap-6 sm:grid-cols-2">
          {CAPABILITIES.map((item) => (
            <div key={item.title}>
              <dt className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</dt>
              <dd className="mt-1.5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {item.body}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-10 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
          Source lives in{" "}
          <a
            href="https://github.com/kunfupen/ai-model-guide/tree/main/agent"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-500 dark:text-zinc-100 dark:decoration-zinc-700"
          >
            <code className="font-mono">agent/</code>
          </a>{" "}
          — Python, LangGraph, FastAPI, with a golden-question eval suite.
        </p>
      </section>
    </main>
  );
}
