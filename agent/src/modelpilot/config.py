"""Runtime configuration, loaded from the environment."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# agent/src/modelpilot/config.py -> agent/
AGENT_ROOT = Path(__file__).resolve().parents[2]
# -> repo root, where content/models/*.mdx lives
REPO_ROOT = AGENT_ROOT.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="MODELPILOT_",
        env_file=AGENT_ROOT / ".env",
        extra="ignore",
    )

    # Anthropic. `claude-opus-5` is the default; `claude-haiku-4-5` ($1/$5) makes
    # eval sweeps cheap. Note: temperature/top_p/top_k are rejected with a 400 on
    # Opus 5 — never set them on the chat model.
    model: str = "claude-opus-5"
    max_tokens: int = 8192

    # Where the catalog lives and where we materialize it.
    content_dir: Path = REPO_ROOT / "content" / "models"
    db_path: Path = AGENT_ROOT / "data" / "catalog.db"
    checkpoint_path: Path = AGENT_ROOT / "data" / "checkpoints.db"

    # Agent budgets. The loop is capped so a confused model cannot spend forever.
    max_steps: int = 12
    max_tool_calls: int = 24

    # HTTP + retries.
    http_timeout_s: float = 15.0
    max_retries: int = 3
    circuit_breaker_threshold: int = 3

    # Public demo guardrails.
    rate_limit_per_minute: int = 6
    daily_query_budget: int = 200

    # Chaos testing: probability that fetch_url raises a retryable error.
    chaos_failure_rate: float = 0.0

    @property
    def anthropic_configured(self) -> bool:
        import os

        return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
