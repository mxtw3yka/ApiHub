"""Dependency API routes with Redis caching."""
from fastapi import APIRouter, Depends, status
from uuid import UUID
from app.services.dependency_service import DependencyService
from app.services.contract_service import ContractService
from app.domain.dto.common import (
    CreateDependencyRequest,
    DependencyResponse,
    DependencyGraphResponse,
    ServiceBrief,
    ContractResponse,
)
from app.api.deps import get_dependency_service, get_contract_service
from app.core.cache import get_cache, set_cache, invalidate_cache

router = APIRouter(prefix="/dependencies", tags=["Dependencies"])


@router.post("/", response_model=DependencyResponse, status_code=status.HTTP_201_CREATED)
async def create_dependency(
    data: CreateDependencyRequest,
    service: DependencyService = Depends(get_dependency_service),
):
    result = await service.create_dependency(data)
    await invalidate_cache("dependencies")
    return result


@router.get("/", response_model=list[DependencyResponse])
async def list_dependencies(
    service: DependencyService = Depends(get_dependency_service),
):
    """Список всех зависимостей."""
    key = "dependencies:list"
    cached = await get_cache(key)
    if cached:
        return [DependencyResponse(**d) for d in cached]
    result = await service.list_dependencies()
    items = [d.model_dump(mode="json") for d in result.items]
    await set_cache(key, items)
    return result.items

@router.get("/graph", response_model=DependencyGraphResponse)
async def get_dependency_graph(
    service_id: UUID,
    service: DependencyService = Depends(get_dependency_service),
):
    """Граф зависимостей для сервиса."""
    key = f"dependencies:graph:{service_id}"
    cached = await get_cache(key)
    if cached:
        return DependencyGraphResponse(**cached)

    providers_result = await service.list_dependencies(consumer_service_id=service_id)
    consumers = await service.get_consumers(service_id)
    result = DependencyGraphResponse(
        service_id=service_id,
        providers=[ServiceBrief(id=d.provider_service_id, name="") for d in providers_result.items],
        consumers=consumers,
    )
    await set_cache(key, result.model_dump(mode="json"))
    return result


@router.get("/{dependency_id}", response_model=DependencyResponse)
async def get_dependency(
    dependency_id: UUID,
    service: DependencyService = Depends(get_dependency_service),
):
    key = f"dependencies:get:{dependency_id}"
    cached = await get_cache(key)
    if cached:
        return DependencyResponse(**cached)
    result = await service.get_dependency(dependency_id)
    await set_cache(key, result.model_dump(mode="json"))
    return result


@router.delete("/{dependency_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_dependency(
    dependency_id: UUID,
    service: DependencyService = Depends(get_dependency_service),
):
    await service.delete_dependency(dependency_id)
    await invalidate_cache("dependencies")


@router.get("/{dependency_id}/contract", response_model=ContractResponse)
async def get_contract(
    dependency_id: UUID,
    service: ContractService = Depends(get_contract_service),
):
    """Сравнение контракта provider/consumer для зависимости."""
    return await service.get_contract(dependency_id)
