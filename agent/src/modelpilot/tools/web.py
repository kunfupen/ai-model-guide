"""Network-facing tools — where the retry, timeout, and circuit-breaker logic earns its keep.

The catalog is a snapshot, so the agent needs a way to check whether something newer
exists. That means talking to the open internet, which fails in all the usual ways.
"""

from __future__ import annotations

import json
import logging

import httpx
from selectolax.parser import HTMLParser

from ..config import get_settings
from ..retry import (
    CircuitBreaker,
    FatalError,
    as_tool_error,
    classify_http,
    maybe_chaos,
    with_retries,
)
from ..schemas import FetchUrlArgs, SearchHit, WebSearchArgs

log = logging.getLogger("modelpilot.web")

# One breaker per process; the CLI and each server request share it deliberately, so a
# hard-down dependency stops being retried across the whole session.
BREAKER = CircuitBreaker()

BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254"}


@with_retries
def _do_search(query: str, k: int) -> list[SearchHit]:
    maybe_chaos()
    try:
        from ddgs import DDGS

        with DDGS() as ddgs:
            raw = list(ddgs.text(query, max_results=k))
    except ImportError as exc:
        raise FatalError(f"search backend unavailable: {exc}") from exc
    except Exception as exc:
        raise classify_http(exc) from exc

    return [
        SearchHit(
            title=r.get("title", ""),
            url=r.get("href") or r.get("url", ""),
            snippet=(r.get("body") or "")[:400],
        )
        for r in raw
    ]


def web_search(**kwargs) -> str:
    """Search the web for information newer than the catalog."""
    try:
        args = WebSearchArgs.model_validate(kwargs)
        BREAKER.check("web_search")
        hits = _do_search(args.query, args.k)
    except Exception as exc:
        BREAKER.record_failure("web_search")
        return as_tool_error("web_search", exc).model_dump_json()

    BREAKER.record_success("web_search")
    return json.dumps(
        {
            "count": len(hits),
            "results": [h.model_dump() for h in hits],
            "note": "Web results are unverified. Prefer the catalog, and flag anything "
            "you take from here as a web citation.",
        }
    )


@with_retries
def _do_fetch(url: str) -> str:
    maybe_chaos()
    settings = get_settings()
    try:
        with httpx.Client(
            timeout=settings.http_timeout_s,
            follow_redirects=True,
            headers={"user-agent": "ModelPilot/0.1 (+https://github.com/kunfupen/ai-model-guide)"},
        ) as client:
            response = client.get(url)
            response.raise_for_status()
            return response.text
    except Exception as exc:
        raise classify_http(exc) from exc


def _to_text(html: str, limit: int = 4000) -> str:
    tree = HTMLParser(html)
    for tag in tree.css("script, style, nav, footer, noscript"):
        tag.decompose()
    body = tree.body or tree.root
    text = body.text(separator="\n", strip=True) if body else ""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)[:limit]


def fetch_url(**kwargs) -> str:
    """Fetch a URL and return its readable text."""
    try:
        args = FetchUrlArgs.model_validate(kwargs)
        parsed = httpx.URL(args.url)
        if parsed.scheme not in ("http", "https"):
            raise FatalError("only http(s) URLs are allowed")
        if parsed.host in BLOCKED_HOSTS:
            raise FatalError(f"host {parsed.host!r} is not permitted")

        BREAKER.check("fetch_url")
        html = _do_fetch(args.url)
    except Exception as exc:
        BREAKER.record_failure("fetch_url")
        return as_tool_error("fetch_url", exc).model_dump_json()

    BREAKER.record_success("fetch_url")
    return json.dumps({"url": args.url, "text": _to_text(html)})


WEB_SEARCH_DESCRIPTION = """\
Search the public web. Call this ONLY when the catalog cannot answer the question — \
typically to check whether a model newer than the catalog exists, or to verify a claim \
the user makes about a model you cannot find. The catalog is the source of truth for \
anything it contains; web results are unverified and must be cited as web sources."""

FETCH_URL_DESCRIPTION = """\
Fetch an http(s) URL and return its readable text. Use it to read a specific page you \
found via web_search or a model's official docs URL from the catalog. Returns the first \
few thousand characters only."""
