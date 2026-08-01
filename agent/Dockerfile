# The agent needs the catalog, which lives one level up in content/models/.
# Build from the REPOSITORY ROOT, not from agent/:
#     docker build -f agent/Dockerfile -t modelpilot .
FROM python:3.11-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Dependencies first, so edits to source don't invalidate the install layer.
COPY agent/pyproject.toml agent/uv.lock* agent/README.md ./
RUN uv sync --no-dev --no-install-project

COPY agent/src ./src
COPY agent/evals ./evals
COPY content/models /content/models

RUN uv sync --no-dev

# Bake the database into the image so the first request isn't slowed by ingest.
ENV MODELPILOT_CONTENT_DIR=/content/models \
    MODELPILOT_DB_PATH=/app/data/catalog.db \
    MODELPILOT_CHECKPOINT_PATH=/app/data/checkpoints.db \
    PYTHONUNBUFFERED=1
RUN uv run modelpilot ingest

EXPOSE 8000
CMD ["sh", "-c", "uv run uvicorn modelpilot.server:app --host 0.0.0.0 --port ${PORT:-8000}"]
