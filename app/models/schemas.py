from app.db.base import Base
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import ForeignKey, func, UniqueConstraint, JSON
import datetime
import uuid

class Schema(Base):
    __tablename__ = 'schemas'
    __table_args__ = (UniqueConstraint('service_id', 'version', name='uq_service_version'),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    service_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('services.id'))
    version: Mapped[str]
    spec: Mapped[dict] = mapped_column(JSON)
    source_commit: Mapped[str | None]
    created_at: Mapped[datetime.datetime] = mapped_column(default=func.now())
