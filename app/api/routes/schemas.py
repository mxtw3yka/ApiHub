"""Schema API routes with Redis caching."""
from fastapi import APIRouter, Depends, status, HTTPException
from uuid import UUID
from app.services.schema_service import SchemaService
from app.services.diff_service import DiffService
from app.domain.dto.common import (
    CreateSchemaRequest,
    SchemaResponse,
    PaginatedResponse,
    DiffResponse,
)
from app.api.deps import get_schema_service, get_diff_service
from app.db.session import get_db
from app.core.cache import get_cache, set_cache, invalidate_cache

router = APIRouter(prefix="/schemas", tags=["Schemas"])


@router.post("/", response_model=SchemaResponse, status_code=status.HTTP_201_CREATED)
async def create_schema(
    data: CreateSchemaRequest,
    service: SchemaService = Depends(get_schema_service),
):
    result = await service.create_schema(data)
    await invalidate_cache("schemas:list")
    return result


@router.get("/{schema_id}", response_model=SchemaResponse)
async def get_schema(
    schema_id: UUID,
    service: SchemaService = Depends(get_schema_service),
):
    key = f"schemas:get:{schema_id}"
    cached = await get_cache(key)
    if cached:
        return SchemaResponse(**cached)
    result = await service.get_schema(schema_id)
    await set_cache(key, result.model_dump(mode="json"))
    return result


@router.get("/", response_model=PaginatedResponse[SchemaResponse])
async def list_schemas(
    page: int = 1,
    size: int = 20,
    service: SchemaService = Depends(get_schema_service),
):
    key = f"schemas:list:page={page}:size={size}"
    cached = await get_cache(key)
    if cached:
        return PaginatedResponse[SchemaResponse](**cached)
    result = await service.list_schemas(page=page, size=size)
    await set_cache(key, result.model_dump(mode="json"))
    return result


@router.get("/{schema_id}/diff", response_model=DiffResponse)
async def diff_schema(
    schema_id: UUID,
    schema_service: SchemaService = Depends(get_schema_service),
    diff_service: DiffService = Depends(get_diff_service),
    db=Depends(get_db),
):
    key = f"schemas:diff:{schema_id}"
    cached = await get_cache(key)
    if cached:
        return DiffResponse(**cached)

    from app.models.schemas import Schema as SchemaModel
    schema = await db.get(SchemaModel, schema_id)
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found")
    old_schema = await schema_service.get_previous_version(schema.service_id, schema.version)
    if not old_schema:
        raise HTTPException(status_code=404, detail="Previous version not found")
    changes = await diff_service.diff(old_schema.spec, schema.spec)
    result = DiffResponse(
        old_version=old_schema.version,
        new_version=schema.version,
        compatible=all(c.severity.value != "critical" for c in changes),
        changes=changes,
    )
    await set_cache(key, result.model_dump(mode="json"))
    return result
