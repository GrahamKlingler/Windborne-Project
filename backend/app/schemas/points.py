from pydantic import BaseModel
from typing import Any, Dict, List, Optional

class PointsResponse(BaseModel):
    station: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    points_count: int
    points: List[Dict[str, Any]]
    