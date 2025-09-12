from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd, json, hashlib
from app.core.cache import cached_json
from app.core.config import settings
from app.services.upstream import fetch_station_raw
from app.services.series import build_slice

router = APIRouter(prefix="/compare", tags=["compare"])

class CompareReq(BaseModel):
    stationIds: List[str]
    vars: Optional[List[str]] = None
    start: Optional[str] = None
    end: Optional[str] = None
    resample: Optional[str] = None

@router.post("", response_model=dict)
async def compare(req: CompareReq):
    ids_sorted = sorted(set(req.stationIds))
    key = "cmp:" + hashlib.md5(
        json.dumps({"ids": ids_sorted, "vars": req.vars, "start": req.start, "end": req.end, "res": req.resample}, sort_keys=True).encode()
    ).hexdigest()

    async def loader():
        frames = []
        for sid in ids_sorted:
            raw = await fetch_station_raw(sid)
            out = build_slice(json.loads(raw), req.start, req.end, req.vars, req.resample)
            df = pd.DataFrame(out["points"]) if out["points"] else pd.DataFrame(columns=["timestamp"])
            if df.empty:
                continue
            df = df.rename(columns={c: f"{sid}:{c}" for c in df.columns if c != "timestamp"})
            frames.append(df)

        if not frames:
            return {"ids": ids_sorted, "points": [], "points_count": 0}

        merged = frames[0]
        for f in frames[1:]:
            merged = merged.merge(f, on="timestamp", how="outer")

        merged = merged.sort_values("timestamp")
        return {"ids": ids_sorted, "points": merged.to_dict("records"), "points_count": len(merged)}

    return await cached_json(key, settings.CACHE_TTL_SLICE, loader)