"""The agent loop.

    entry -> agent -> (tools -> agent)* -> finalize -> END

`agent` is the LLM with tools bound. `should_continue` routes back through `tools` while
the model keeps calling them, and to `finalize` when it stops or the step budget runs
out. `finalize` produces the validated `Recommendation`.
"""

from __future__ import annotations

import logging
import sqlite3
import time
from typing import Annotated, Any, Literal, TypedDict

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, SystemMessage
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from pydantic import ValidationError

from . import db
from .config import get_settings
from .prompts import FINALIZE_PROMPT, REPAIR_PROMPT, SYSTEM_PROMPT
from .schemas import Recommendation
from .tools import ALL_TOOLS

log = logging.getLogger("modelpilot.graph")


class Budget(TypedDict):
    max_steps: int
    steps_used: int
    tool_calls: int
    input_tokens: int
    output_tokens: int


class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    steps: int
    tool_errors: list[dict[str, Any]]
    recommendation: Recommendation | None
    budget: Budget


def build_llm(*, streaming: bool = False) -> ChatAnthropic:
    """Construct the chat model.

    Note there is no `temperature`/`top_p`/`top_k` here, and that is deliberate: those
    parameters are rejected with a 400 on Claude Opus 5. Thinking is also on by default
    on that model and shares the `max_tokens` ceiling with the response text, which is
    why the default budget is generous.
    """
    settings = get_settings()
    return ChatAnthropic(
        model=settings.model,
        max_tokens=settings.max_tokens,
        streaming=streaming,
        timeout=120,
        stop=None,
    )


def system_message() -> SystemMessage:
    stats = db.catalog_stats()
    return SystemMessage(
        content=SYSTEM_PROMPT.format(
            model_count=stats["models"],
            providers=", ".join(stats["providers"]),
            newest=stats["newest"],
        )
    )


def _accumulate_usage(budget: Budget, message: AIMessage) -> Budget:
    usage = getattr(message, "usage_metadata", None) or {}
    return {
        **budget,
        "input_tokens": budget["input_tokens"] + usage.get("input_tokens", 0),
        "output_tokens": budget["output_tokens"] + usage.get("output_tokens", 0),
    }


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------


def agent_node(state: AgentState) -> dict:
    """One turn of the model with tools bound."""
    llm = build_llm().bind_tools(ALL_TOOLS)
    started = time.monotonic()
    response = llm.invoke([system_message(), *state["messages"]])
    elapsed_ms = int((time.monotonic() - started) * 1000)

    tool_calls = getattr(response, "tool_calls", []) or []
    log.info(
        "agent step=%d latency_ms=%d tool_calls=%s",
        state["steps"] + 1,
        elapsed_ms,
        [c["name"] for c in tool_calls],
    )

    budget = _accumulate_usage(state["budget"], response)
    budget = {
        **budget,
        "steps_used": state["steps"] + 1,
        "tool_calls": budget["tool_calls"] + len(tool_calls),
    }
    return {"messages": [response], "steps": state["steps"] + 1, "budget": budget}


def collect_errors_node(state: AgentState) -> dict:
    """Record structured tool errors so `finalize` can reason about degraded runs."""
    errors: list[dict[str, Any]] = []
    for message in reversed(state["messages"]):
        if message.type != "tool":
            break
        content = message.content if isinstance(message.content, str) else ""
        if '"error"' in content:
            errors.append({"tool": getattr(message, "name", "unknown"), "payload": content[:400]})
    if not errors:
        return {}
    log.warning("tool errors: %s", [e["tool"] for e in errors])
    return {"tool_errors": state["tool_errors"] + errors}


def _validate_picks(rec: Recommendation, known: set[str]) -> list[str]:
    return [
        f"pick[{i}].slug = {p.slug!r} is not in the catalog"
        for i, p in enumerate(rec.picks)
        if p.slug not in known
    ]


def finalize_node(state: AgentState) -> dict:
    """Produce the structured recommendation, and refuse to emit invented models.

    The model gets exactly one repair attempt with the validation errors attached. If it
    still cannot ground its picks, we strip the ungrounded ones rather than ship them.
    """
    llm = build_llm().with_structured_output(Recommendation)
    known = db.all_slugs()
    conversation = [system_message(), *state["messages"], HumanMessage(content=FINALIZE_PROMPT)]

    # We arrive here with pending tool calls only when a budget cut the loop short.
    truncated = bool(getattr(state["messages"][-1], "tool_calls", None))
    if truncated:
        conversation.append(
            HumanMessage(
                content="You ran out of steps before finishing. Answer with what you "
                "established, set confidence to 'low', and say what is unverified."
            )
        )

    try:
        rec: Recommendation = llm.invoke(conversation)
    except ValidationError as exc:
        log.error("structured output failed schema validation: %s", exc)
        return {"recommendation": _fallback(state, f"schema validation failed: {exc}")}

    problems = _validate_picks(rec, known)
    if problems:
        log.warning("hallucinated slugs, repairing: %s", problems)
        repair = HumanMessage(
            content=REPAIR_PROMPT.format(
                errors="\n".join(f"- {p}" for p in problems),
                slugs="\n".join(f"- {s}" for s in sorted(known)),
            )
        )
        try:
            rec = llm.invoke([*conversation, AIMessage(content=rec.answer), repair])
            problems = _validate_picks(rec, known)
        except ValidationError as exc:
            log.error("repair attempt failed: %s", exc)
            problems = [str(exc)]

    if problems:
        # Last resort: drop the ungrounded picks instead of returning them.
        grounded = [p for p in rec.picks if p.slug in known]
        if not grounded:
            return {"recommendation": _fallback(state, "; ".join(problems))}
        rec = rec.model_copy(
            update={
                "picks": grounded,
                "confidence": "low",
                "assumptions": [
                    *rec.assumptions,
                    "Some proposed models were not in the catalog and were removed.",
                ],
            }
        )

    return {"recommendation": rec}


def _fallback(state: AgentState, reason: str) -> Recommendation:
    """Never return nothing. A degraded, honest answer beats a crash."""
    newest = db.catalog_stats()["newest"]
    return Recommendation(
        answer=(
            "I could not produce a grounded recommendation for this question. "
            f"Reason: {reason}. Try narrowing the ask — for example, name the "
            "capability you need and any budget or context-window constraint."
        ),
        picks=[
            {
                "slug": sorted(db.all_slugs())[0],
                "name": newest or "see catalog",
                "why": "Placeholder — the agent could not ground a recommendation.",
                "caveats": ["Not a real recommendation; the run failed validation."],
            }
        ],
        assumptions=[f"Run degraded after {state['steps']} steps."],
        confidence="low",
    )


# ---------------------------------------------------------------------------
# Edges
# ---------------------------------------------------------------------------


def should_continue(state: AgentState) -> Literal["tools", "finalize"]:
    last = state["messages"][-1]
    wants_tools = bool(getattr(last, "tool_calls", None))
    settings = get_settings()

    if not wants_tools:
        return "finalize"
    if state["steps"] >= settings.max_steps:
        log.warning("step budget exhausted at %d steps", state["steps"])
        return "finalize"
    if state["budget"]["tool_calls"] >= settings.max_tool_calls:
        log.warning("tool-call budget exhausted")
        return "finalize"
    return "tools"


def build_graph(checkpointer=None):
    graph = StateGraph(AgentState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", ToolNode(ALL_TOOLS))
    graph.add_node("collect_errors", collect_errors_node)
    graph.add_node("finalize", finalize_node)

    graph.add_edge(START, "agent")
    graph.add_conditional_edges(
        "agent", should_continue, {"tools": "tools", "finalize": "finalize"}
    )
    graph.add_edge("tools", "collect_errors")
    graph.add_edge("collect_errors", "agent")
    graph.add_edge("finalize", END)

    return graph.compile(checkpointer=checkpointer)


def initial_state(question: str) -> AgentState:
    settings = get_settings()
    return {
        "messages": [HumanMessage(content=question)],
        "steps": 0,
        "tool_errors": [],
        "recommendation": None,
        "budget": {
            "max_steps": settings.max_steps,
            "steps_used": 0,
            "tool_calls": 0,
            "input_tokens": 0,
            "output_tokens": 0,
        },
    }


def make_checkpointer() -> SqliteSaver:
    """Persistent, thread-scoped conversation state for multi-turn follow-ups."""
    settings = get_settings()
    settings.checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(settings.checkpoint_path, check_same_thread=False)
    return SqliteSaver(conn)
