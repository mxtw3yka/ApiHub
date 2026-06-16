"""Cache decorator and utilities using Redis."""
import json
import hashlib
from functools import wraps
from typing import Any, Callable, Optional
from fastapi import Request
from app.core.redis import get_redis
from app.core.config import settings


def _make_key(prefix: str, *args, **kwargs) -> str:
    """Build a deterministic cache key."""
    raw = json.dumps((args, sorted(kwargs.items())), sort_keys=True, default=str)
    h = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"cache:{prefix}:{h}"


async def get_cache(key: str) -> Optional[dict]:
    """Get cached value by key."""
    try:
        r = get_redis()
        data = await r.get(key)
        if data:
            return json.loads(data)
    except Exception:
        pass
    return None


async def set_cache(key: str, value: Any, ttl: int = 0) -> None:
    """Set cached value with TTL (default from settings)."""
    try:
        r = get_redis()
        ttl = ttl or settings.CACHE_TTL_SECONDS
        await r.set(key, json.dumps(value, default=str), ex=ttl)
    except Exception:
        pass


async def invalidate_cache(prefix: str) -> None:
    """Invalidate all cache keys starting with prefix."""
    try:
        r = get_redis()
        cursor = 0
        while True:
            cursor, keys = await r.scan(cursor=cursor, match=f"cache:{prefix}:*", count=100)
            if keys:
                await r.delete(*keys)
            if cursor == 0:
                break
    except Exception:
        pass
