from app.db.base import Base
import uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import func
import datetime


class Service(Base):
    __tablename__ = 'services'
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(unique=True)
    description: Mapped[str | None]
    created_at: Mapped[datetime.datetime] = mapped_column(default=func.now())
