"""API surface checks.

Importing the app is itself the most valuable assertion here: a bad response-model
annotation makes FastAPI raise at import time, which would only surface on deploy.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from modelpilot.server import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_app_imports_and_routes_are_registered():
    paths = {route.path for route in app.routes}
    assert {"/health", "/chat"} <= paths


def test_health_reports_catalog_contents(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["catalog"]["models"] > 0
    assert "anthropic" in body["catalog"]["providers"]


@pytest.mark.parametrize("question", ["", "hi", "x" * 1001])
def test_chat_rejects_out_of_range_questions(client, question):
    assert client.post("/chat", json={"question": question}).status_code == 422


def test_rate_limit_returns_429_not_a_crash(client, monkeypatch):
    from modelpilot import server

    monkeypatch.setattr(server, "_requests", type(server._requests)(server._requests.default_factory))
    monkeypatch.setattr(
        server.get_settings(), "rate_limit_per_minute", 0, raising=False
    )
    response = client.post("/chat", json={"question": "which model should I use?"})
    assert response.status_code == 429
    assert "error" in response.json()
