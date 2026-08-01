"""Build `catalog.db` from `content/models/*.mdx`.

Idempotent: drops and rebuilds every table on each run. Fast enough (~30 files) that
the CLI and the API server both just call `ensure_db()` on startup.
"""

from __future__ import annotations

import re
import sqlite3
from pathlib import Path

import frontmatter
from pydantic import ValidationError

from .config import get_settings
from .schemas import ModelRecord

SCHEMA = """
CREATE TABLE models (
    slug           TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    provider       TEXT NOT NULL,
    release_date   TEXT NOT NULL,
    context_window INTEGER NOT NULL,
    input_per_1m   REAL,
    output_per_1m  REAL,
    official_docs  TEXT NOT NULL,
    body           TEXT NOT NULL
);
CREATE TABLE modalities   (slug TEXT NOT NULL, value TEXT NOT NULL);
CREATE TABLE availability (slug TEXT NOT NULL, value TEXT NOT NULL);
CREATE TABLE strengths    (slug TEXT NOT NULL, value TEXT NOT NULL);
CREATE TABLE benchmarks (
    slug   TEXT NOT NULL,
    name   TEXT NOT NULL,
    score  REAL NOT NULL,
    max    REAL NOT NULL,
    source TEXT
);
CREATE INDEX idx_modalities_slug   ON modalities(slug);
CREATE INDEX idx_availability_slug ON availability(slug);
CREATE INDEX idx_strengths_slug    ON strengths(slug);
CREATE INDEX idx_benchmarks_slug   ON benchmarks(slug);
CREATE VIRTUAL TABLE docs_fts USING fts5(slug, heading, chunk, tokenize='porter');
"""

# Frontmatter uses camelCase (it is consumed by TypeScript); the Python side is snake_case.
FIELD_MAP = {
    "slug": "slug",
    "name": "name",
    "provider": "provider",
    "releaseDate": "release_date",
    "contextWindow": "context_window",
    "modalities": "modalities",
    "availability": "availability",
    "strengths": "strengths",
    "officialDocs": "official_docs",
    "benchmarks": "benchmarks",
}


def _normalize(raw: dict) -> dict:
    """Map MDX frontmatter onto ModelRecord's field names."""
    out: dict = {}
    for src, dest in FIELD_MAP.items():
        if src in raw:
            out[dest] = raw[src]

    # `releaseDate` parses as a `datetime.date` under YAML; the schema wants YYYY-MM-DD.
    if "release_date" in out and not isinstance(out["release_date"], str):
        out["release_date"] = out["release_date"].isoformat()

    pricing = raw.get("pricing")
    if isinstance(pricing, dict):
        out["pricing"] = {
            "input_per_1m": pricing.get("inputPer1M"),
            "output_per_1m": pricing.get("outputPer1M"),
        }
    return out


def parse_model_file(path: Path) -> tuple[ModelRecord, str]:
    """Parse one MDX file into a validated record plus its prose body."""
    post = frontmatter.loads(path.read_text(encoding="utf8"))
    try:
        record = ModelRecord.model_validate(_normalize(post.metadata))
    except ValidationError as exc:
        raise ValueError(f"Invalid frontmatter in {path.name}:\n{exc}") from exc

    if record.slug != path.stem:
        raise ValueError(f"Slug mismatch in {path.name}: frontmatter says {record.slug!r}")
    return record, post.content


def chunk_body(body: str, max_chars: int = 1200) -> list[tuple[str | None, str]]:
    """Split an MDX body on H2/H3 headings, then hard-wrap long sections.

    Returns (heading, chunk) pairs so a search hit can cite the section it came from.
    """
    parts: list[tuple[str | None, str]] = []
    current_heading: str | None = None
    buffer: list[str] = []

    def flush() -> None:
        text = "\n".join(buffer).strip()
        if not text:
            return
        # Wrap oversized sections on paragraph boundaries.
        if len(text) <= max_chars:
            parts.append((current_heading, text))
            return
        chunk: list[str] = []
        size = 0
        for para in text.split("\n\n"):
            if size + len(para) > max_chars and chunk:
                parts.append((current_heading, "\n\n".join(chunk)))
                chunk, size = [], 0
            chunk.append(para)
            size += len(para)
        if chunk:
            parts.append((current_heading, "\n\n".join(chunk)))

    for line in body.splitlines():
        heading = re.match(r"^#{2,3}\s+(.*)$", line)
        if heading:
            flush()
            buffer = []
            current_heading = heading.group(1).strip()
            continue
        buffer.append(line)
    flush()
    return parts


def build_db(db_path: Path | None = None, content_dir: Path | None = None) -> int:
    """Rebuild the catalog database. Returns the number of models ingested."""
    settings = get_settings()
    db_path = db_path or settings.db_path
    content_dir = content_dir or settings.content_dir

    files = sorted(content_dir.glob("*.mdx"))
    if not files:
        raise FileNotFoundError(f"No .mdx files found in {content_dir}")

    db_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = db_path.with_suffix(".db.tmp")
    tmp_path.unlink(missing_ok=True)

    conn = sqlite3.connect(tmp_path)
    try:
        conn.executescript(SCHEMA)
        for path in files:
            record, body = parse_model_file(path)
            conn.execute(
                "INSERT INTO models VALUES (?,?,?,?,?,?,?,?,?)",
                (
                    record.slug,
                    record.name,
                    record.provider,
                    record.release_date,
                    record.context_window,
                    record.pricing.input_per_1m if record.pricing else None,
                    record.pricing.output_per_1m if record.pricing else None,
                    record.official_docs,
                    body,
                ),
            )
            for table, values in (
                ("modalities", record.modalities),
                ("availability", record.availability),
                ("strengths", record.strengths),
            ):
                conn.executemany(
                    f"INSERT INTO {table} VALUES (?,?)", [(record.slug, v) for v in values]
                )
            conn.executemany(
                "INSERT INTO benchmarks VALUES (?,?,?,?,?)",
                [(record.slug, b.name, b.score, b.max, b.source) for b in record.benchmarks],
            )
            conn.executemany(
                "INSERT INTO docs_fts VALUES (?,?,?)",
                [(record.slug, heading, chunk) for heading, chunk in chunk_body(body)],
            )
        conn.commit()
    finally:
        conn.close()

    tmp_path.replace(db_path)
    return len(files)


def ensure_db() -> Path:
    """Build the database if it is missing. Returns its path."""
    settings = get_settings()
    if not settings.db_path.exists():
        build_db()
    return settings.db_path
