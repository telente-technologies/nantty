# syntax=docker/dockerfile:1.7
FROM python:3.14-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:0.12.20 /uv /uvx /bin/
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv
WORKDIR /app
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-dev --no-install-project
COPY pyproject.toml uv.lock README.md ./
COPY src ./src
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-editable

FROM python:3.14-slim AS runtime
ENV PATH="/app/.venv/bin:${PATH}" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    INTELLIGENCE_HOST=0.0.0.0 \
    INTELLIGENCE_PORT=8090 \
    INTELLIGENCE_ENVIRONMENT=production \
    INTELLIGENCE_EVENT_STORAGE_URI=/app/data \
    INTELLIGENCE_MODEL_REGISTRY_PATH=/app/model_registry \
    OMP_NUM_THREADS=2
RUN apt-get update \
    && apt-get install -y --no-install-recommends libzstd1 \
    && rm -rf /var/lib/apt/lists/* \
    && python -m pip uninstall --yes --quiet pip \
    && groupadd --system --gid 10001 intelligence \
    && useradd --system --uid 10001 --gid intelligence --home-dir /app --shell /usr/sbin/nologin intelligence
WORKDIR /app
COPY --from=builder /app /app
RUN mkdir -p /app/data /app/model_registry && chown -R 10001:10001 /app/data /app/model_registry
USER 10001
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8090/health/live', timeout=2).status == 200 else 1)"]
CMD ["nantty-intelligence-serve"]
