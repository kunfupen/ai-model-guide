"""Pydantic models for tool arguments, catalog records, and the agent's final output.

`ModelRecord` deliberately mirrors `lib/schemas.ts::ModelFrontmatterSchema`. That Zod
schema is the source of truth (it gates `pnpm build`); this is a checked mirror, and
`tests/test_ingest.py` asserts the field sets have not drifted apart.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

Provider = Literal[
    "openai", "anthropic", "google", "microsoft", "meta", "moonshot", "zhipu", "nvidia"
]
Modality = Literal["text", "vision", "audio", "video"]
Availability = Literal[
    "api", "claude-ai", "chatgpt", "gemini-app", "bedrock", "vertex", "azure", "open-weights"
]
SortKey = Literal["name", "newest", "cheapest", "context", "benchmark"]


class Pricing(BaseModel):
    input_per_1m: float = Field(ge=0)
    output_per_1m: float = Field(ge=0)


class Benchmark(BaseModel):
    name: str
    score: float = Field(ge=0)
    max: float = Field(gt=0, default=100)
    source: str | None = None

    @property
    def pct(self) -> float:
        return 100.0 * self.score / self.max


class ModelRecord(BaseModel):
    """One row of the catalog, assembled from MDX frontmatter."""

    slug: str
    name: str
    provider: Provider
    release_date: str
    context_window: int = Field(gt=0)
    modalities: list[Modality]
    pricing: Pricing | None = None
    availability: list[Availability]
    strengths: list[str] = []
    official_docs: str
    benchmarks: list[Benchmark] = []

    def summary(self) -> str:
        price = (
            f"${self.pricing.input_per_1m}/${self.pricing.output_per_1m} per 1M in/out"
            if self.pricing
            else "pricing not published"
        )
        return (
            f"{self.name} ({self.slug}) — {self.provider}, released {self.release_date}, "
            f"{self.context_window:,} ctx, {price}, "
            f"available on {', '.join(self.availability)}, "
            f"strengths: {', '.join(self.strengths) or 'n/a'}"
        )


# ---------------------------------------------------------------------------
# Tool arguments
# ---------------------------------------------------------------------------


class QueryModelsArgs(BaseModel):
    """Filters for the catalog. All fields are optional; omit what you don't need."""

    provider: Provider | None = Field(None, description="Restrict to one provider.")
    min_context: int | None = Field(
        None, description="Minimum context window in tokens, e.g. 500000 for 500K."
    )
    max_input_price: float | None = Field(
        None, description="Maximum USD per 1M input tokens."
    )
    max_output_price: float | None = Field(
        None, description="Maximum USD per 1M output tokens."
    )
    modalities: list[Modality] | None = Field(
        None, description="Model must support ALL of these modalities."
    )
    availability: list[Availability] | None = Field(
        None, description="Model must be available on AT LEAST ONE of these surfaces."
    )
    strengths: list[str] | None = Field(
        None,
        description="Model must list ALL of these strengths, e.g. ['coding', 'reasoning'].",
    )
    benchmark: str | None = Field(
        None, description="Benchmark name to sort by when sort='benchmark', e.g. 'SWE-bench Verified'."
    )
    sort: SortKey = Field("name", description="Ordering for the result set.")
    limit: int = Field(10, ge=1, le=32, description="Maximum rows to return.")


class GetModelArgs(BaseModel):
    slug: str = Field(description="Catalog slug, e.g. 'anthropic-claude-opus-5'.")


class SearchDocsArgs(BaseModel):
    query: str = Field(description="Free-text query against model write-ups.")
    k: int = Field(5, ge=1, le=15, description="Number of snippets to return.")


class EstimateCostArgs(BaseModel):
    slug: str = Field(description="Catalog slug of the model to price.")
    input_tokens_per_month: int = Field(ge=0, description="Monthly input token volume.")
    output_tokens_per_month: int = Field(ge=0, description="Monthly output token volume.")


class CompareCostsArgs(BaseModel):
    slugs: list[str] = Field(min_length=1, max_length=10, description="Slugs to compare.")
    input_tokens_per_month: int = Field(ge=0)
    output_tokens_per_month: int = Field(ge=0)


class CalculateArgs(BaseModel):
    expression: str = Field(
        description="Arithmetic expression, e.g. '(50e6/1e6)*5 + (5e6/1e6)*25'."
    )


class WebSearchArgs(BaseModel):
    query: str = Field(description="Search query.")
    k: int = Field(5, ge=1, le=10)


class FetchUrlArgs(BaseModel):
    url: str = Field(description="Absolute http(s) URL to fetch and convert to text.")


# ---------------------------------------------------------------------------
# Tool results
# ---------------------------------------------------------------------------


class ToolError(BaseModel):
    """Returned to the model (not raised) so it can correct course itself."""

    error: str
    tool: str
    retryable: bool = False
    hint: str | None = None


class CostBreakdown(BaseModel):
    slug: str
    name: str
    input_cost_usd: float
    output_cost_usd: float
    monthly_cost_usd: float
    input_per_1m: float
    output_per_1m: float


class DocSnippet(BaseModel):
    slug: str
    name: str
    heading: str | None
    snippet: str


class SearchHit(BaseModel):
    title: str
    url: str
    snippet: str


# ---------------------------------------------------------------------------
# Final structured output
# ---------------------------------------------------------------------------


class Citation(BaseModel):
    kind: Literal["catalog", "web"]
    ref: str = Field(description="Catalog slug, or an absolute URL for web sources.")
    note: str | None = None


class Pick(BaseModel):
    slug: str = Field(description="Catalog slug. MUST exist in the catalog.")
    name: str
    why: str = Field(description="One or two sentences tied to the user's constraints.")
    monthly_cost_usd: float | None = Field(
        None, description="Only set when the user supplied token volumes."
    )
    caveats: list[str] = []


class Recommendation(BaseModel):
    """The agent's final answer. Every field is validated before it reaches the user."""

    answer: str = Field(description="Direct prose answer, leading with the outcome.")
    picks: list[Pick] = Field(min_length=1, max_length=3)
    assumptions: list[str] = Field(
        default=[], description="Anything you had to assume because the ask was underspecified."
    )
    citations: list[Citation] = []
    confidence: Literal["high", "medium", "low"] = "medium"

    @field_validator("picks")
    @classmethod
    def _unique_slugs(cls, picks: list[Pick]) -> list[Pick]:
        seen = {p.slug for p in picks}
        if len(seen) != len(picks):
            raise ValueError("picks must not repeat the same slug")
        return picks
