"""Check API routes with Redis caching."""
from fastapi import APIRouter, Depends, status
from uuid import UUID
from app.services.check_service import CheckService
from app.domain.dto.common import RunCheckRequest, RunCheckResponse, CheckResponse
from app.api.deps import get_check_service
from app.core.cache import get_cache, set_cache, invalidate_cache

router = APIRouter(tags=["Checks"])


@router.post("/check", response_model=RunCheckResponse, status_code=status.HTTP_202_ACCEPTED)
async def run_check(
    data: RunCheckRequest,
    service: CheckService = Depends(get_check_service),
):
    check_id = await service.run_check(data.service_id, data.version)
    await invalidate_cache("checks")
    return RunCheckResponse(check_id=check_id, status="completed")


@router.get("/check/{check_id}", response_model=CheckResponse)
async def get_check(
    check_id: UUID,
    service: CheckService = Depends(get_check_service),
):
    key = f"checks:get:{check_id}"
    cached = await get_cache(key)
    if cached:
        return CheckResponse(**cached)
    result = await service.get_check(check_id)
    await set_cache(key, result.model_dump(mode="json"))
    return result
