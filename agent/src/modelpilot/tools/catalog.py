"""Catalog tools: structured filtering and single-record lookup."""

from __future__ import annotations

import json

from .. import db
from ..retry import as_tool_error
from ..schemas import GetModelArgs, QueryModelsArgs


def query_models(**kwargs) -> str:
    """Search the model catalog with structured filters."""
    try:
        args = QueryModelsArgs.model_validate(kwargs)
        records = db.query_models(args)
    except Exception as exc:  # surfaced to the model, never raised into the graph
        return as_tool_error("query_models", exc).model_dump_json()

    if not records:
        return json.dumps(
            {
                "results": [],
                "note": "No models matched. Relax a filter — the catalog has 30-odd models, "
                "so narrow combinations often return nothing.",
            }
        )

    return json.dumps(
        {
            "count": len(records),
            "results": [
                {
                    "slug": r.slug,
                    "name": r.name,
                    "provider": r.provider,
                    "release_date": r.release_date,
                    "context_window": r.context_window,
                    "input_per_1m": r.pricing.input_per_1m if r.pricing else None,
                    "output_per_1m": r.pricing.output_per_1m if r.pricing else None,
                    "modalities": r.modalities,
                    "availability": r.availability,
                    "strengths": r.strengths,
                }
                for r in records
            ],
        }
    )


def get_model(**kwargs) -> str:
    """Fetch one model's full record, including benchmark scores."""
    try:
        args = GetModelArgs.model_validate(kwargs)
    except Exception as exc:
        return as_tool_error("get_model", exc).model_dump_json()

    record = db.get_model(args.slug)
    if record is None:
        available = sorted(db.all_slugs())
        return json.dumps(
            {
                "error": f"No model with slug {args.slug!r} exists in the catalog.",
                "hint": "Do not invent models. Use query_models to find real slugs.",
                "known_slugs": available,
            }
        )

    return json.dumps(
        {
            **record.model_dump(),
            "benchmarks": [
                {**b.model_dump(), "pct_of_max": round(b.pct, 1)} for b in record.benchmarks
            ],
        }
    )


QUERY_MODELS_DESCRIPTION = """\
Search the AI model catalog using structured filters. This is the primary source of \
truth — call it before recommending anything. Filters combine with AND; `modalities` \
and `strengths` require ALL listed values, `availability` requires ANY. Use \
sort='cheapest' for price questions, 'context' for context-window questions, \
'newest' for recency, and 'benchmark' (with `benchmark`) to rank by a score."""

GET_MODEL_DESCRIPTION = """\
Fetch one model's complete record by slug, including benchmark scores and its official \
docs URL. Call this to confirm exact pricing and specs before you cite them. If the slug \
does not exist you get the list of real slugs back — never invent one."""
