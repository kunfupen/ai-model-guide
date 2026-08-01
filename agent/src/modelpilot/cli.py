"""Rich terminal interface. Renders the ReAct trace as it happens."""

from __future__ import annotations

import json
import logging
import os
import uuid

import typer
from rich.console import Console
from rich.json import JSON
from rich.logging import RichHandler
from rich.panel import Panel
from rich.table import Table

from . import db
from .config import get_settings
from .graph import build_graph, initial_state, make_checkpointer
from .ingest import build_db
from .schemas import Recommendation

app = typer.Typer(add_completion=False, help="ModelPilot — grounded AI model recommendations.")
console = Console()


def _setup_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.INFO if verbose else logging.WARNING,
        format="%(message)s",
        handlers=[RichHandler(console=console, show_path=False, rich_tracebacks=True)],
    )


@app.command()
def ingest() -> None:
    """Rebuild catalog.db from ../content/models/*.mdx."""
    count = build_db()
    stats = db.catalog_stats()
    console.print(f"[green]Ingested {count} models[/green] -> {stats['path']}")
    console.print(f"Providers: {', '.join(stats['providers'])}")
    console.print(f"Newest: {stats['newest']}")


@app.command()
def stats() -> None:
    """Show what's in the catalog."""
    console.print(JSON(json.dumps(db.catalog_stats())))


def _render_tool_call(call: dict) -> None:
    args = json.dumps(call.get("args", {}), indent=2)
    console.print(
        Panel(
            JSON(args),
            title=f"[bold cyan]tool[/bold cyan] {call['name']}",
            border_style="cyan",
            expand=False,
        )
    )


def _render_tool_result(name: str, content: str) -> None:
    try:
        payload = json.loads(content)
    except json.JSONDecodeError:
        console.print(f"[dim]{content[:400]}[/dim]")
        return

    is_error = isinstance(payload, dict) and "error" in payload
    style = "red" if is_error else "green"
    summary = content if len(content) < 700 else content[:700] + " …(truncated)"
    console.print(
        Panel(
            JSON(summary),
            title=f"[bold {style}]result[/bold {style}] {name}",
            border_style=style,
            expand=False,
        )
    )


def _render_recommendation(rec: Recommendation) -> None:
    console.print()
    console.print(Panel(rec.answer, title="[bold]Recommendation[/bold]", border_style="magenta"))

    table = Table(show_header=True, header_style="bold magenta", expand=False)
    table.add_column("#", width=3)
    table.add_column("Model")
    table.add_column("Slug", style="dim")
    table.add_column("Monthly", justify="right")
    table.add_column("Why")
    for i, pick in enumerate(rec.picks, 1):
        cost = f"${pick.monthly_cost_usd:,.2f}" if pick.monthly_cost_usd is not None else "—"
        why = pick.why + ("\n" + "\n".join(f"⚠ {c}" for c in pick.caveats) if pick.caveats else "")
        table.add_row(str(i), pick.name, pick.slug, cost, why)
    console.print(table)

    if rec.assumptions:
        console.print("[bold]Assumptions[/bold]")
        for a in rec.assumptions:
            console.print(f"  • {a}")
    if rec.citations:
        console.print("[bold]Citations[/bold]")
        for c in rec.citations:
            console.print(f"  • [{c.kind}] {c.ref}" + (f" — {c.note}" if c.note else ""))
    console.print(f"[dim]confidence: {rec.confidence}[/dim]")


@app.command()
def ask(
    question: str = typer.Argument(..., help="What do you want to know?"),
    thread: str = typer.Option(None, "--thread", "-t", help="Thread id for follow-up turns."),
    chaos: float = typer.Option(
        0.0, "--chaos", min=0.0, max=1.0, help="Inject this failure rate into network tools."
    ),
    as_json: bool = typer.Option(False, "--json", help="Print the raw recommendation as JSON."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Show step logs."),
) -> None:
    """Ask ModelPilot a question."""
    _setup_logging(verbose)

    if chaos:
        os.environ["MODELPILOT_CHAOS_FAILURE_RATE"] = str(chaos)
        get_settings.cache_clear()
        console.print(f"[yellow]chaos mode: {chaos:.0%} of network calls will fail[/yellow]")

    if not get_settings().anthropic_configured:
        console.print("[red]ANTHROPIC_API_KEY is not set.[/red] Copy .env.example to .env.")
        raise typer.Exit(1)

    thread_id = thread or str(uuid.uuid4())
    checkpointer = make_checkpointer()
    graph = build_graph(checkpointer=checkpointer)
    config = {"configurable": {"thread_id": thread_id}}

    # On a follow-up turn the checkpointer already holds the history; only send the new turn.
    existing = checkpointer.get(config)
    state = (
        {"messages": [("user", question)]}
        if existing
        else initial_state(question)
    )

    console.print(Panel(question, title="[bold]Question[/bold]", border_style="blue"))

    final: dict | None = None
    seen_tool_calls: set[str] = set()
    for event in graph.stream(state, config=config, stream_mode="values"):
        final = event
        messages = event.get("messages", [])
        if not messages:
            continue
        last = messages[-1]
        if last.type == "ai":
            if isinstance(last.content, str) and last.content.strip():
                console.print(f"[italic]{last.content.strip()}[/italic]")
            for call in getattr(last, "tool_calls", []) or []:
                if call["id"] not in seen_tool_calls:
                    seen_tool_calls.add(call["id"])
                    _render_tool_call(call)
        elif last.type == "tool":
            _render_tool_result(getattr(last, "name", "?"), str(last.content))

    if not final or not final.get("recommendation"):
        console.print("[red]The run produced no recommendation.[/red]")
        raise typer.Exit(1)

    rec: Recommendation = final["recommendation"]
    if as_json:
        console.print(JSON(rec.model_dump_json(indent=2)))
    else:
        _render_recommendation(rec)

    budget = final["budget"]
    console.print(
        f"[dim]{budget['steps_used']} steps · {budget['tool_calls']} tool calls · "
        f"{budget['input_tokens']:,} in / {budget['output_tokens']:,} out tokens · "
        f"thread {thread_id}[/dim]"
    )
    if final.get("tool_errors"):
        console.print(f"[yellow]{len(final['tool_errors'])} tool error(s) recovered from[/yellow]")


if __name__ == "__main__":
    app()
