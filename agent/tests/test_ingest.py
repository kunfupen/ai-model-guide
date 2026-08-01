"""Ingest correctness, plus a drift check against the TypeScript schema."""

from __future__ import annotations

import re

import pytest

from modelpilot import db
from modelpilot.config import get_settings
from modelpilot.ingest import chunk_body, parse_model_file
from modelpilot.schemas import ModelRecord

REPO_ROOT = get_settings().content_dir.parents[1]


def test_every_model_file_parses():
    files = sorted(get_settings().content_dir.glob("*.mdx"))
    assert files, "no catalog files found"
    for path in files:
        record, body = parse_model_file(path)
        assert record.slug == path.stem
        assert body.strip(), f"{path.name} has an empty body"


def test_db_row_count_matches_files():
    files = list(get_settings().content_dir.glob("*.mdx"))
    assert db.catalog_stats()["models"] == len(files)


def test_schema_has_not_drifted_from_zod():
    """`lib/schemas.ts` is the source of truth; this Pydantic model mirrors it.

    If someone adds a field to the Zod schema without adding it here, ingest would
    silently drop it. Fail loudly instead.
    """
    zod = (REPO_ROOT / "lib" / "schemas.ts").read_text(encoding="utf8")
    block = zod.split("export const ModelFrontmatterSchema", 1)[1].split("export type", 1)[0]

    # Top-level keys of the Zod object literal, e.g. `  contextWindow: z.number()`.
    zod_fields = set(re.findall(r"^  (\w+):", block, flags=re.MULTILINE))

    camel_to_snake = {
        "releaseDate": "release_date",
        "contextWindow": "context_window",
        "officialDocs": "official_docs",
    }
    expected = {camel_to_snake.get(f, f) for f in zod_fields}
    # `tweetIds` is presentational; the agent has no use for it.
    expected.discard("tweetIds")

    missing = expected - set(ModelRecord.model_fields)
    assert not missing, (
        f"lib/schemas.ts has fields the Python mirror is missing: {sorted(missing)}. "
        "Update modelpilot.schemas.ModelRecord and ingest.FIELD_MAP."
    )


def test_pricing_is_mapped_from_camelcase_frontmatter():
    record = db.get_model("anthropic-claude-opus-5")
    assert record is not None
    assert record.pricing is not None
    assert record.pricing.input_per_1m == 5
    assert record.pricing.output_per_1m == 25


def test_benchmarks_are_ingested():
    record = db.get_model("openai-gpt-5-6-sol")
    assert record is not None
    names = {b.name for b in record.benchmarks}
    assert "SWE-bench Verified" in names


@pytest.mark.parametrize(
    "body,expected_headings",
    [
        ("## One\ntext\n\n## Two\nmore", ["One", "Two"]),
        ("intro text\n\n## Only\nbody", [None, "Only"]),
    ],
)
def test_chunk_body_splits_on_headings(body, expected_headings):
    assert [h for h, _ in chunk_body(body)] == expected_headings


def test_chunk_body_wraps_long_sections():
    long_body = "## Big\n" + "\n\n".join("paragraph " * 30 for _ in range(6))
    chunks = chunk_body(long_body, max_chars=400)
    assert len(chunks) > 1
    assert all(h == "Big" for h, _ in chunks)
