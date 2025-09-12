from fastapi import APIRouter, Query
from typing import Optional, List
from app.services.upstream import fetch_station_list
from app.schemas.station import Station

router = APIRouter(prefix="/stations", tags=["stations"])

@router.get("", response_model=List[Station])
async def search_stations(q: Optional[str] = None, limit: int = 200):
    """Demo search that fetches from upstream, caches briefly, then filters client-side.
    Replace with Postgres + pg_trgm for production-grade search.
    """
    data = await fetch_station_list()
    if q:
        ql = q.lower()
        def ok(s):
            return (
                (s.get("station_id") and ql in str(s["station_id"]).lower()) or
                (s.get("station_name") and ql in str(s["station_name"]).lower()) or
                (s.get("timezone") and ql in str(s["timezone"]).lower())
            )
        data = [s for s in data if ok(s)]
    return data[:limit]