# 阶段一：安装依赖（uv 官方镜像）
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim AS builder
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen

# 阶段二：运行镜像
FROM python:3.14-slim
WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY app ./app

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 38080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "38080"]
