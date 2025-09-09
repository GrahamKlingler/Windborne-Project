// stationCache.ts
import { normalizeStationRecords } from "../globe_vis/threeGeoJSON"; // or your own normalizer
export interface StationRecord {
  station_id: string;
  latitude: number;
  longitude: number;
  elevation?: number | null;
  station_name?: string;
  station_network?: string;
  timezone?: string;
  [k: string]: unknown;
}

type CacheEntry = {
  data: StationRecord[];
  ts: number; // when stored
  etag?: string;
  lastModified?: string;
};

const memory = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<StationRecord[]>>();

type Options = {
  ttlMs?: number; // default 6h
  forceRefresh?: boolean; // ignore cache
  useETag?: boolean; // try If-None-Match / If-Modified-Since
};

const LS_PREFIX = "stations:";

function loadLocal(url: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + url);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

function saveLocal(url: string, entry: CacheEntry) {
  try {
    localStorage.setItem(LS_PREFIX + url, JSON.stringify(entry));
  } catch {}
}

export async function getStationsOnce(
  url: string,
  opts: Options = {}
): Promise<StationRecord[]> {
  const ttlMs = opts.ttlMs ?? 6 * 60 * 60 * 1000; // 6 hours

  // 1) fresh enough in-memory?
  const mem = memory.get(url);
  if (mem && Date.now() - mem.ts < ttlMs && !opts.forceRefresh) {
    return mem.data;
  }

  // 2) in-flight request dedupe
  const existing = inflight.get(url);
  if (existing) return existing;

  // 3) try localStorage
  const local = loadLocal(url);
  const localFresh = local && Date.now() - local.ts < ttlMs;
  if (localFresh && !opts.forceRefresh) {
    // hydrate memory and return without network
    memory.set(url, local);
    return local.data;
  }

  // 4) network fetch (with conditional headers if available)
  const p = (async () => {
    const headers: Record<string, string> = {};
    if (opts.useETag && local) {
      if (local.etag) headers["If-None-Match"] = local.etag;
      if (local.lastModified) headers["If-Modified-Since"] = local.lastModified;
    }

    try {
      const res = await fetch(url, { headers });
      if (res.status === 304 && local) {
        // not modified → use cached
        memory.set(url, { ...local, ts: Date.now() });
        return local.data;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw: unknown = await res.json();
      const records = normalizeStationRecords(raw); // validate/shape → StationRecord[]

      const etag = res.headers.get("ETag") ?? undefined;
      const lastModified = res.headers.get("Last-Modified") ?? undefined;

      const entry: CacheEntry = {
        data: records,
        ts: Date.now(),
        etag,
        lastModified,
      };
      memory.set(url, entry);
      saveLocal(url, entry);
      return records;
    } catch (e) {
      // On failure, fall back to any cached data we have
      if (local) {
        console.warn("[getStationsOnce] network failed, using cached data:", e);
        memory.set(url, local);
        return local.data;
      }
      inflight.delete(url);
      throw e;
    } finally {
      inflight.delete(url);
    }
  })();

  inflight.set(url, p);
  return p;
}
