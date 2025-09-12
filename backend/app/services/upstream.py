import httpx, json
from app.core.cache import r
from app.core.config import settings

async def fetch_station_raw(station_id: str) -> str:
    base = settings.UPSTREAM_BASE
    url = f"{base}/historical_weather?station={station_id}"

    etag = await r.get(f"etag:{station_id}")
    last = await r.get(f"lastmod:{station_id}")
    headers = {}
    if etag: headers["If-None-Match"] = etag.decode()
    if last: headers["If-Modified-Since"] = last.decode()

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(url, headers=headers)
        if resp.status_code == 304:
            cached = await r.get(f"raw:{station_id}")
            if cached:
                return cached.decode()
        resp.raise_for_status()

        if e := resp.headers.get("ETag"):
            await r.set(f"etag:{station_id}", e)
        if l := resp.headers.get("Last-Modified"):
            await r.set(f"lastmod:{station_id}", l)

        await r.set(f"raw:{station_id}", resp.text, ex=settings.CACHE_TTL_RAW)
        return resp.text

async def fetch_station_list() -> list[dict]:
    """Demo search backend: pulls station list from upstream and caches it briefly.
    Replace with Postgres/pg_trgm later for scalable search.
    """
    key = "station_list:all"
    cached = await r.get(key)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            await r.delete(key)

    url = f"{settings.UPSTREAM_BASE}{settings.STATION_LIST_PATH}"
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()
        await r.set(key, json.dumps(data), ex=settings.CACHE_TTL_SEARCH)
        return data
    