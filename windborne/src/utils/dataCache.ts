// dataCache.ts
// Caches and normalizes station historical data from Windborne endpoint.
// GET https://sfc.windbornesystems.com/historical_weather?station=<ID>

const endpoint = "https://sfc.windbornesystems.com/historical_weather?station=";

// ---------- Types (normalized) ----------
export interface Point {
  timestamp: string;              // ISO string
  [k: string]: number | string | null | undefined; // other numeric fields kept; non-numeric dropped
}

export interface DataRecord {
  points: Point[];                // normalized, row-wise points
  points_count: number;
  station: string;
  start_date?: string;            // passthrough from API if present
  end_date?: string;              // passthrough from API if present
  // You can add other metadata fields here as needed
}

// ---------- Cache internals ----------
type CacheEntry = {
  data: DataRecord;
  ts: number;
  etag?: string;
  lastModified?: string;
};

const memory = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<DataRecord>>();

type Options = {
  ttlMs?: number;        // default 6h
  forceRefresh?: boolean;
  useETag?: boolean;     // send If-None-Match / If-Modified-Since when we have them
};

const LS_PREFIX = "data:";

function loadLocal(id: string): CacheEntry | null {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(LS_PREFIX + id) : null;
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

function saveLocal(id: string, entry: CacheEntry) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LS_PREFIX + id, JSON.stringify(entry));
    }
  } catch {}
}

// ---------- Normalization helpers ----------
const isFiniteNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// parse various time key names -> ISO string
function toISO(t: unknown): string | null {
  // supports number (ms or sec), ISO string, etc.
  if (typeof t === "number" && Number.isFinite(t)) {
    const ms = t > 1e12 ? t : t * 1000; // assume seconds if looks small
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof t === "string") {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function pickTimeKey(obj: Record<string, unknown> | undefined): string | null {
  if (!obj) return null;
  const candidates = ["timestamp", "time", "ts", "date", "datetime"];
  for (const k of candidates) {
    if (k in obj) return k;
  }
  return null;
}

// Row-wise points: Array<Record<string, unknown>>
function normalizeRowPoints(arr: Array<Record<string, unknown>>): Point[] {
  if (!arr.length) return [];
  const tk = pickTimeKey(arr[0]) ?? "timestamp";
  const out: Point[] = [];

  for (const raw of arr) {
    const rec = raw ?? {};
    const iso = toISO((rec as any)[tk]);
    if (!iso) continue;

    const row: Point = { timestamp: iso };
    for (const [k, v] of Object.entries(rec)) {
      if (k === tk) continue;
      if (isFiniteNum(v)) row[k] = v;
      // optionally parse numeric strings:
      else if (typeof v === "string" && v.trim() !== "" && isFiniteNum(Number(v))) row[k] = Number(v);
    }
    out.push(row);
  }

  // sort ascending by time
  out.sort((a, b) => (a.timestamp > b.timestamp ? 1 : a.timestamp < b.timestamp ? -1 : 0));
  return out;
}

// Columnar points: Record<string, unknown[]>
function normalizeColumnarPoints(obj: Record<string, unknown>): Point[] {
  // find a time array
  const tKey =
    Object.keys(obj).find((k) => k === "timestamp" || k === "time" || k === "ts" || k === "date" || k === "datetime") ??
    "timestamp";

  const tArr = obj[tKey] as unknown;
  if (!Array.isArray(tArr)) return [];

  const length = tArr.length;
  const keys = Object.keys(obj);

  const out: Point[] = [];
  for (let i = 0; i < length; i++) {
    const iso = toISO(tArr[i]);
    if (!iso) continue;

    const row: Point = { timestamp: iso };
    for (const k of keys) {
      if (k === tKey) continue;
      const col = obj[k] as unknown;
      if (!Array.isArray(col)) continue;
      const v = col[i];
      if (isFiniteNum(v)) row[k] = v;
      else if (typeof v === "string" && v.trim() !== "" && isFiniteNum(Number(v))) row[k] = Number(v);
    }
    out.push(row);
  }

  out.sort((a, b) => (a.timestamp > b.timestamp ? 1 : a.timestamp < b.timestamp ? -1 : 0));
  return out;
}

// Accept either shape and return a normalized DataRecord
function normalizeDataRecord(input: unknown, stationFallback: string): DataRecord {
  if (!input || typeof input !== "object") {
    throw new Error("[normalizeDataRecord] Unsupported data JSON shape");
  }

  const obj = input as Record<string, unknown>;
  const station = typeof obj.station === "string" ? obj.station : stationFallback;
  const start_date = typeof obj.start_date === "string" ? obj.start_date : undefined;
  const end_date = typeof obj.end_date === "string" ? obj.end_date : undefined;

  let pointsNorm: Point[] = [];

  // Case A: points is an array of row objects
  if (Array.isArray(obj.points)) {
    const rows = obj.points as Array<Record<string, unknown>>;
    pointsNorm = normalizeRowPoints(rows);
  }
  // Case B: points is a columnar object of arrays
  else if (obj.points && typeof obj.points === "object") {
    pointsNorm = normalizeColumnarPoints(obj.points as Record<string, unknown>);
  } else {
    // Some APIs return the arrays at the top level (timestamp/temp/etc) without nesting under 'points'
    const keys = Object.keys(obj);
    const looksColumnar = keys.length > 0 && keys.every((k) => Array.isArray((obj as any)[k]));
    if (looksColumnar) {
      pointsNorm = normalizeColumnarPoints(obj);
    } else {
      pointsNorm = [];
    }
  }

  return {
    station,
    start_date,
    end_date,
    points: pointsNorm,
    points_count: pointsNorm.length,
  };
}

// ---------- Public API ----------
export async function getDataOnce(id: string, opts: Options = {}): Promise<DataRecord> {
  const ttlMs = opts.ttlMs ?? 6 * 60 * 60 * 1000; // 6 hours

  // 1) in-memory cache
  const mem = memory.get(id);
  if (mem && Date.now() - mem.ts < ttlMs && !opts.forceRefresh) {
    return mem.data;
  }

  // 2) in-flight dedupe
  const existing = inflight.get(id);
  if (existing) return existing;

  // 3) localStorage
  const local = loadLocal(id);
  const localFresh = local && Date.now() - local.ts < ttlMs;
  if (localFresh && !opts.forceRefresh) {
    memory.set(id, local);
    return local.data;
  }

  // 4) network
  const p = (async () => {
    const headers: Record<string, string> = {};
    if (opts.useETag && local) {
      if (local.etag) headers["If-None-Match"] = local.etag;
      if (local.lastModified) headers["If-Modified-Since"] = local.lastModified;
    }

    try {
      const res = await fetch(`${endpoint}${encodeURIComponent(id)}`, { headers });

      if (res.status === 304 && local) {
        const fresh = { ...local, ts: Date.now() };
        memory.set(id, fresh);
        saveLocal(id, fresh);
        return fresh.data;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw: unknown = await res.json();
      const data: DataRecord = normalizeDataRecord(raw, id);

      const etag = res.headers.get("ETag") ?? undefined;
      const lastModified = res.headers.get("Last-Modified") ?? undefined;

      const entry: CacheEntry = { data, ts: Date.now(), etag, lastModified };
      memory.set(id, entry);
      saveLocal(id, entry);
      return data;
    } catch (e) {
      // On failure, fall back to any cached data we have
      if (local) {
        console.warn("[getDataOnce] network failed, using cached data:", e);
        const fallback = { ...local, ts: Date.now() };
        memory.set(id, fallback);
        return fallback.data;
      }
      throw e;
    } finally {
      inflight.delete(id);
    }
  })();

  inflight.set(id, p);
  return p;
}
