"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";

type ToolCall = { kind: "tool_call"; name: string; args: Record<string, unknown> };
type ToolResult = { kind: "tool_result"; name: string; preview: string; isError: boolean };
type Thought = { kind: "thought"; text: string };
type Step = ToolCall | ToolResult | Thought;

type Pick = {
  slug: string;
  name: string;
  why: string;
  monthly_cost_usd: number | null;
  caveats: string[];
};

type Recommendation = {
  answer: string;
  picks: Pick[];
  assumptions: string[];
  citations: { kind: "catalog" | "web"; ref: string; note?: string | null }[];
  confidence: "high" | "medium" | "low";
};

type Budget = { steps_used: number; tool_calls: number; input_tokens: number; output_tokens: number };

const EXAMPLES = [
  "Cheapest model with at least 500K context that's good at coding and on Bedrock — and what does 50M in / 5M out per month cost?",
  "I can only use models with open weights. What are my options?",
  "Which model scores highest on SWE-bench Verified?",
  "Should I use GPT-6 Turbo for my coding agent?",
];

const CONFIDENCE_STYLES: Record<Recommendation["confidence"], string> = {
  high: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400",
  low: "bg-zinc-500/10 text-zinc-600 ring-zinc-500/20 dark:text-zinc-400",
};

function formatUsd(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Minimal SSE parser: splits on blank lines, reads `event:` and `data:`. */
function parseSseChunk(buffer: string): { events: { event: string; data: string }[]; rest: string } {
  const events: { event: string; data: string }[] = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";

  for (const part of parts) {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of part.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length) events.push({ event, data: dataLines.join("\n") });
  }
  return { events, rest };
}

function StepRow({ step }: { step: Step }) {
  if (step.kind === "thought") {
    return (
      <p className="border-l-2 border-zinc-200 py-1 pl-4 text-sm italic leading-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        {step.text}
      </p>
    );
  }

  if (step.kind === "tool_call") {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <span className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white dark:bg-zinc-100 dark:text-zinc-900">
            call
          </span>
          <span className="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {step.name}
          </span>
        </div>
        <pre className="mt-2 overflow-x-auto text-xs leading-5 text-zinc-600 dark:text-zinc-400">
          {JSON.stringify(step.args, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border p-3 ${
        step.isError
          ? "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30"
          : "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-white ${
            step.isError ? "bg-red-600" : "bg-emerald-600"
          }`}
        >
          {step.isError ? "error" : "result"}
        </span>
        <span className="font-mono text-sm text-zinc-700 dark:text-zinc-300">{step.name}</span>
      </div>
      <pre className="mt-2 max-h-40 overflow-auto text-xs leading-5 text-zinc-600 dark:text-zinc-400">
        {step.preview}
      </pre>
    </div>
  );
}

export function AgentDemo() {
  const [question, setQuestion] = useState(EXAMPLES[0]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [isRecorded, setIsRecorded] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    if (running || question.trim().length < 3) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRunning(true);
    setSteps([]);
    setRecommendation(null);
    setBudget(null);
    setIsRecorded(false);
    setError(null);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({ error: "The agent is unavailable." }));
        setError(payload.error ?? "The agent is unavailable.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const { events, rest } = parseSseChunk(buffer);
        buffer = rest;

        for (const { event, data } of events) {
          let payload: Record<string, never>;
          try {
            payload = JSON.parse(data);
          } catch {
            continue;
          }

          if (event === "start") {
            setIsRecorded(Boolean((payload as { recorded?: boolean }).recorded));
          } else if (event === "thought") {
            const { text } = payload as unknown as { text: string };
            setSteps((prev) => [...prev, { kind: "thought", text }]);
          } else if (event === "tool_call") {
            const { name, args } = payload as unknown as { name: string; args: Record<string, unknown> };
            setSteps((prev) => [...prev, { kind: "tool_call", name, args }]);
          } else if (event === "tool_result") {
            const { name, preview, is_error } = payload as unknown as {
              name: string;
              preview: string;
              is_error: boolean;
            };
            setSteps((prev) => [...prev, { kind: "tool_result", name, preview, isError: is_error }]);
          } else if (event === "recommendation") {
            setRecommendation(payload as unknown as Recommendation);
          } else if (event === "done") {
            setBudget((payload as unknown as { budget: Budget }).budget);
          } else if (event === "error") {
            setError((payload as unknown as { error: string }).error);
          }
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError("Lost connection to the agent.");
      }
    } finally {
      setRunning(false);
    }
  }, [question, running]);

  return (
    <div className="space-y-6">
      <div className="surface-card p-5">
        <label htmlFor="agent-question" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Ask about picking a model
        </label>
        <textarea
          id="agent-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void run();
          }}
          rows={3}
          maxLength={1000}
          className="mt-3 w-full resize-y rounded-lg border border-zinc-200 bg-white p-3 text-sm leading-6 text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-600"
          placeholder="e.g. cheapest model with 1M context available on Vertex"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void run()}
            disabled={running || question.trim().length < 3}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {running ? "Thinking…" : "Ask the agent"}
          </button>
          <span className="text-xs text-zinc-400 dark:text-zinc-600">⌘↵ to run</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setQuestion(example)}
              disabled={running}
              className="rounded-full border border-zinc-200 px-3 py-1 text-left text-xs text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
            >
              {example.length > 62 ? `${example.slice(0, 62)}…` : example}
            </button>
          ))}
        </div>
      </div>

      {isRecorded && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          <strong>Recorded run.</strong>{" "}
          The Python backend isn&apos;t connected to this deployment, so
          this is a replay of a previous run against the same catalog — not a live answer to your
          question. Run it live with <code className="font-mono">uv run modelpilot ask</code>.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}

      {steps.length > 0 && (
        <section>
          <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            Trace
          </h2>
          <div className="mt-3 space-y-2">
            {steps.map((step, i) => (
              <StepRow key={i} step={step} />
            ))}
            {running && (
              <p className="animate-pulse text-sm text-zinc-400 dark:text-zinc-600">working…</p>
            )}
          </div>
        </section>
      )}

      {recommendation && (
        <section className="surface-card p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              Recommendation
            </h2>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${CONFIDENCE_STYLES[recommendation.confidence]}`}
            >
              {recommendation.confidence} confidence
            </span>
          </div>

          <p className="mt-4 text-base leading-7 text-zinc-800 dark:text-zinc-200">
            {recommendation.answer}
          </p>

          <div className="mt-6 space-y-3">
            {recommendation.picks.map((pick, i) => (
              <Link
                key={pick.slug}
                href={`/models/${pick.slug}`}
                className="group block rounded-lg border border-zinc-200 p-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                    <span className="mr-2 text-zinc-400 dark:text-zinc-600">{i + 1}</span>
                    {pick.name}
                  </span>
                  {pick.monthly_cost_usd !== null && (
                    <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                      {formatUsd(pick.monthly_cost_usd)}
                      <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">/mo</span>
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{pick.why}</p>
                {pick.caveats.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {pick.caveats.map((caveat) => (
                      <li key={caveat} className="text-xs leading-5 text-amber-700 dark:text-amber-400">
                        ⚠ {caveat}
                      </li>
                    ))}
                  </ul>
                )}
                <span className="mt-2 inline-block font-mono text-[11px] text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-600 dark:group-hover:text-zinc-400">
                  {pick.slug} →
                </span>
              </Link>
            ))}
          </div>

          {recommendation.assumptions.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                Assumptions
              </h3>
              <ul className="mt-2 space-y-1">
                {recommendation.assumptions.map((assumption) => (
                  <li key={assumption} className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    • {assumption}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recommendation.citations.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                Sources
              </h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {recommendation.citations.map((citation) => (
                  <li key={`${citation.kind}-${citation.ref}`}>
                    {citation.kind === "catalog" ? (
                      <Link
                        href={`/models/${citation.ref}`}
                        className="rounded-full border border-zinc-200 px-2.5 py-1 font-mono text-[11px] text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                      >
                        {citation.ref}
                      </Link>
                    ) : (
                      <a
                        href={citation.ref}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                      >
                        web ↗
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {budget && (
            <p className="mt-6 border-t border-zinc-200 pt-4 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-600">
              {budget.steps_used} steps · {budget.tool_calls} tool calls ·{" "}
              {budget.input_tokens.toLocaleString()} in / {budget.output_tokens.toLocaleString()} out
              tokens
            </p>
          )}
        </section>
      )}
    </div>
  );
}
