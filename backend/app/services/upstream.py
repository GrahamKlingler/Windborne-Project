import httpx
from .normalize import normalize_points
from app.core.cache import r
from app.core.config import settings

async def fetch_station_raw(station_id: str):
    base = settings.UPSTREAM_BASE
    url = f"{base}/historical_weather?station={station_id}"

    # conditional headers from redis
    etag = await r.get(f"etag:{station_id}")
    last = await r.get(f"lastmod:{station_id}")
    headers = {}
    if etag: headers["If-None-Match"] = etag.decode()
    if last: headers["If-Modified-Since"] = last.decode()

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code == 304:
            # caller should read cached raw body; we only refreshed metadata
            cached = await r.get(f"raw:{station_id}")
            return cached and cached.decode()

        resp.raise_for_status()
        # store metadata and body
        if e := resp.headers.get("ETag"): await r.set(f"etag:{station_id}", e)
        if l := resp.headers.get("Last-Modified"): await r.set(f"lastmod:{station_id}", l)
        await r.set(f"raw:{station_id}", resp.text, ex=settings.CACHE_TTL_RAW)
        return resp.text
