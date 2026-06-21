from app.domain.dto.common import SchemaResponse, CreateSchemaRequest, PaginatedResponse
from app.core.exceptions import SchemaNotFoundError
from sqlalchemy import select, func
from app.models.service import Service
from app.models.schemas import Schema
from uuid import UUID


async def _get_service_name(session, service_id: UUID) -> str:
    result = await session.execute(select(Service.name).where(Service.id == service_id))
    name = result.scalar_one_or_none()
    return name or str(service_id)


def _to_schema_response(schema: Schema, service_name: str) -> SchemaResponse:
    return SchemaResponse(
        id=schema.id,
        service_id=schema.service_id,
        service_name=service_name,
        version=schema.version,
        created_at=schema.created_at,
        spec=schema.spec,
    )


class SchemaService:
    def __init__(self, session):
        self.session = session

    async def create_schema(self, data: CreateSchemaRequest) -> SchemaResponse:
        result = await self.session.execute(select(Service).where(Service.name == data.service_name))
        service = result.scalar_one_or_none()
        if not service:
            service = Service(name=data.service_name)
            self.session.add(service)
            await self.session.commit()

        schema = Schema(
            service_id=service.id,
            version=data.version,
            spec=data.spec,
        )
        self.session.add(schema)
        await self.session.commit()

        return _to_schema_response(schema, service.name)

    async def get_schema(self, schema_id: UUID) -> SchemaResponse:
        schema = await self.session.get(Schema, schema_id)
        if not schema:
            raise SchemaNotFoundError(f"Schema {schema_id} not found")
        service_name = await _get_service_name(self.session, schema.service_id)
        return _to_schema_response(schema, service_name)

    async def list_schemas(
        self, service_name_filter: str | None = None, page: int = 1, size: int = 20
    ) -> PaginatedResponse[SchemaResponse]:
        query = select(Schema)
        if service_name_filter:
            query = query.join(Service).where(Service.name == service_name_filter)
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.session.execute(count_query)).scalar()
        query = query.limit(size).offset((page - 1) * size)
        result = await self.session.execute(query)
        schemas = result.scalars().all()

        # Build a service_id → service_name map
        service_ids = {s.service_id for s in schemas}
        names = {}
        if service_ids:
            rows = await self.session.execute(
                select(Service.id, Service.name).where(Service.id.in_(service_ids))
            )
            names = {row.id: row.name for row in rows}

        return PaginatedResponse(
            items=[
                _to_schema_response(s, names.get(s.service_id, str(s.service_id)))
                for s in schemas
            ],
            total=total,
            page=page,
            size=size,
        )

    async def get_latest_schema(self, service_id: UUID) -> SchemaResponse | None:
        query = (select(Schema).where(Schema.service_id == service_id).order_by(Schema.created_at.desc()).limit(1))
        result = await self.session.execute(query)
        schema = result.scalar_one_or_none()
        if not schema:
            return None
        service_name = await _get_service_name(self.session, service_id)
        return _to_schema_response(schema, service_name)

    async def get_previous_version(self, service_id: UUID, version: str) -> Schema | None:
        query = (select(Schema).where(Schema.service_id == service_id, Schema.version < version).order_by(Schema.created_at.desc()).limit(1))
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

