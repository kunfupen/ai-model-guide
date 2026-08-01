"""Cost tools. The arithmetic is done in Python, never by the model."""

from __future__ import annotations

import json

from .. import db
from ..retry import as_tool_error
from ..schemas import CompareCostsArgs, CostBreakdown, EstimateCostArgs


def _breakdown(slug: str, in_tokens: int, out_tokens: int) -> CostBreakdown | dict:
    record = db.get_model(slug)
    if record is None:
        return {"slug": slug, "error": "unknown slug — not in the catalog"}
    if record.pricing is None:
        return {"slug": slug, "error": f"{record.name} has no published pricing"}

    input_cost = (in_tokens / 1_000_000) * record.pricing.input_per_1m
    output_cost = (out_tokens / 1_000_000) * record.pricing.output_per_1m
    return CostBreakdown(
        slug=slug,
        name=record.name,
        input_cost_usd=round(input_cost, 2),
        output_cost_usd=round(output_cost, 2),
        monthly_cost_usd=round(input_cost + output_cost, 2),
        input_per_1m=record.pricing.input_per_1m,
        output_per_1m=record.pricing.output_per_1m,
    )


def estimate_cost(**kwargs) -> str:
    """Price one model at a given monthly token volume."""
    try:
        args = EstimateCostArgs.model_validate(kwargs)
    except Exception as exc:
        return as_tool_error("estimate_cost", exc).model_dump_json()

    result = _breakdown(args.slug, args.input_tokens_per_month, args.output_tokens_per_month)
    payload = result if isinstance(result, dict) else result.model_dump()
    return json.dumps(
        {
            **payload,
            "formula": "(input_tokens/1e6)*input_per_1m + (output_tokens/1e6)*output_per_1m",
        }
    )


def compare_costs(**kwargs) -> str:
    """Price several models at the same volume and rank them cheapest-first."""
    try:
        args = CompareCostsArgs.model_validate(kwargs)
    except Exception as exc:
        return as_tool_error("compare_costs", exc).model_dump_json()

    rows = [
        _breakdown(slug, args.input_tokens_per_month, args.output_tokens_per_month)
        for slug in args.slugs
    ]
    priced = [r for r in rows if isinstance(r, CostBreakdown)]
    unpriced = [r for r in rows if isinstance(r, dict)]
    priced.sort(key=lambda r: r.monthly_cost_usd)

    return json.dumps(
        {
            "assumptions": {
                "input_tokens_per_month": args.input_tokens_per_month,
                "output_tokens_per_month": args.output_tokens_per_month,
            },
            "ranked": [r.model_dump() for r in priced],
            "skipped": unpriced,
        }
    )


ESTIMATE_COST_DESCRIPTION = """\
Compute the exact monthly USD cost of one model at a given token volume, using the \
catalog's published prices. Always use this instead of doing the arithmetic yourself — \
the numbers you report must come from here."""

COMPARE_COSTS_DESCRIPTION = """\
Price several models at the same monthly token volume and return them ranked \
cheapest-first. Use this whenever the user is choosing between candidates on cost."""
