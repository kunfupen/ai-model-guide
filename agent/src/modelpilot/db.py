"""Query layer over `catalog.db`.

Everything the agent can ask for goes through a parameterized query built from a
validated `QueryModelsArgs` — the model never supplies SQL.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Iterator

from .config import get_settings
from .ingest import ensure_db
from .schemas import Benchmark, DocSnippet, ModelRecord, Pricing, QueryModelsArgs


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(ensure_db())
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def _collect(conn: sqlite3.Connection, table: str, slug: str) -> list[str]:
    rows = conn.execute(f"SELECT value FROM {table} WHERE slug = ?", (slug,)).fetchall()
    return [r["value"] for r in rows]


def _hydrate(conn: sqlite3.Connection, row: sqlite3.Row) -> ModelRecord:
    slug = row["slug"]
    pricing = None
    if row["input_per_1m"] is not None and row["output_per_1m"] is not None:
        pricing = Pricing(input_per_1m=row["input_per_1m"], output_per_1m=row["output_per_1m"])
    benchmarks = [
        Benchmark(name=b["name"], score=b["score"], max=b["max"], source=b["source"])
        for b in conn.execute(
            "SELECT name, score, max, source FROM benchmarks WHERE slug = ? ORDER BY name", (slug,)
        )
    ]
    return ModelRecord(
        slug=slug,
        name=row["name"],
        provider=row["provider"],
        release_date=row["release_date"],
        context_window=row["context_window"],
        modalities=_collect(conn, "modalities", slug),
        pricing=pricing,
        availability=_collect(conn, "availability", slug),
        strengths=_collect(conn, "strengths", slug),
        official_docs=row["official_docs"],
        benchmarks=benchmarks,
    )


def all_slugs() -> set[str]:
    """Every slug in the catalog — used to validate the agent's final picks."""
    with connect() as conn:
        return {r["slug"] for r in conn.execute("SELECT slug FROM models")}


def get_model(slug: str) -> ModelRecord | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM models WHERE slug = ?", (slug,)).fetchone()
        return _hydrate(conn, row) if row else None


def query_models(args: QueryModelsArgs) -> list[ModelRecord]:
    """Translate validated filters into one parameterized SELECT."""
    where: list[str] = []
    params: list[object] = []

    if args.provider:
        where.append("m.provider = ?")
        params.append(args.provider)
    if args.min_context is not None:
        where.append("m.context_window >= ?")
        params.append(args.min_context)
    if args.max_input_price is not None:
        where.append("m.input_per_1m IS NOT NULL AND m.input_per_1m <= ?")
        params.append(args.max_input_price)
    if args.max_output_price is not None:
        where.append("m.output_per_1m IS NOT NULL AND m.output_per_1m <= ?")
        params.append(args.max_output_price)

    # ALL-of semantics for modalities and strengths; ANY-of for availability.
    for table, values, require_all in (
        ("modalities", args.modalities, True),
        ("strengths", args.strengths, True),
        ("availability", args.availability, False),
    ):
        if not values:
            continue
        placeholders = ",".join("?" for _ in values)
        having = f"HAVING COUNT(DISTINCT value) = {len(values)}" if require_all else ""
        where.append(
            f"m.slug IN (SELECT slug FROM {table} WHERE value IN ({placeholders}) "
            f"GROUP BY slug {having})"
        )
        params.extend(values)

    order = {
        "name": "m.name COLLATE NOCASE ASC",
        "newest": "m.release_date DESC",
        "cheapest": "m.input_per_1m IS NULL, m.input_per_1m ASC, m.output_per_1m ASC",
        "context": "m.context_window DESC",
    }.get(args.sort)

    if args.sort == "benchmark":
        if not args.benchmark:
            raise ValueError("sort='benchmark' requires the `benchmark` argument")
        sql = (
            "SELECT m.* FROM models m "
            "JOIN benchmarks b ON b.slug = m.slug AND b.name = ? "
            + (f"WHERE {' AND '.join(where)} " if where else "")
            + "ORDER BY (b.score / b.max) DESC LIMIT ?"
        )
        params = [args.benchmark, *params, args.limit]
    else:
        sql = (
            "SELECT m.* FROM models m "
            + (f"WHERE {' AND '.join(where)} " if where else "")
            + f"ORDER BY {order} LIMIT ?"
        )
        params.append(args.limit)

    with connect() as conn:
        rows = conn.execute(sql, params).fetchall()
        return [_hydrate(conn, row) for row in rows]


def search_docs(query: str, k: int = 5) -> list[DocSnippet]:
    """BM25-ranked full-text search over the MDX bodies."""
    # FTS5 treats several characters as operators; quote each term to search literally.
    terms = [t for t in query.replace('"', " ").split() if t]
    if not terms:
        return []
    match = " OR ".join(f'"{t}"' for t in terms)

    with connect() as conn:
        rows = conn.execute(
            """
            SELECT d.slug, d.heading, d.chunk, m.name
            FROM docs_fts d JOIN models m ON m.slug = d.slug
            WHERE docs_fts MATCH ?
            ORDER BY bm25(docs_fts) LIMIT ?
            """,
            (match, k),
        ).fetchall()

    return [
        DocSnippet(
            slug=r["slug"],
            name=r["name"],
            heading=r["heading"],
            snippet=r["chunk"][:600],
        )
        for r in rows
    ]


def catalog_stats() -> dict:
    with connect() as conn:
        count = conn.execute("SELECT COUNT(*) AS n FROM models").fetchone()["n"]
        newest = conn.execute(
            "SELECT name, release_date FROM models ORDER BY release_date DESC LIMIT 1"
        ).fetchone()
        providers = [
            r["provider"]
            for r in conn.execute("SELECT DISTINCT provider FROM models ORDER BY provider")
        ]
    return {
        "models": count,
        "providers": providers,
        "newest": f"{newest['name']} ({newest['release_date']})" if newest else None,
        "path": str(get_settings().db_path),
    }
