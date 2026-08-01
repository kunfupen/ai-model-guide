"""Retry policy, error classification, and the circuit breaker."""

from __future__ import annotations

import json

import httpx
import pytest

from modelpilot.retry import (
    CircuitBreaker,
    CircuitOpen,
    FatalError,
    RetryableError,
    as_tool_error,
    classify_http,
    with_retries,
)
from modelpilot.tools import web


# --- classification ---------------------------------------------------------


@pytest.mark.parametrize(
    "exc,expected",
    [
        (httpx.TimeoutException("timed out"), RetryableError),
        (httpx.ConnectError("refused"), RetryableError),
        (ValueError("bad input"), FatalError),
    ],
)
def test_classify_transport_errors(exc, expected):
    assert isinstance(classify_http(exc), expected)


@pytest.mark.parametrize(
    "status,expected",
    [(429, RetryableError), (500, RetryableError), (503, RetryableError), (404, FatalError), (403, FatalError)],
)
def test_classify_status_codes(status, expected):
    request = httpx.Request("GET", "https://example.com")
    response = httpx.Response(status, request=request)
    exc = httpx.HTTPStatusError("boom", request=request, response=response)
    assert isinstance(classify_http(exc), expected)


# --- retry behavior ---------------------------------------------------------


def test_retryable_errors_are_retried_then_succeed():
    attempts = {"n": 0}

    @with_retries
    def flaky():
        attempts["n"] += 1
        if attempts["n"] < 3:
            raise RetryableError("transient")
        return "ok"

    assert flaky() == "ok"
    assert attempts["n"] == 3


def test_fatal_errors_are_not_retried():
    attempts = {"n": 0}

    @with_retries
    def broken():
        attempts["n"] += 1
        raise FatalError("permanent")

    with pytest.raises(FatalError):
        broken()
    assert attempts["n"] == 1, "a fatal error must fail fast, not burn the retry budget"


def test_retries_give_up_after_the_configured_maximum():
    attempts = {"n": 0}

    @with_retries
    def always_flaky():
        attempts["n"] += 1
        raise RetryableError("still down")

    with pytest.raises(RetryableError):
        always_flaky()
    assert attempts["n"] == 3


# --- circuit breaker --------------------------------------------------------


def test_breaker_opens_after_threshold_and_resets_on_success():
    breaker = CircuitBreaker(threshold=3)
    for _ in range(2):
        breaker.record_failure("web_search")
    breaker.check("web_search")  # still closed

    breaker.record_failure("web_search")
    with pytest.raises(CircuitOpen):
        breaker.check("web_search")

    breaker.record_success("web_search")
    breaker.check("web_search")  # closed again


def test_breaker_is_per_tool():
    breaker = CircuitBreaker(threshold=1)
    breaker.record_failure("fetch_url")
    with pytest.raises(CircuitOpen):
        breaker.check("fetch_url")
    breaker.check("web_search")  # unaffected


# --- what the model actually sees -------------------------------------------


def test_tool_error_marks_retryable_and_fatal_differently():
    assert as_tool_error("web_search", RetryableError("timeout")).retryable is True
    assert as_tool_error("web_search", FatalError("404")).retryable is False


def test_open_circuit_tells_the_model_to_stop_trying():
    err = as_tool_error("web_search", CircuitOpen("web_search is disabled"))
    assert err.retryable is False
    assert "do not call this tool again" in err.hint.lower()


def test_fetch_url_rejects_non_http_schemes():
    result = json.loads(web.fetch_url(url="file:///etc/passwd"))
    assert result["retryable"] is False
    assert "http" in result["error"].lower()


@pytest.mark.parametrize("url", ["http://localhost:8000/admin", "http://169.254.169.254/latest/meta-data/"])
def test_fetch_url_blocks_loopback_and_metadata_hosts(url):
    """A model-supplied URL must not be able to reach the host's own network."""
    result = json.loads(web.fetch_url(url=url))
    assert "not permitted" in result["error"]


def test_network_failure_returns_json_to_the_model_rather_than_raising(monkeypatch):
    def boom(url):
        raise RetryableError("network: ConnectError")

    monkeypatch.setattr(web, "_do_fetch", boom)
    web.BREAKER.failures.clear()

    result = json.loads(web.fetch_url(url="https://example.com"))
    assert result["retryable"] is True
    assert result["tool"] == "fetch_url"
    web.BREAKER.failures.clear()


def test_chaos_mode_produces_retryable_failures(monkeypatch):
    from modelpilot.config import get_settings

    monkeypatch.setenv("MODELPILOT_CHAOS_FAILURE_RATE", "1.0")
    get_settings.cache_clear()
    try:
        with pytest.raises(RetryableError):
            web.maybe_chaos()
    finally:
        get_settings.cache_clear()
