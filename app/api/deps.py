"""FastAPI dependency injection for services."""
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.services.schema_service import SchemaService
from app.services.dependency_service import DependencyService
from app.services.diff_service import DiffService
from app.services.check_service import CheckService
from app.services.contract_service import ContractService


async def get_schema_service(db: AsyncSession = Depends(get_db)) -> SchemaService:
    return SchemaService(db)


async def get_dependency_service(db: AsyncSession = Depends(get_db)) -> DependencyService:
    return DependencyService(db)


async def get_diff_service() -> DiffService:
    return DiffService()


async def get_check_service(
    db: AsyncSession = Depends(get_db),
    schema_service: SchemaService = Depends(get_schema_service),
    diff_service: DiffService = Depends(get_diff_service),
    dependency_service: DependencyService = Depends(get_dependency_service),
) -> CheckService:
    return CheckService(db, schema_service, diff_service, dependency_service)


async def get_contract_service(
    schema_service: SchemaService = Depends(get_schema_service),
    dependency_service: DependencyService = Depends(get_dependency_service),
) -> ContractService:
    return ContractService(schema_service, dependency_service)
