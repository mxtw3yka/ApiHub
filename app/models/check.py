from app.db.base import Base
from sqlalchemy import ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import JSON
from app.domain.dto.enums import CheckStatus
import uuid
import datetime

class Check(Base): 
    __tablename__ = 'checks'
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    schema_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('schemas.id'))
    status: Mapped[CheckStatus]
    result: Mapped[dict | None] = mapped_column(JSON)
    duration_ms:  Mapped[int | None]
    created_at: Mapped[datetime.datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(default=func.now(), onupdate=func.now())


