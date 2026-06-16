from app.domain.dto.common import CreateDependencyRequest, DependencyResponse, PaginatedResponse, ServiceBrief
from app.core.exceptions import SchemaNotFoundError, DependencyNotFoundError
from app.models.dependency import Dependency
from app.models.service import Service
from sqlalchemy import select, func
from uuid import UUID

class DependencyService:
    def __init__(self, session):
        self.session = session

    async def create_dependency(self, data: CreateDependencyRequest) -> DependencyResponse:
        query = (select(Service).where(Service.id == data.consumer_service_id))
        result = await self.session.execute(query)
        consumer = result.scalar_one_or_none()
        if not consumer:
            raise SchemaNotFoundError(f'Consumer service {data.consumer_service_id} not found')
        query = (select(Service).where(Service.id == data.provider_service_id))
        result = await self.session.execute(query)
        provider = result.scalar_one_or_none()
        if not provider:
            raise SchemaNotFoundError(f'Provider service {data.provider_service_id} not found')
        dependency = Dependency(
            consumer_service_id = data.consumer_service_id,
            provider_service_id = data.provider_service_id,
            provider_constraint = data.provider_constraint,
            endpoints = data.endpoints,
        )
        self.session.add(dependency)
        await self.session.commit()
        return DependencyResponse.model_validate(dependency)
    
    async def get_dependency(self, dependency_id) -> DependencyResponse:
        dependency = await self.session.get(Dependency, dependency_id)
        if not dependency:
            raise DependencyNotFoundError(f'Dependency {dependency_id} not found')
        return DependencyResponse.model_validate(dependency)
    
    async def list_dependencies(self, consumer_service_id: UUID | None = None, provider_service_id: UUID | None = None, page: int = 1, size: int = 20) -> PaginatedResponse[DependencyResponse]:
        query = select(Dependency)
        if consumer_service_id:
            query = query.where(Dependency.consumer_service_id == consumer_service_id)
        if provider_service_id:
            query = query.where(Dependency.provider_service_id == provider_service_id)
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.session.execute(count_query)).scalar()
        query = query.limit(size).offset((page - 1) * size)
        result = await self.session.execute(query)
        dependencies = result.scalars().all()
        return PaginatedResponse(
            items=[DependencyResponse.model_validate(d) for d in dependencies],
            total=total,
            page=page,
            size=size
        )

    async def delete_dependency(self, dependency_id: UUID) -> None:
        dependency = await self.session.get(Dependency, dependency_id)
        if not dependency:
            raise DependencyNotFoundError(f'Dependency {dependency_id} not found')
        await self.session.delete(dependency)
        await self.session.commit()

    async def get_consumers(self, service_id: UUID) -> list[ServiceBrief]:
        query = (
            select(Service)
            .join(Dependency, Service.id == Dependency.consumer_service_id)
            .where(Dependency.provider_service_id == service_id)
        )
        result = await self.session.execute(query)
        services = result.scalars().all()
        return [ServiceBrief.model_validate(s) for s in services]