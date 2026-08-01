"""Run the golden questions and score the agent.

    uv run python evals/run_evals.py               # all cases
    uv run python evals/run_evals.py -k cost       # cases whose id contains "cost"
    uv run python evals/run_evals.py --concurrency 4 --markdown

Scores behavior, not phrasing: did it call the right tools, name real models, and get
the arithmetic right.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import sys
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from rich.console import Console
from rich.table import Table

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from modelpilot import db  # noqa: E402
from modelpilot.config import get_settings  # noqa: E402
from modelpilot.graph import build_graph, initial_state  # noqa: E402
from modelpilot.schemas import Recommendation  # noqa: E402

console = Console()
CASES_PATH = Path(__file__).parent / "cases.yaml"
CONFIDENCE_ORDER = {"low": 0, "medium": 1, "high": 2}


@dataclass
class CaseResult:
    id: str
    passed: bool = False
    failures: list[str] = field(default_factory=list)
    tools_called: list[str] = field(default_factory=list)
    slugs: list[str] = field(default_factory=list)
    steps: int = 0
    latency_s: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0
    error: str | None = None

    @property
    def cost_usd(self) -> float:
        """Rough run cost at Opus 5 list pricing ($5/$25 per 1M)."""
        return (self.input_tokens / 1e6) * 5 + (self.output_tokens / 1e6) * 25


def run_case(case: dict) -> CaseResult:
    result = CaseResult(id=case["id"])
    graph = build_graph()  # no checkpointer: every case starts clean
    config = {"configurable": {"thread_id": f"eval-{uuid.uuid4()}"}}

    started = time.monotonic()
    final = None
    try:
        for event in graph.stream(
            initial_state(case["question"]), config=config, stream_mode="values"
        ):
            final = event
            for message in event.get("messages", [])[-1:]:
                for call in getattr(message, "tool_calls", []) or []:
                    result.tools_called.append(call["name"])
    except Exception as exc:  # noqa: BLE001
        result.error = f"{type(exc).__name__}: {exc}"
        result.latency_s = time.monotonic() - started
        result.failures.append(f"run raised: {result.error}")
        return result

    result.latency_s = time.monotonic() - started
    if not final or not final.get("recommendation"):
        result.failures.append("no recommendation produced")
        return result

    rec: Recommendation = final["recommendation"]
    result.slugs = [p.slug for p in rec.picks]
    result.steps = final["budget"]["steps_used"]
    result.input_tokens = final["budget"]["input_tokens"]
    result.output_tokens = final["budget"]["output_tokens"]
    result.failures = score(case, rec, result)
    result.passed = not result.failures
    return result


def score(case: dict, rec: Recommendation, result: CaseResult) -> list[str]:
    failures: list[str] = []
    called = set(result.tools_called)
    slugs = set(result.slugs)
    known = db.all_slugs()

    # The invariant that always applies, whether or not the case says so.
    for slug in slugs - known:
        failures.append(f"invented slug {slug!r}")

    for tool in case.get("expect_tools", []):
        if tool not in called:
            failures.append(f"never called {tool}")
    for tool in case.get("forbid_tools", []):
        if tool in called:
            failures.append(f"called {tool} when it should not have")

    for slug in case.get("expect_slugs", []):
        if slug not in slugs:
            failures.append(f"missing expected pick {slug}")
    if any_of := case.get("expect_any_slug"):
        if not (set(any_of) & slugs):
            failures.append(f"none of {any_of} appeared in picks")
    for slug in case.get("forbid_slugs", []):
        if slug in slugs:
            failures.append(f"recommended forbidden {slug}")

    if expected := case.get("expect_cost"):
        pick = next((p for p in rec.picks if p.slug == expected["slug"]), None)
        if pick is None:
            failures.append(f"no pick for {expected['slug']} to check cost against")
        elif pick.monthly_cost_usd is None:
            failures.append(f"{expected['slug']} has no monthly cost attached")
        elif abs(pick.monthly_cost_usd - expected["usd"]) > expected.get("tolerance", 0.5):
            failures.append(
                f"cost for {expected['slug']} was ${pick.monthly_cost_usd:,.2f}, "
                f"expected ${expected['usd']:,.2f}"
            )

    haystack = (rec.answer + " " + " ".join(p.why for p in rec.picks)).lower()
    for phrase in case.get("expect_phrases", []):
        if phrase.lower() not in haystack:
            failures.append(f"answer never says {phrase!r}")

    if (minimum := case.get("min_assumptions")) and len(rec.assumptions) < minimum:
        failures.append(f"stated {len(rec.assumptions)} assumptions, expected >= {minimum}")

    if ceiling := case.get("max_confidence"):
        if CONFIDENCE_ORDER[rec.confidence] > CONFIDENCE_ORDER[ceiling]:
            failures.append(f"confidence {rec.confidence!r} exceeds {ceiling!r}")

    return failures


def render(results: list[CaseResult], markdown: bool) -> None:
    passed = sum(r.passed for r in results)
    total = len(results)

    table = Table(title=f"ModelPilot evals — {passed}/{total} passed", show_lines=False)
    table.add_column("case", no_wrap=True)
    table.add_column("ok", justify="center", width=3)
    table.add_column("steps", justify="right", width=5)
    table.add_column("s", justify="right", width=6)
    table.add_column("$", justify="right", width=7)
    table.add_column("tools")
    table.add_column("failures")

    for r in results:
        table.add_row(
            r.id,
            "[green]✓[/green]" if r.passed else "[red]✗[/red]",
            str(r.steps),
            f"{r.latency_s:.1f}",
            f"{r.cost_usd:.3f}",
            ", ".join(dict.fromkeys(r.tools_called)) or "—",
            "\n".join(r.failures)[:200],
        )
    console.print(table)

    tool_cases = [r for r in results if r.tools_called]
    console.print(
        f"\n[bold]pass rate[/bold] {passed}/{total} ({100 * passed / total:.0f}%)  ·  "
        f"[bold]mean steps[/bold] {sum(r.steps for r in results) / total:.1f}  ·  "
        f"[bold]mean latency[/bold] {sum(r.latency_s for r in results) / total:.1f}s  ·  "
        f"[bold]mean cost[/bold] ${sum(r.cost_usd for r in results) / total:.3f}  ·  "
        f"[bold]used tools[/bold] {len(tool_cases)}/{total}"
    )
    hallucinated = [r for r in results if any("invented slug" in f for f in r.failures)]
    console.print(
        f"[bold]hallucinated slugs[/bold] {len(hallucinated)}/{total} "
        f"{'[green](none — the finalize guard held)[/green]' if not hallucinated else '[red]'}"
    )

    if markdown:
        lines = [
            "| case | ok | steps | latency | failures |",
            "| --- | --- | --- | --- | --- |",
        ]
        for r in results:
            lines.append(
                f"| `{r.id}` | {'✅' if r.passed else '❌'} | {r.steps} | "
                f"{r.latency_s:.1f}s | {'; '.join(r.failures) or '—'} |"
            )
        console.print("\n".join(lines))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("-k", "--filter", help="only run cases whose id contains this")
    parser.add_argument("--concurrency", type=int, default=3)
    parser.add_argument("--markdown", action="store_true", help="also print a Markdown table")
    parser.add_argument("--json", dest="as_json", action="store_true")
    args = parser.parse_args()

    if not get_settings().anthropic_configured:
        console.print("[red]ANTHROPIC_API_KEY is not set — evals need a live model.[/red]")
        return 2

    cases = yaml.safe_load(CASES_PATH.read_text())
    if args.filter:
        cases = [c for c in cases if args.filter in c["id"]]
    if not cases:
        console.print("[yellow]no cases matched[/yellow]")
        return 1

    console.print(f"Running {len(cases)} cases against [bold]{get_settings().model}[/bold]…")
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        results = list(pool.map(run_case, cases))

    order = {c["id"]: i for i, c in enumerate(cases)}
    results.sort(key=lambda r: order[r.id])

    if args.as_json:
        print(json.dumps([r.__dict__ for r in results], indent=2, default=str))
    else:
        render(results, args.markdown)

    return 0 if all(r.passed for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
