from pydantic import BaseModel
from typing import Optional

class Station(BaseModel):
    station_id: str
    station_name: Optional[str] = None
    timezone: Optional[str] = None
    station_network: Optional[str] = None
    latitude: float
    longitude: float
    elevation: Optional[float] = None
    