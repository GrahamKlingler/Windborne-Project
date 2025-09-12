from fastapi import APIRouter, Query
from typing import Optional
from app.repos.stations_repo import search_stations_repo

router = APIRouter(prefix="/stations", tags=["stations"])

@router.get("")
async def search_stations(q: Optional[str] = None,
                          tz: Optional[str] = None,
                          network: Optional[str] = None,
                          lat: Optional[float] = None,
                          lon: Optional[float] = None,
                          radius_m: Optional[int] = None,
                          limit: int = 50, offset: int = 0):
    return await search_stations_repo(q, tz, network, lat, lon, radius_m, limit, offset)
