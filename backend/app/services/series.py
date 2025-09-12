import pandas as pd
from .normalize import normalize_rowwise  # ensures [{timestamp, var1, var2, ...}]

def build_slice(raw_json: dict, start: str|None, end: str|None, vars: list[str]|None, resample: str|None):
    rows = normalize_rowwise(raw_json)  # -> list[dict]
    if not rows: return {"points": [], "points_count": 0}

    df = pd.DataFrame(rows)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df.sort_values("timestamp")
    if start: df = df[df["timestamp"] >= pd.to_datetime(start)]
    if end:   df = df[df["timestamp"] <= pd.to_datetime(end)]

    # choose vars
    if vars:
        keep = ["timestamp"] + [v for v in vars if v in df.columns]
        df = df[keep]
    else:
        # drop non-numeric
        keep = ["timestamp"] + [c for c in df.columns if c!="timestamp" and pd.api.types.is_numeric_dtype(df[c])]
        df = df[keep]

    if resample:
        dfr = (df.set_index("timestamp")
                 .resample(resample).mean().interpolate(limit=2)
                 .reset_index())
        df = dfr

    points = df.to_dict("records")
    return {"points": points, "points_count": len(points)}
