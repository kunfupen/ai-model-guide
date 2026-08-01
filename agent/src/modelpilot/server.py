"""FastAPI backend for the web demo.

Streams the agent's trace over SSE so the page can render steps as they happen. The
public endpoint is rate-limited and budget-capped — it runs on a personal API key.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from collections import defaultdict, deque
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from . import db
from .config import get_settings
from .graph import build_graph, initial_state, make_checkpointer
from .ingest import ensure_db

log = logging.getLogger("modelpilot.server")

_requests: dict[str, deque[float]] = defaultdict(deque)
_daily = {"date": time.strftime("%Y-%m-%d"), "count": 0}


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_db()
    app.state.checkpointer = make_checkpointer()
    app.state.graph = build_graph(checkpointer=app.state.checkpointer)
    log.info("catalog ready: %s", db.catalog_stats())
    yield


app = FastAPI(title="ModelPilot", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # the Next.js route handler proxies; no credentials are sent
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    question: str = Field(min_length=3, max_length=1000)
    thread_id: str | None = None


def _rate_limited(client: str) -> str | None:
    settings = get_settings()
    now = time.monotonic()
    window = _requests[client]
    while window and now - window[0] > 60:
        window.popleft()
    if len(window) >= settings.rate_limit_per_minute:
        return "Rate limit reached — this is a personal demo. Try again in a minute."
    window.append(now)

    today = time.strftime("%Y-%m-%d")
    if _daily["date"] != today:
        _daily.update(date=today, count=0)
    if _daily["count"] >= settings.daily_query_budget:
        return "The demo's daily budget is spent. Try the CLI, or check back tomorrow."
    _daily["count"] += 1
    return None


@app.get("/health")
async def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "model": settings.model,
        "anthropic_configured": settings.anthropic_configured,
        "catalog": db.catalog_stats(),
    }


# response_model=None: the handler returns either an SSE stream or a JSON error, and
# FastAPI would otherwise try to build a Pydantic response model from that union.
@app.post("/chat", response_model=None)
async def chat(req: ChatRequest, request: Request) -> EventSourceResponse | JSONResponse:
    client = request.client.host if request.client else "unknown"
    if message := _rate_limited(client):
        return JSONResponse({"error": message}, status_code=429)

    thread_id = req.thread_id or str(uuid.uuid4())
    config = {"configurable": {"thread_id": thread_id}}
    existing = request.app.state.checkpointer.get(config)
    state = {"messages": [("user", req.question)]} if existing else initial_state(req.question)

    async def events():
        yield {"event": "start", "data": json.dumps({"thread_id": thread_id})}
        seen: set[str] = set()
        final = None
        try:
            # graph.stream is sync; run it off the event loop so SSE keeps flowing.
            queue: asyncio.Queue = asyncio.Queue()
            loop = asyncio.get_running_loop()

            def produce():
                try:
                    for event in request.app.state.graph.stream(
                        state, config=config, stream_mode="values"
                    ):
                        loop.call_soon_threadsafe(queue.put_nowait, event)
                except Exception as exc:  # noqa: BLE001 - surfaced to the client below
                    loop.call_soon_threadsafe(queue.put_nowait, exc)
                finally:
                    loop.call_soon_threadsafe(queue.put_nowait, None)

            # Kick off the producer without awaiting it, so events flow as they arrive.
            producer = loop.run_in_executor(None, produce)

            while (item := await queue.get()) is not None:
                if isinstance(item, Exception):
                    raise item
                final = item
                messages = item.get("messages", [])
                if not messages:
                    continue
                last = messages[-1]
                if last.type == "ai":
                    if isinstance(last.content, str) and last.content.strip():
                        yield {
                            "event": "thought",
                            "data": json.dumps({"text": last.content.strip()}),
                        }
                    for call in getattr(last, "tool_calls", []) or []:
                        if call["id"] in seen:
                            continue
                        seen.add(call["id"])
                        yield {
                            "event": "tool_call",
                            "data": json.dumps({"name": call["name"], "args": call.get("args", {})}),
                        }
                elif last.type == "tool":
                    content = str(last.content)
                    yield {
                        "event": "tool_result",
                        "data": json.dumps(
                            {
                                "name": getattr(last, "name", "?"),
                                "preview": content[:500],
                                "is_error": '"error"' in content,
                            }
                        ),
                    }

            await producer  # surface any error the worker thread swallowed

            if final and final.get("recommendation"):
                yield {
                    "event": "recommendation",
                    "data": final["recommendation"].model_dump_json(),
                }
                yield {"event": "done", "data": json.dumps({"budget": final["budget"]})}
            else:
                yield {"event": "error", "data": json.dumps({"error": "no recommendation"})}
        except Exception as exc:  # noqa: BLE001
            log.exception("stream failed")
            yield {"event": "error", "data": json.dumps({"error": str(exc)})}

    return EventSourceResponse(events())
