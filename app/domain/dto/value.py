from uuid import UUID
from typing import Annotated
from pydantic import Field

Uuid = Annotated[
    UUID,
    Field(
        description='UUID',
        examples=['550e8400-e29b-41d4-a716-446655440000']
    )
]
