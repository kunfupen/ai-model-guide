"""Retry policy and error taxonomy for the network-facing tools.

Two ideas carry the whole file:
  1. Errors are classified retryable / fatal. Only retryable ones get backoff.
  2. A tool failure is never raised into the graph — it is returned to the model as a
     structured `ToolError`, so the agent can pick a different approach instead of the
     run dying.
"""

from __future__ import annotations

import logging
import random
from dataclasses import dataclass, field

import httpx
from tenacity import (
    RetryCallState,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from .config import get_settings
from .schemas import ToolError

log = logging.getLogger("modelpilot.retry")


class RetryableError(RuntimeError):
    """Transient: timeouts, connection resets, 429, 5xx."""


class FatalError(RuntimeError):
    """Permanent: 4xx other than 429, malformed input, blocked host."""


class CircuitOpen(RuntimeError):
    """Raised when a tool has failed too many times in a row this session."""


def classify_http(exc: Exception) -> Exception:
    """Map an httpx exception onto our taxonomy."""
    if isinstance(exc, (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError)):
        return RetryableError(f"network: {type(exc).__name__}: {exc}")
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status == 429 or status >= 500:
            return RetryableError(f"HTTP {status} from {exc.request.url.host}")
        return FatalError(f"HTTP {status} from {exc.request.url.host}")
    return FatalError(f"{type(exc).__name__}: {exc}")


def _log_retry(state: RetryCallState) -> None:
    log.warning(
        "retrying %s (attempt %d) after %s",
        state.fn.__name__ if state.fn else "call",
        state.attempt_number,
        state.outcome.exception() if state.outcome else "unknown",
    )


def with_retries(fn):
    """Exponential backoff with jitter on RetryableError only."""
    settings = get_settings()
    return retry(
        retry=retry_if_exception_type(RetryableError),
        stop=stop_after_attempt(settings.max_retries),
        wait=wait_exponential_jitter(initial=0.5, max=8.0),
        before_sleep=_log_retry,
        reraise=True,
    )(fn)


@dataclass
class CircuitBreaker:
    """Per-session breaker. After N consecutive failures a tool stops being tried.

    The agent is told the tool is unavailable rather than being left to burn its step
    budget on a dependency that is down.
    """

    threshold: int = field(default_factory=lambda: get_settings().circuit_breaker_threshold)
    failures: dict[str, int] = field(default_factory=dict)

    def is_open(self, tool: str) -> bool:
        return self.failures.get(tool, 0) >= self.threshold

    def record_failure(self, tool: str) -> None:
        self.failures[tool] = self.failures.get(tool, 0) + 1

    def record_success(self, tool: str) -> None:
        self.failures.pop(tool, None)

    def check(self, tool: str) -> None:
        if self.is_open(tool):
            raise CircuitOpen(
                f"{tool} failed {self.failures[tool]} times in a row and is disabled "
                "for this session. Answer from the catalog instead."
            )


def as_tool_error(tool: str, exc: Exception) -> ToolError:
    """Convert any exception into the payload the model sees."""
    if isinstance(exc, CircuitOpen):
        return ToolError(
            error=str(exc),
            tool=tool,
            retryable=False,
            hint="Do not call this tool again; use the catalog tools.",
        )
    if isinstance(exc, RetryableError):
        return ToolError(
            error=str(exc),
            tool=tool,
            retryable=True,
            hint="Transient failure after retries. Try a different source or continue without it.",
        )
    return ToolError(
        error=str(exc),
        tool=tool,
        retryable=False,
        hint="Check the arguments against the tool's schema before trying again.",
    )


def maybe_chaos() -> None:
    """Inject a synthetic failure when `--chaos` is on, so the retry path is demoable."""
    rate = get_settings().chaos_failure_rate
    if rate > 0 and random.random() < rate:
        raise RetryableError("chaos: injected transient network failure")
