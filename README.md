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
# Зависимости
uv sync

# Настройки
cp app/.env-example app/.env
# заполнить DB_URL, GITHUB_TOKEN и т.д.

# Миграции
alembic upgrade head

# Запуск
uv run uvicorn app.main:app --reload
```

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
