from app.domain.dto.base import BaseDTO
import uuid
import datetime
from app.domain.dto.value import Uuid
from app.domain.dto.enums import ChangeCategory, Severity, CheckStatus
from pydantic import Field
from typing import Generic, TypeVar

T = TypeVar("T")


class ErrorResponse(BaseDTO):
    error: str = Field(..., example='Schema not found')
    detail: str | None = Field(default=None, example='Schema with id 123 not found')

class SchemaResponse(BaseDTO):
    id: Uuid
    service_id: Uuid
    service_name: str
    version: str
    created_at: datetime.datetime
    spec: dict | None = None

class PaginatedResponse(BaseDTO, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int

class CreateSchemaRequest(BaseDTO):
    service_name: str = Field(..., example='Pet Store')
    version: str = Field(..., example='1.0.0')
    spec: dict = Field(..., description='OpenAPI спецификация JSON')

class CreateDependencyRequest(BaseDTO):
    consumer_service_id: Uuid
    provider_service_id: Uuid
    provider_constraint: str = Field(..., example='^1.0.0')
    endpoints: list[str] = Field(..., example=['GET /pets'])

class DependencyResponse(BaseDTO):
    id: Uuid
    consumer_service_id: Uuid
    provider_service_id: Uuid
    provider_constraint: str
    status: str
    endpoints: list[str] = []

class ServiceBrief(BaseDTO):
    id: Uuid
    name: str

class DependencyGraphResponse(BaseDTO):
    service_id: Uuid
    providers: list[ServiceBrief]
    consumers: list[ServiceBrief]

class RunCheckRequest(BaseDTO):
    service_id: Uuid
    version: str = Field(..., example='2.0.0')

class RunCheckResponse(BaseDTO):
    check_id: Uuid
    status: str = Field(..., example='queued')

class Change(BaseDTO):
    category: ChangeCategory
    severity: Severity
    path: str = Field(..., example='components.schemas.Pet.properties.name')
    description: str
    old_value: str
    new_value: str
    recommendation: str

class CheckResult(BaseDTO):
    compatible: bool
    changes: list[Change]
    affected_consumers: list[ServiceBrief]

class CheckResponse(BaseDTO):
    id: Uuid
    status: CheckStatus
    result: CheckResult | None = None
    created_at: datetime.datetime

class DiffResponse(BaseDTO):
    old_version: str
    new_version: str
    compatible: bool
    changes: list[Change]

class FieldType(BaseDTO):
    type: str
    format: str | None = None
    required: bool = False
    description: str | None = None
    enumValues: list[str] | None = None
    refType: str | None = None

class ContractParam(BaseDTO):
    name: str
    param_in: str = ''
    provider_type: str | None = None
    provider_format: str | None = None
    provider_required: bool = False
    consumer_type: str | None = None
    consumer_format: str | None = None
    consumer_required: bool = False

class ContractField(BaseDTO):
    name: str
    provider_type: str | None = None
    provider_format: str | None = None
    provider_required: bool = False
    consumer_type: str | None = None
    consumer_format: str | None = None
    consumer_required: bool = False

class ContractError(BaseDTO):
    code: str
    provider_description: str = ''
    consumer_description: str = ''

class ContractEndpoint(BaseDTO):
    method: str
    path: str
    summary: str = ''
    parameters: list[ContractParam] = []
    request_body_fields: list[ContractField] = []
    response_body_fields: list[ContractField] = []
    response_status_code: str = ''
    error_codes: list[ContractError] = []

class ContractResponse(BaseDTO):
    consumer_id: str
    consumer_name: str = ''
    provider_id: str
    provider_name: str = ''
    endpoints: list[ContractEndpoint] = []

