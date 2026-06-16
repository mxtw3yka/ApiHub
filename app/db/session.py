from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from app.core.config import settings

URL = settings.DB_URL

engine = create_async_engine(URL)
session_maker = async_sessionmaker(engine, expire_on_commit=False)

async def get_db():
    async with session_maker() as session:
        yield session