import { compareStations, type CompareRequest, type CompareResponse } from './api';

const memory = new Map<string, { data: CompareResponse; ts: number }>();
const inflight = new Map<string, Promise<CompareResponse>>();

export async function getCompareOnce(
  req: CompareRequest,
  opts: { ttlMs?: number; forceRefresh?: boolean } = {}
): Promise<CompareResponse> {
  const ttlMs = opts.ttlMs ?? 5 * 60 * 1000;
  const key = `cmp:${JSON.stringify({ ...req, stationIds: [...req.stationIds].sort() })}`;

  const mem = memory.get(key);
  if (mem && Date.now() - mem.ts < ttlMs && !opts.forceRefresh) return mem.data;

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    const data = await compareStations(req);
    const entry = { data, ts: Date.now() };
    memory.set(key, entry);
    try { localStorage.setItem(key, JSON.stringify(entry)); } catch {}
    return data;
  })();

  inflight.set(key, p);
  try {
    const s = localStorage.getItem(key);
    if (s && !opts.forceRefresh) {
      const cached = JSON.parse(s) as { data: CompareResponse; ts: number };
      if (Date.now() - cached.ts < ttlMs) memory.set(key, cached);
    }
  } catch {}
  p.finally(() => inflight.delete(key));
  return p;
}
