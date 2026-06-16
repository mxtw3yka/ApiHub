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
