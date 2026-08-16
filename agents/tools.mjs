// Tools available to the research agent.
//
// Two kinds:
//   · SERVER tools — declared to the API, executed by Anthropic (web_search).
//     We never see or handle the call; results come back in the transcript.
//   · CLIENT tools — executed here, in this process, against the real repo.
//
// Every client tool is READ-ONLY except `submit_model_spec`, which only returns
// the spec to the caller. The agent cannot write to disk, run commands, or reach
// the network except through web_search. That containment is deliberate: an
// autonomous loop should not be able to modify the catalog directly.

import { promises as fs } from "node:fs";
import path from "node:path";
import { readCatalog, MODELS_DIR } from "../scripts/lib/catalog.mjs";
import { validateSpec, loadSchemaEnums } from "../scripts/lib/validate-spec.mjs";

/** Anthropic's server-side search. max_uses caps cost and stops runaway loops. */
export const serverTools = (maxSearches = 12) => [
  { type: "web_search_20250305", name: "web_search", max_uses: maxSearches },
];

export const clientTools = [
  {
    name: "list_catalog",
    description:
      "List every model already in the catalog with its slug, name, provider and release date. " +
      "Call this FIRST to check whether the model you are researching is already covered, and to see naming conventions.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "read_model_page",
    description:
      "Read the full source of an existing model page (frontmatter + prose). Use it as a style and structure reference " +
      "before drafting a new one. Pass a slug from list_catalog.",
    input_schema: {
      type: "object",
      properties: { slug: { type: "string", description: "Catalog slug, e.g. anthropic-claude-opus-5" } },
      required: ["slug"],
    },
  },
  {
    name: "get_schema",
    description:
      "Return the allowed enum values for provider, modalities and availability. Your spec MUST use only these values.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "validate_spec",
    description:
      "Check a draft spec against the catalog's schema and house rules WITHOUT writing anything. " +
      "Returns errors you must fix. Call this repeatedly until it passes, then call submit_model_spec. " +
      "Note: a benchmark with no source, or one citing the benchmark's own definition paper, is rejected — omit the benchmark instead.",
    input_schema: {
      type: "object",
      properties: { spec: { type: "object", description: "The draft model spec object" } },
      required: ["spec"],
    },
  },
  {
    name: "submit_model_spec",
    description:
      "Submit the FINAL validated spec. Call this only after validate_spec reports ok. This ends the task.",
    input_schema: {
      type: "object",
      properties: {
        spec: { type: "object", description: "The validated model spec" },
        confidence: {
          type: "string",
          enum: ["high", "medium", "low"],
          description: "How confident you are that this is a real, correctly-specified release",
        },
        sources: {
          type: "array",
          items: { type: "string" },
          description: "URLs that substantiate the specs you filled in",
        },
        uncertainties: {
          type: "array",
          items: { type: "string" },
          description: "Anything you could NOT verify, for a human reviewer. Be candid — this is not penalised.",
        },
      },
      required: ["spec", "confidence", "sources"],
    },
  },
  {
    name: "abandon",
    description:
      "Stop and report that this candidate should NOT be added — e.g. it is an alias, a retired model, a config " +
      "variant, an unannounced rumour, or you cannot find official confirmation. Abandoning is a valid, correct outcome.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string" } },
      required: ["reason"],
    },
  },
];

/** Execute a client tool. Returns {content, terminal, payload}. */
export async function runClientTool(name, input) {
  switch (name) {
    case "list_catalog": {
      const catalog = await readCatalog();
      // gray-matter parses unquoted YAML dates into Date objects; normalise back
      // to YYYY-MM-DD so the agent sees the same shape it must produce.
      const asDate = (v) =>
        v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "").slice(0, 10);
      const rows = catalog.map((m) => ({
        slug: m.slug,
        name: m.frontmatter?.name,
        provider: m.frontmatter?.provider,
        releaseDate: asDate(m.frontmatter?.releaseDate),
      }));
      return { content: JSON.stringify({ count: rows.length, models: rows }, null, 2) };
    }

    case "read_model_page": {
      const slug = String(input?.slug ?? "").replace(/[^a-z0-9-]/gi, "");
      if (!slug) return { content: "Error: slug is required." };
      try {
        const src = await fs.readFile(path.join(MODELS_DIR, `${slug}.mdx`), "utf8");
        // Cap the size so one reference page can't eat the context window.
        return { content: src.length > 8000 ? src.slice(0, 8000) + "\n…(truncated)" : src };
      } catch {
        return { content: `Error: no model page for slug "${slug}". Use list_catalog to see valid slugs.` };
      }
    }

    case "get_schema": {
      const enums = await loadSchemaEnums();
      return { content: JSON.stringify(enums, null, 2) };
    }

    case "validate_spec": {
      const result = await validateSpec(input?.spec ?? {});
      return { content: JSON.stringify(result, null, 2) };
    }

    case "submit_model_spec": {
      // Re-validate server-side: never trust that the agent actually called
      // validate_spec, or that it submitted the same object it validated.
      const result = await validateSpec(input?.spec ?? {});
      if (!result.ok) {
        return {
          content: JSON.stringify(
            { accepted: false, message: "Rejected — spec does not validate. Fix these and resubmit.", ...result },
            null,
            2,
          ),
        };
      }
      return {
        content: JSON.stringify({ accepted: true, warnings: result.warnings }, null, 2),
        terminal: true,
        payload: {
          outcome: "submitted",
          spec: input.spec,
          confidence: input.confidence,
          sources: input.sources ?? [],
          uncertainties: input.uncertainties ?? [],
        },
      };
    }

    case "abandon":
      return {
        content: JSON.stringify({ acknowledged: true }),
        terminal: true,
        payload: { outcome: "abandoned", reason: input?.reason ?? "(no reason given)" },
      };

    default:
      return { content: `Error: unknown tool "${name}".` };
  }
}

export const CLIENT_TOOL_NAMES = new Set(clientTools.map((t) => t.name));
