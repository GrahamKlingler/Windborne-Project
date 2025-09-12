export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:8000/api';

export type Station = {
  station_id: string;
  station_name?: string | null;
  timezone?: string | null;
  station_network?: string | null;
  latitude: number;
  longitude: number;
  elevation?: number | null;
};

export type DataPoint = { timestamp: string; [k: string]: number | string | null | undefined };
export type DataRecord = { station: string; start_date?: string; end_date?: string; points_count: number; points: DataPoint[] };

export async function searchStations(q: string, limit = 200): Promise<Station[]> {
  const url = new URL(`${API_BASE}/stations`);
  if (q) url.searchParams.set('q', q);
  url.searchParams.set('limit', String(limit));
  const r = await fetch(url, { credentials: 'omit' });
  if (!r.ok) throw new Error(`Search failed: ${r.status}`);
  return r.json();
}

export async function getStationPoints(
  stationId: string,
  opts: { start?: string; end?: string; vars?: string[]; resample?: string } = {}
): Promise<DataRecord> {
  const url = new URL(`${API_BASE}/stations/${encodeURIComponent(stationId)}/points`);
  if (opts.start) url.searchParams.set('start', opts.start);
  if (opts.end) url.searchParams.set('end', opts.end);
  if (opts.vars?.length) url.searchParams.set('vars', opts.vars.join(','));
  if (opts.resample) url.searchParams.set('resample', opts.resample);
  const r = await fetch(url, { credentials: 'omit' });
  if (!r.ok) throw new Error(`Points failed: ${r.status}`);
  return r.json();
}

export type CompareRequest = {
  stationIds: string[];
  vars?: string[];
  start?: string;
  end?: string;
  resample?: string;
};
export type CompareResponse = { ids: string[]; points_count: number; points: DataPoint[] };

export async function compareStations(body: CompareRequest): Promise<CompareResponse> {
  const r = await fetch(`${API_BASE}/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Compare failed: ${r.status}`);
  return r.json();
}
