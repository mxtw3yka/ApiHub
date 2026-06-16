from app.db.base import Base
import uuid
import datetime
from sqlalchemy import ForeignKey, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import JSON

class Dependency(Base):
    __tablename__ = 'dependencies'
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    consumer_service_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('services.id'))
    provider_service_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('services.id'))
    provider_constraint: Mapped[str]
    endpoints: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(default='active')
    created_at: Mapped[datetime.datetime] = mapped_column(default=func.now())

