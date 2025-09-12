from fastapi import APIRouter, Query
from app.core.cache import cached_json
from app.core.config import settings
from app.services.upstream import fetch_station_raw
from app.services.series import build_slice
import json, hashlib

router = APIRouter(prefix="/stations", tags=["points"])

@router.get("/{station_id}/points")
async def station_points(station_id: str,
                         start: str|None = None,
                         end: str|None = None,
                         vars: str|None = Query(None),
                         resample: str|None = Query(None)):
    vlist = [v.strip() for v in (vars or "").split(",") if v.strip()] or None
    # cache key for computed slice
    key = "slice:" + hashlib.md5(f"{station_id}|{start}|{end}|{vlist}|{resample}".encode()).hexdigest()

    async def loader():
        raw_text = await fetch_station_raw(station_id)
        raw_json = json.loads(raw_text)
        out = build_slice(raw_json, start, end, vlist, resample)
        out.update({"station": station_id, "start_date": start, "end_date": end})
        return out

    return await cached_json(key, settings.CACHE_TTL_SLICE, loader)
