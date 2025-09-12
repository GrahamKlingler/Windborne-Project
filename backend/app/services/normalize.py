from __future__ import annotations
from typing import Any, Dict, List, Optional

def _is_num(v: Any) -> bool:
    return isinstance(v, (int, float)) and (v == v) and (v not in (float('inf'), float('-inf')))

def _to_iso(t: Any) -> Optional[str]:
    # supports number (sec or ms) or string ISO
    from datetime import datetime, timezone
    if isinstance(t, (int, float)):
        ms = int(t) if t > 1e12 else int(t * 1000)
        try:
            return datetime.fromtimestamp(ms/1000, tz=timezone.utc).isoformat()
        except Exception:
            return None
    if isinstance(t, str):
        try:
            dt = datetime.fromisoformat(t.replace('Z', '+00:00'))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).isoformat()
        except Exception:
            return None
    return None

def normalize_rowwise(input_obj: Any) -> List[Dict[str, Any]]:
    """
    Accepts either {points: [...]}, or columnar points, or raw arrays at top-level.
    Returns list of dicts with 'timestamp' and numeric fields only.
    """
    if not isinstance(input_obj, dict):
        return []

    obj = input_obj
    data = obj.get("points")
    # Case A: points is a row-wise list
    if isinstance(data, list):
        rows = []
        # choose a time key
        tk = None
        if data:
            for cand in ("timestamp","time","ts","date","datetime"):
                if isinstance(data[0], dict) and cand in data[0]:
                    tk = cand; break
        tk = tk or "timestamp"

        for p in data:
            if not isinstance(p, dict): continue
            iso = _to_iso(p.get(tk))
            if not iso: continue
            row = {"timestamp": iso}
            for k, v in p.items():
                if k == tk: continue
                if _is_num(v): row[k] = float(v)
                elif isinstance(v, str):
                    try:
                        fv = float(v)
                        if _is_num(fv): row[k] = fv
                    except: pass
            rows.append(row)
        rows.sort(key=lambda r: r["timestamp"])
        return rows

    # Case B: points is columnar
    if isinstance(data, dict):
        # find time key
        tkey = None
        for cand in ("timestamp","time","ts","date","datetime"):
            if cand in data: tkey = cand; break
        if not tkey: return []

        tarr = data.get(tkey)
        if not isinstance(tarr, list): return []
        L = len(tarr)
        rows: List[Dict[str, Any]] = []
        for i in range(L):
            iso = _to_iso(tarr[i])
            if not iso: continue
            row: Dict[str, Any] = {"timestamp": iso}
            for k, col in data.items():
                if k == tkey: continue
                if isinstance(col, list) and i < len(col):
                    v = col[i]
                    if _is_num(v): row[k] = float(v)
                    elif isinstance(v, str):
                        try:
                            fv = float(v)
                            if _is_num(fv): row[k] = fv
                        except: pass
            rows.append(row)
        rows.sort(key=lambda r: r["timestamp"])
        return rows

    # Case C: columns at top level
    keys = list(obj.keys())
    if keys and all(isinstance(obj[k], list) for k in keys):
        # infer time key
        tkey = None
        for cand in ("timestamp","time","ts","date","datetime"):
            if cand in obj: tkey = cand; break
        if not tkey: return []
        tarr = obj[tkey]
        if not isinstance(tarr, list): return []
        L = len(tarr)
        rows: List[Dict[str, Any]] = []
        for i in range(L):
            iso = _to_iso(tarr[i])
            if not iso: continue
            row: Dict[str, Any] = {"timestamp": iso}
            for k in keys:
                if k == tkey: continue
                col = obj[k]
                if isinstance(col, list) and i < len(col):
                    v = col[i]
                    if _is_num(v): row[k] = float(v)
                    elif isinstance(v, str):
                        try:
                            fv = float(v)
                            if _is_num(fv): row[k] = fv
                        except: pass
            rows.append(row)
        rows.sort(key=lambda r: r["timestamp"])
        return rows

    return []
