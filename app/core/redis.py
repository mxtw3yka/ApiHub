"""Redis client for caching."""
import json
from typing import Optional
from redis.asyncio import Redis as AsyncRedis
from app.core.config import settings

_redis: Optional[AsyncRedis] = None


def get_redis() -> AsyncRedis:
    global _redis
    if _redis is None:
        _redis = AsyncRedis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


async def close_redis():
    global _redis
    if _redis is not None:
        await _redis.close()
        _redis = None


async def ping_redis() -> bool:
    try:
        r = get_redis()
        return await r.ping()
    except Exception:
        return False
