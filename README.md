# API Contract Platform

Отслеживает совместимость API-контрактов между микросервисами. При изменении спецификации OpenAPI сервиса платформа анализирует, какие потребители затронуты, и показывает breaking changes до деплоя.

## Стек

- **FastAPI** — API-сервер
- **PostgreSQL** — основная БД
- **Redis** — кэширование
- **SQLAlchemy** + **Alembic** — ORM и миграции
- **DeepDiff** — анализ изменений OpenAPI-спецификаций

## Структура

```
app/
├── api/routes/       # Эндпоинты (schemas, checks, dependencies)
├── core/             # Конфиг, зависимости
├── db/               # Подключение к БД, миграции
├── domain/           # DTO, enums, модели
├── models/           # SQLAlchemy модели
├── services/         # Бизнес-логика (diff, деплои и т.д.)
├── static/           # Фронтенд (дашборд)
└── main.py           # Точка входа
```

## Быстрый старт

```bash
# Зависимости (Python)
uv sync

# Настройки
cp app/.env-example app/.env
# заполнить DB_URL, GITHUB_TOKEN и т.д.

# Фронтенд (Vite + React + React Flow)
cd frontend && npm install && cd ..

# Активация pre-commit hook (проверка API-контрактов перед коммитом)
./setup.sh

# Миграции
alembic upgrade head

# Запуск (Python сервер + React фронтенд)
uv run uvicorn app.main:app --reload
```

### Фронтенд

Стек: Vite + React + TypeScript + React Flow (граф зависимостей) + React Bits (анимации).

Фичи:
- **Стеклянная тема** (glassmorphism) с blur-эффектами и адаптивной цветовой схемой
- **Граф зависимостей** с белыми нитевидными рёбрами (bezier + glow), перетаскиванием нод и dagre-раскладкой
- **Анимации**: fade-in при скролле (ScrollTrigger), glow-эффекты на карточках статистики, анимированные счётчики
- **Панели деталей** сервиса и контракта с side-by-side сравнением типов

```bash
# Разработка — Vite dev server с прокси на /api
cd frontend && npm run dev

# Сборка — результат в app/static/
cd frontend && npm run build
```

При `docker compose up -d` фронтенд собирается и встраивается в образ автоматически (multi-stage Dockerfile).

## CLI (`api-contract`)

Тонкий клиент для работы с платформой. Установлен в `.venv`, запуск через `uv run`:

```bash
uv run api-contract --help
```

### `push` — загрузить spec на платформу

Проверяет совместимость с предыдущей версией и показывает breaking changes.

```bash
# Из файла
uv run api-contract push openapi.yaml --service user-svc
uv run api-contract push openapi.json --service user-svc

# Из URL работающего сервиса (автодетект: /openapi.json → /v3/api-docs → /swagger/v1/swagger.json)
uv run api-contract push http://service:8000 --service user-svc

# С нужной версией (по-умолчанию — info.version из spec)
uv run api-contract push http://service:8000 --service user-svc --version 2.0.0

# С авторизацией (можно несколько -H)
uv run api-contract push http://service:8000 --service user-svc \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-API-Key: secret123"

# С HTML-отчётом
uv run api-contract push http://service:8000 --service user-svc --html report.html
```

### `diff` — сравнить две спецификации

```bash
uv run api-contract diff old.yaml new.yaml
uv run api-contract diff old.yaml new.yaml --html diff.html
```

### `check` — проверка совместимости загруженной версии

```bash
uv run api-contract check <service_id> <version>
uv run api-contract check <service_id> <version> --html report.html
```

### `ps` — список всех сервисов на платформе

```bash
uv run api-contract ps
```

### Опции для всех команд

| Флаг | По-умолчанию | Описание |
|------|-------------|----------|
| `--server` | `http://localhost:8000` | URL платформы |
| `--html` | — | Сохранить результат в HTML-отчёт |

## Демо-стенд

Три mock-сервиса на разных портах — каждый имитирует свой фреймворк и свой автодетект-путь.

```bash
# Запуск моков
cd demo && docker compose up -d

# Пуш всех трёх спецификаций
bash demo/push-all.sh

# Остановка
cd demo && docker compose down
```

| Сервис | Порт | Путь автодетекта | Язык (имитация) |
|--------|------|-----------------|-----------------|
| `demo-python-petstore` | 8001 | `/openapi.json` | FastAPI |
| `demo-java-orders` | 8002 | `/v3/api-docs` | Spring Boot 3 |
| `demo-go-users` | 8003 | `/swagger/doc.json` | Gin (Go) |

Каждый сервис — отдельный OpenAPI-спек с разными эндпоинтами. При первом запуске все три попадут на платформу. Повторный `push-all.sh` покажет breaking changes (версии уже зафиксированы).

## GitHub Action

Push OpenAPI spec automatically on every push:

```yaml
# .github/workflows/api-contract-push.yml
name: API Contract Check

on:
  push:
    branches: [main]
    paths:
      - '**/*.yaml'
      - '**/*.yml'
      - '**/*.json'

jobs:
  push-spec:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Push OpenAPI spec
        uses: ./.github/actions/push
        with:
          spec_path: api-contract-spec.yaml
          service: API Contract Platform
          server: ${{ secrets.API_CONTRACT_SERVER }}
```

### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `spec_path` | ✅ | — | Path to OpenAPI spec file or URL |
| `service` | ✅ | — | Service name on the platform |
| `server` | — | `http://localhost:8000` | Platform server URL |
| `version` | — | info.version | Spec version override |
| `headers` | — | `{}` | JSON object of HTTP headers |
| `html_path` | — | — | Path to save HTML report |

### Secrets

Set `API_CONTRACT_SERVER` in your repo → Settings → Secrets and variables → Actions.

For authenticated endpoints:

```yaml
- uses: ./.github/actions/push
  with:
    spec_path: http://service:8000
    service: my-service
    headers: '{"Authorization": "Bearer ${{ secrets.API_TOKEN }}"}'
```

## API

| Метод | Путь | Описание |
|--------|------|----------|
| `POST` | `/api/v1/schemas/` | Загрузить новую схему |
| `GET` | `/api/v1/schemas/` | Список схем |
| `GET` | `/api/v1/schemas/{id}/diff` | Diff между версиями |
| `POST` | `/api/v1/dependencies/` | Создать зависимость |
| `GET` | `/api/v1/dependencies/graph` | Граф зависимостей |
| `POST` | `/api/v1/check` | Запустить проверку совместимости |
| `GET` | `/api/v1/check/{id}` | Результат проверки |

## Разработка

```bash
# Тесты
uv run pytest

# Форматирование
uv run ruff check app/
```
