FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml uv.lock ./
COPY app/ ./app/
COPY alembic.ini ./
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN pip install uv && \
    uv sync --frozen --no-dev && \
    chmod +x /docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
