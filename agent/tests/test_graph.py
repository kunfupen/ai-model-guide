"""Graph wiring, budget enforcement, and the anti-hallucination guard.

These run without an API key: the chat model is replaced with scripted fakes so the
control flow is tested deterministically.
"""

from __future__ import annotations

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from modelpilot import db, graph
from modelpilot.config import get_settings
from modelpilot.schemas import Pick, Recommendation

REAL_SLUG = "anthropic-claude-opus-5"
FAKE_SLUG = "openai-gpt-7-turbo-ultra"


class FakeStructuredLLM:
    """Returns a scripted Recommendation per call, so repair logic can be exercised."""

    def __init__(self, responses: list[Recommendation]):
        self.responses = list(responses)
        self.calls = 0

    def invoke(self, _messages):
        self.calls += 1
        return self.responses.pop(0) if self.responses else self.responses_exhausted()

    def responses_exhausted(self):
        raise AssertionError("FakeStructuredLLM called more times than scripted")


class FakeLLM:
    def __init__(self, structured: FakeStructuredLLM):
        self._structured = structured

    def bind_tools(self, _tools):
        return self

    def with_structured_output(self, _schema):
        return self._structured

    def invoke(self, _messages):
        return AIMessage(content="done")


def rec(slugs: list[str], **kwargs) -> Recommendation:
    return Recommendation(
        answer="answer",
        picks=[Pick(slug=s, name=s, why="because") for s in slugs],
        **kwargs,
    )


def state_with(messages) -> dict:
    base = graph.initial_state("q")
    base["messages"] = messages
    return base


# --- graph shape ------------------------------------------------------------


def test_graph_compiles_and_has_the_expected_nodes():
    compiled = graph.build_graph()
    nodes = set(compiled.get_graph().nodes)
    assert {"agent", "tools", "collect_errors", "finalize"} <= nodes


def test_loop_continues_while_the_model_calls_tools():
    message = AIMessage(
        content="",
        tool_calls=[{"name": "query_models", "args": {}, "id": "1", "type": "tool_call"}],
    )
    assert graph.should_continue(state_with([message])) == "tools"


def test_loop_finalizes_when_the_model_stops_calling_tools():
    assert graph.should_continue(state_with([AIMessage(content="here you go")])) == "finalize"


def test_step_budget_forces_finalize():
    message = AIMessage(
        content="", tool_calls=[{"name": "query_models", "args": {}, "id": "1", "type": "tool_call"}]
    )
    st = state_with([message])
    st["steps"] = get_settings().max_steps
    assert graph.should_continue(st) == "finalize"


def test_tool_call_budget_forces_finalize():
    message = AIMessage(
        content="", tool_calls=[{"name": "query_models", "args": {}, "id": "1", "type": "tool_call"}]
    )
    st = state_with([message])
    st["budget"] = {**st["budget"], "tool_calls": get_settings().max_tool_calls}
    assert graph.should_continue(st) == "finalize"


# --- state ------------------------------------------------------------------


def test_initial_state_starts_with_a_zeroed_budget():
    st = graph.initial_state("which model?")
    assert st["steps"] == 0
    assert st["budget"]["tool_calls"] == 0
    assert st["recommendation"] is None
    assert st["messages"][0].content == "which model?"


def test_collect_errors_records_tool_failures():
    from langchain_core.messages import ToolMessage

    st = state_with(
        [ToolMessage(content='{"error": "HTTP 500", "retryable": true}', tool_call_id="1", name="web_search")]
    )
    result = graph.collect_errors_node(st)
    assert len(result["tool_errors"]) == 1
    assert result["tool_errors"][0]["tool"] == "web_search"


def test_collect_errors_ignores_successful_results():
    from langchain_core.messages import ToolMessage

    st = state_with([ToolMessage(content='{"count": 3}', tool_call_id="1", name="query_models")])
    assert graph.collect_errors_node(st) == {}


# --- the anti-hallucination guard -------------------------------------------


def test_grounded_picks_pass_straight_through(monkeypatch):
    fake = FakeStructuredLLM([rec([REAL_SLUG])])
    monkeypatch.setattr(graph, "build_llm", lambda **kw: FakeLLM(fake))

    result = graph.finalize_node(state_with([HumanMessage(content="q")]))
    assert result["recommendation"].picks[0].slug == REAL_SLUG
    assert fake.calls == 1, "a valid recommendation must not trigger a repair round"


def test_invented_slug_triggers_one_repair_attempt(monkeypatch):
    fake = FakeStructuredLLM([rec([FAKE_SLUG]), rec([REAL_SLUG])])
    monkeypatch.setattr(graph, "build_llm", lambda **kw: FakeLLM(fake))

    result = graph.finalize_node(state_with([HumanMessage(content="q")]))
    assert fake.calls == 2, "the model should get exactly one chance to correct itself"
    assert result["recommendation"].picks[0].slug == REAL_SLUG


def test_persistent_hallucination_is_stripped_not_returned(monkeypatch):
    """If repair fails but some picks are real, ship only the real ones."""
    fake = FakeStructuredLLM([rec([FAKE_SLUG, REAL_SLUG]), rec([FAKE_SLUG, REAL_SLUG])])
    monkeypatch.setattr(graph, "build_llm", lambda **kw: FakeLLM(fake))

    result = graph.finalize_node(state_with([HumanMessage(content="q")]))
    recommendation = result["recommendation"]
    assert [p.slug for p in recommendation.picks] == [REAL_SLUG]
    assert recommendation.confidence == "low"
    assert any("not in the catalog" in a for a in recommendation.assumptions)


def test_all_picks_invented_falls_back_instead_of_inventing(monkeypatch):
    fake = FakeStructuredLLM([rec([FAKE_SLUG]), rec([FAKE_SLUG])])
    monkeypatch.setattr(graph, "build_llm", lambda **kw: FakeLLM(fake))

    result = graph.finalize_node(state_with([HumanMessage(content="q")]))
    recommendation = result["recommendation"]
    assert recommendation.confidence == "low"
    assert all(p.slug in db.all_slugs() for p in recommendation.picks)
    assert "could not produce a grounded recommendation" in recommendation.answer


def test_every_returned_slug_always_exists_in_the_catalog(monkeypatch):
    """The invariant that matters: whatever happens, we never emit a fake model."""
    known = db.all_slugs()
    scenarios = [
        [rec([REAL_SLUG])],
        [rec([FAKE_SLUG]), rec([REAL_SLUG])],
        [rec([FAKE_SLUG, REAL_SLUG]), rec([FAKE_SLUG, REAL_SLUG])],
        [rec([FAKE_SLUG]), rec([FAKE_SLUG])],
    ]
    for responses in scenarios:
        fake = FakeStructuredLLM(responses)
        monkeypatch.setattr(graph, "build_llm", lambda **kw: FakeLLM(fake))
        result = graph.finalize_node(state_with([HumanMessage(content="q")]))
        for pick in result["recommendation"].picks:
            assert pick.slug in known


def test_truncated_run_is_told_to_lower_its_confidence(monkeypatch):
    captured = {}

    class CapturingLLM(FakeStructuredLLM):
        def invoke(self, messages):
            captured["messages"] = messages
            return super().invoke(messages)

    fake = CapturingLLM([rec([REAL_SLUG])])
    monkeypatch.setattr(graph, "build_llm", lambda **kw: FakeLLM(fake))

    pending = AIMessage(
        content="", tool_calls=[{"name": "query_models", "args": {}, "id": "1", "type": "tool_call"}]
    )
    graph.finalize_node(state_with([pending]))
    assert any("ran out of steps" in str(m.content) for m in captured["messages"])


# --- schema -----------------------------------------------------------------


def test_recommendation_rejects_duplicate_picks():
    with pytest.raises(ValueError, match="repeat the same slug"):
        rec([REAL_SLUG, REAL_SLUG])


def test_recommendation_requires_at_least_one_pick():
    with pytest.raises(ValueError):
        Recommendation(answer="a", picks=[])
