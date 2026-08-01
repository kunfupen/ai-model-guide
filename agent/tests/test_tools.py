"""Tool behavior — the parts that must be correct regardless of what the model does."""

from __future__ import annotations

import json

import pytest

from modelpilot import db
from modelpilot.schemas import QueryModelsArgs
from modelpilot.tools import ALL_TOOLS, calc, catalog, cost, docs


def j(raw: str) -> dict:
    return json.loads(raw)


# --- registry ---------------------------------------------------------------


def test_every_tool_has_a_schema_and_description():
    for tool in ALL_TOOLS:
        assert tool.description and len(tool.description) > 40, f"{tool.name} needs a real description"
        assert tool.args_schema is not None, f"{tool.name} must declare an args schema"


# --- query_models -----------------------------------------------------------


def test_min_context_filter_is_respected():
    result = j(catalog.query_models(min_context=1_000_000, limit=32))
    assert result["count"] > 0
    assert all(m["context_window"] >= 1_000_000 for m in result["results"])


def test_strengths_require_all_values():
    result = j(catalog.query_models(strengths=["coding", "reasoning"], limit=32))
    for m in result["results"]:
        assert {"coding", "reasoning"} <= set(m["strengths"])


def test_availability_requires_any_value():
    result = j(catalog.query_models(availability=["bedrock", "vertex"], limit=32))
    for m in result["results"]:
        assert {"bedrock", "vertex"} & set(m["availability"])


def test_cheapest_sort_is_ordered_and_puts_unpriced_last():
    result = j(catalog.query_models(sort="cheapest", limit=32))
    priced = [m["input_per_1m"] for m in result["results"] if m["input_per_1m"] is not None]
    unpriced_start = next(
        (i for i, m in enumerate(result["results"]) if m["input_per_1m"] is None), len(priced)
    )
    assert priced == sorted(priced)
    assert all(m["input_per_1m"] is None for m in result["results"][unpriced_start:])


def test_impossible_filter_returns_a_helpful_note_not_an_error():
    result = j(catalog.query_models(min_context=99_000_000_000))
    assert result["results"] == []
    assert "relax" in result["note"].lower()


def test_benchmark_sort_requires_benchmark_name():
    result = j(catalog.query_models(sort="benchmark"))
    assert "error" in result


def test_benchmark_sort_ranks_by_normalized_score():
    result = j(catalog.query_models(sort="benchmark", benchmark="SWE-bench Verified", limit=5))
    assert result["count"] > 0
    slugs = [m["slug"] for m in result["results"]]
    top = db.get_model(slugs[0])
    second = db.get_model(slugs[1])
    score = lambda r: next(b.pct for b in r.benchmarks if b.name == "SWE-bench Verified")  # noqa: E731
    assert score(top) >= score(second)


def test_bad_argument_returns_structured_error_not_exception():
    result = j(catalog.query_models(provider="not-a-real-provider"))
    assert result["tool"] == "query_models"
    assert result["retryable"] is False


# --- get_model --------------------------------------------------------------


def test_unknown_slug_returns_the_real_slug_list():
    result = j(catalog.get_model(slug="openai-gpt-99"))
    assert "error" in result
    assert len(result["known_slugs"]) == db.catalog_stats()["models"]
    assert "do not invent" in result["hint"].lower()


# --- cost -------------------------------------------------------------------


def test_cost_math_matches_hand_calculation():
    """50M input at $5/1M + 5M output at $25/1M = $250 + $125 = $375."""
    result = j(
        cost.estimate_cost(
            slug="anthropic-claude-opus-5",
            input_tokens_per_month=50_000_000,
            output_tokens_per_month=5_000_000,
        )
    )
    assert result["input_cost_usd"] == 250.0
    assert result["output_cost_usd"] == 125.0
    assert result["monthly_cost_usd"] == 375.0


def test_cost_agrees_with_the_independent_calculator():
    priced = j(
        cost.estimate_cost(
            slug="anthropic-claude-sonnet-5",
            input_tokens_per_month=50_000_000,
            output_tokens_per_month=5_000_000,
        )
    )
    record = db.get_model("anthropic-claude-sonnet-5")
    expression = f"(50e6/1e6)*{record.pricing.input_per_1m} + (5e6/1e6)*{record.pricing.output_per_1m}"
    assert calc.safe_eval(expression) == pytest.approx(priced["monthly_cost_usd"])


def test_compare_costs_is_ranked_cheapest_first():
    result = j(
        cost.compare_costs(
            slugs=["anthropic-claude-fable-5", "anthropic-claude-sonnet-5", "anthropic-claude-opus-5"],
            input_tokens_per_month=10_000_000,
            output_tokens_per_month=1_000_000,
        )
    )
    costs = [r["monthly_cost_usd"] for r in result["ranked"]]
    assert costs == sorted(costs)
    assert result["ranked"][0]["slug"] == "anthropic-claude-sonnet-5"


def test_compare_costs_skips_unknown_slugs_without_failing():
    result = j(
        cost.compare_costs(
            slugs=["anthropic-claude-opus-5", "totally-made-up"],
            input_tokens_per_month=1_000_000,
            output_tokens_per_month=100_000,
        )
    )
    assert len(result["ranked"]) == 1
    assert result["skipped"][0]["slug"] == "totally-made-up"


# --- calculator -------------------------------------------------------------


@pytest.mark.parametrize(
    "expression,expected",
    [
        ("2 + 3 * 4", 14),
        ("(50e6/1e6)*5", 250.0),
        ("round(1/3, 3)", 0.333),
        ("max(1, 7, 3)", 7),
        ("sqrt(16)", 4.0),
    ],
)
def test_calculator_arithmetic(expression, expected):
    assert calc.safe_eval(expression) == pytest.approx(expected)


@pytest.mark.parametrize(
    "expression",
    [
        "__import__('os').system('echo pwned')",
        "open('/etc/passwd').read()",
        "().__class__.__bases__",
        "exec('x=1')",
        "lambda: 1",
        "[x for x in range(10)]",
        "2**10**10",
    ],
)
def test_calculator_rejects_anything_that_is_not_arithmetic(expression):
    with pytest.raises((ValueError, SyntaxError)):
        calc.safe_eval(expression)


def test_calculator_tool_returns_error_json_rather_than_raising():
    result = j(calc.calculate(expression="__import__('os')"))
    assert "error" in result


# --- docs -------------------------------------------------------------------


def test_doc_search_returns_citable_slugs():
    result = j(docs.search_model_docs(query="context window pricing", k=3))
    known = db.all_slugs()
    assert result["count"] > 0
    assert all(hit["slug"] in known for hit in result["results"])


def test_doc_search_handles_fts_operator_characters():
    """Raw FTS5 syntax in user text must not blow up the query."""
    result = j(docs.search_model_docs(query='cheap "AND" model* (fast)', k=3))
    assert "error" not in result


def test_query_models_never_takes_raw_sql():
    """The filter surface is a closed set of fields — there is no SQL passthrough."""
    assert "sql" not in QueryModelsArgs.model_fields
    assert "query" not in QueryModelsArgs.model_fields
