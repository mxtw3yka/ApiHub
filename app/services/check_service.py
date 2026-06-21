from uuid import UUID
from app.services.schema_service import SchemaService
from app.services.diff_service import DiffService
from app.services.dependency_service import DependencyService
from app.core.exceptions import SchemaNotFoundError, CheckNotFoundError
from app.domain.dto.enums import Severity, CheckStatus
from app.domain.dto.common import CheckResponse, CheckResult, Change, ServiceBrief
from app.models.check import Check
from app.models.schemas import Schema
from sqlalchemy import select
import time

class CheckService:
    def __init__(self, session, schema_service: SchemaService, diff_service: DiffService, dependency_service: DependencyService):
        self.schema_service = schema_service
        self.diff_service = diff_service
        self.dependency_service = dependency_service
        self.session = session

    async def list_checks(self, limit: int = 20) -> list[CheckResponse]:
        query = select(Check).order_by(Check.created_at.desc()).limit(limit)
        result = await self.session.execute(query)
        checks = result.scalars().all()
        return [
            CheckResponse(
                id=c.id,
                status=c.status,
                result=CheckResult(
                    compatible=c.result['compatible'],
                    changes=[Change(**ch) for ch in c.result['changes']],
                    affected_consumers=[ServiceBrief(**s) for s in c.result.get('affected_consumers', [])],
                ) if c.result else None,
                created_at=c.created_at,
            )
            for c in checks
        ]

    async def run_check(self, service_id: UUID, version: str) -> UUID:
        start = time.monotonic()
        result = await self.session.execute(select(Schema).where(Schema.service_id == service_id, Schema.version == version))
        schema = result.scalar_one_or_none()
        if not schema:
            raise SchemaNotFoundError(f'Schema {service_id} v{version} not found')
        old_schema = await self.schema_service.get_previous_version(service_id, version)
        changes = []
        compatible = True
        if old_schema:
            changes = await self.diff_service.diff(old_schema.spec, schema.spec)
            compatible = all(c.severity != Severity.critical for c in changes)
        affected = await self.dependency_service.get_consumers(service_id)
        duration_ms = int((time.monotonic() - start) * 1000)
        check = Check(schema_id=schema.id, status=CheckStatus.completed, result={
            'compatible': compatible,
            'changes': [c.model_dump(mode='json') for c in changes],
            'affected_consumers': [s.model_dump(mode='json') for s in affected]
        },
        duration_ms=duration_ms
    )
        self.session.add(check)
        await self.session.commit()
        return check.id
    
    async def get_check(self, check_id: UUID) -> CheckResponse:
        query = select(Check).where(Check.id == check_id)
        result = await self.session.execute(query)
        check = result.scalar_one_or_none()
        if not check:
            raise CheckNotFoundError(f'Check {check_id} not found')
        return CheckResponse(
            id=check.id,
            status=check.status,
            result=CheckResult(
                compatible=check.result['compatible'],
                changes=[Change(**c) for c in check.result['changes']],
                affected_consumers=[ServiceBrief(**s) for s in check.result.get('affected_consumers', [])],
            ),
            created_at=check.created_at,
        )


