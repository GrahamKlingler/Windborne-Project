import json, asyncio
import redis.asyncio as redis
from .config import settings

r = redis.from_url(settings.REDIS_URL)
_locks: dict[str, asyncio.Lock] = {}

async def cached_json(key: str, ttl: int, loader):
    cached = await r.get(key)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            # if corrupted, delete and recompute
            await r.delete(key)

    lock = _locks.setdefault(key, asyncio.Lock())
    async with lock:
        cached = await r.get(key)
        if cached:
            return json.loads(cached)

        data = await loader()
        await r.set(key, json.dumps(data), ex=ttl)
        return data