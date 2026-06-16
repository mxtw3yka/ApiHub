from pathlib import Path
from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError
from app.core.exceptions import SchemaNotFoundError, DependencyNotFoundError, CheckNotFoundError
from app.domain.dto.common import ErrorResponse
from app.api.routes import schemas, checks, dependencies
from app.db.base import Base
from app.db.session import engine
from app.core.redis import get_redis, close_redis

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    from app.core.redis import ping_redis
    if await ping_redis():
        logger.info("Redis connected")
    else:
        logger.warning("Redis not available — caching disabled")
    yield
    await close_redis()
    await engine.dispose()


app = FastAPI(title="API Contract Platform", lifespan=lifespan)

API_PREFIX = "/api/v1"


@app.exception_handler(SchemaNotFoundError)
async def schema_not_found_handler(request: Request, exc: SchemaNotFoundError):
    return JSONResponse(
        status_code=404,
        content=ErrorResponse(error=str(exc)).model_dump(mode="json"),
    )


@app.exception_handler(DependencyNotFoundError)
async def dependency_not_found_handler(request: Request, exc: DependencyNotFoundError):
    return JSONResponse(
        status_code=404,
        content=ErrorResponse(error=str(exc)).model_dump(mode="json"),
    )


@app.exception_handler(CheckNotFoundError)
async def check_not_found_handler(request: Request, exc: CheckNotFoundError):
    return JSONResponse(
        status_code=404,
        content=ErrorResponse(error=str(exc)).model_dump(mode="json"),
    )


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    return JSONResponse(
        status_code=409,
        content=ErrorResponse(error="Resource already exists", detail=str(exc.orig)).model_dump(mode="json"),
    )



app.include_router(schemas.router, prefix=API_PREFIX)
app.include_router(checks.router, prefix=API_PREFIX)
app.include_router(dependencies.router, prefix=API_PREFIX)

@app.get("/health")
async def health():
    return {"status": "ok"}


static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
