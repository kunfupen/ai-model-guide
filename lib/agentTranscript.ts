/**
 * A recorded ModelPilot run, replayed by `app/api/agent/route.ts` when
 * `AGENT_API_URL` is not configured — so the demo page still works on a deploy
 * without the Python backend attached.
 *
 * The tool results and figures here are real values from `content/models/*.mdx`
 * (Claude Sonnet 5 at $3/$15 per 1M ⇒ $225/month at 50M in + 5M out). The page
 * labels this run as recorded; it is never presented as live.
 */

export type RecordedStep = {
  event: "thought" | "tool_call" | "tool_result" | "recommendation" | "done";
  data: unknown;
  delayMs?: number;
};

export const RECORDED_QUESTION =
  "I need the cheapest model with at least 500K context that's good at coding and available on Bedrock. What would 50M input and 5M output tokens per month cost?";

export const RECORDED_RUN: RecordedStep[] = [
  {
    event: "thought",
    delayMs: 500,
    data: {
      text: "Three constraints to satisfy at once — context, coding strength, Bedrock availability — then a cost calculation. Filtering the catalog first.",
    },
  },
  {
    event: "tool_call",
    delayMs: 400,
    data: {
      name: "query_models",
      args: {
        min_context: 500000,
        strengths: ["coding"],
        availability: ["bedrock"],
        sort: "cheapest",
        limit: 5,
      },
    },
  },
  {
    event: "tool_result",
    delayMs: 700,
    data: {
      name: "query_models",
      is_error: false,
      preview: JSON.stringify({
        count: 5,
        results: [
          { slug: "anthropic-claude-sonnet-5", name: "Claude Sonnet 5", context_window: 1000000, input_per_1m: 3, output_per_1m: 15 },
          { slug: "anthropic-claude-4-8-opus", name: "Claude Opus 4.8", context_window: 1000000, input_per_1m: 5, output_per_1m: 25 },
          { slug: "anthropic-claude-opus-5", name: "Claude Opus 5", context_window: 1000000, input_per_1m: 5, output_per_1m: 25 },
          { slug: "anthropic-claude-fable-5", name: "Claude Fable 5", context_window: 1000000, input_per_1m: 10, output_per_1m: 50 },
        ],
      }),
    },
  },
  {
    event: "thought",
    delayMs: 500,
    data: { text: "Four candidates. Pricing them at the stated volume rather than eyeballing the per-token rates." },
  },
  {
    event: "tool_call",
    delayMs: 400,
    data: {
      name: "compare_costs",
      args: {
        slugs: ["anthropic-claude-sonnet-5", "anthropic-claude-opus-5", "anthropic-claude-fable-5"],
        input_tokens_per_month: 50000000,
        output_tokens_per_month: 5000000,
      },
    },
  },
  {
    event: "tool_result",
    delayMs: 650,
    data: {
      name: "compare_costs",
      is_error: false,
      preview: JSON.stringify({
        ranked: [
          { slug: "anthropic-claude-sonnet-5", name: "Claude Sonnet 5", input_cost_usd: 150, output_cost_usd: 75, monthly_cost_usd: 225 },
          { slug: "anthropic-claude-opus-5", name: "Claude Opus 5", input_cost_usd: 250, output_cost_usd: 125, monthly_cost_usd: 375 },
          { slug: "anthropic-claude-fable-5", name: "Claude Fable 5", input_cost_usd: 500, output_cost_usd: 250, monthly_cost_usd: 750 },
        ],
      }),
    },
  },
  {
    event: "tool_call",
    delayMs: 400,
    data: { name: "search_model_docs", args: { query: "Sonnet 5 coding agentic value", k: 3 } },
  },
  {
    event: "tool_result",
    delayMs: 600,
    data: {
      name: "search_model_docs",
      is_error: false,
      preview: JSON.stringify({
        count: 3,
        results: [
          {
            slug: "anthropic-claude-sonnet-5",
            heading: "When to reach for Claude Sonnet 5",
            snippet: "The best combination of speed and intelligence in the Sonnet tier; near-Opus quality on coding and agentic work at a materially lower price.",
          },
        ],
      }),
    },
  },
  {
    event: "recommendation",
    delayMs: 800,
    data: {
      answer:
        "Claude Sonnet 5 at $225/month. It's the cheapest model in the catalog that clears all three of your constraints — 1M context, coding listed as a strength, and available on Bedrock — and it lands within striking distance of the Opus tier on coding work. Stepping up to Claude Opus 5 costs $375/month for that last increment of capability.",
      picks: [
        {
          slug: "anthropic-claude-sonnet-5",
          name: "Claude Sonnet 5",
          why: "Cheapest option meeting all three constraints: 1M context, coding strength, Bedrock availability. $3/$15 per 1M tokens.",
          monthly_cost_usd: 225,
          caveats: ["The $3/$15 rate is the standard price; introductory pricing may differ."],
        },
        {
          slug: "anthropic-claude-opus-5",
          name: "Claude Opus 5",
          why: "Step up if the hardest agentic coding matters more than the $150/month difference.",
          monthly_cost_usd: 375,
          caveats: [],
        },
      ],
      assumptions: [
        "\"Good at coding\" read as the catalog's `coding` strength tag.",
        "Costs use published list prices and exclude prompt caching, which would reduce input spend substantially.",
      ],
      citations: [
        { kind: "catalog", ref: "anthropic-claude-sonnet-5", note: "pricing and context window" },
        { kind: "catalog", ref: "anthropic-claude-opus-5", note: "comparison tier" },
      ],
      confidence: "high",
    },
  },
  {
    event: "done",
    delayMs: 300,
    data: { budget: { steps_used: 4, tool_calls: 3, input_tokens: 18432, output_tokens: 1204 } },
  },
];
