import pandas as pd
from typing import List, Optional, Dict, Any
from .normalize import normalize_rowwise

def build_slice(raw_json: Dict[str, Any],
                start: Optional[str],
                end: Optional[str],
                vars: Optional[List[str]],
                resample: Optional[str]):
    rows = normalize_rowwise(raw_json)
    if not rows:
        return {"points": [], "points_count": 0}

    df = pd.DataFrame(rows)
    if "timestamp" not in df.columns:
        return {"points": [], "points_count": 0}

    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
    df = df.dropna(subset=["timestamp"]).sort_values("timestamp")

    if start:
        df = df[df["timestamp"] >= pd.to_datetime(start)]
    if end:
        df = df[df["timestamp"] <= pd.to_datetime(end)]

    # choose variables
    if vars:
        keep = ["timestamp"] + [v for v in vars if v in df.columns]
        df = df[keep]
    else:
        keep = ["timestamp"] + [c for c in df.columns if c != "timestamp" and pd.api.types.is_numeric_dtype(df[c])]
        df = df[keep]

    if resample:
        df = (df.set_index("timestamp")
                .resample(resample).mean().interpolate(limit=2)
                .reset_index())

    df = df.sort_values("timestamp")
    points = df.to_dict("records")
    return {"points": points, "points_count": len(points)}
