// StationDialog.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';

type PointsResponse = {
  points: Array<Record<string, unknown>>;
};

export type StationDialogProps = {
  stationId: string;
  makeUrl: (id: string) => string;   // e.g. (id) => `/api/stations/${id}/points`
  onClose: () => void;
};

export default function StationDialog({ stationId, makeUrl, onClose }: StationDialogProps) {
  const [raw, setRaw] = useState<PointsResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // fetch once per stationId
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr(null);
    fetch(makeUrl(stationId))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((json: unknown) => {
        if (cancelled) return;
        // very light validation
        const ok = !!json && typeof json === 'object' && Array.isArray((json as any).points);
        if (!ok) throw new Error('Malformed response: expected { points: [...] }');
        setRaw(json as PointsResponse);
      })
      .catch(e => !cancelled && setErr(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [stationId, makeUrl]);

  // normalize → Recharts-friendly
  const { data, seriesKeys, timeKey } = useMemo(() => {
    const empty = { data: [] as any[], seriesKeys: [] as string[], timeKey: 'time' };
    if (!raw?.points?.length) return empty;

    // find a time key we recognize
    const timeCandidates = ['timestamp', 'time', 'ts', 'date'];
    const tk = timeCandidates.find(k => k in raw.points[0]) ?? timeCandidates[0];

    // collect numeric keys present in most rows (ignore the time key)
    const allKeys = new Set<string>();
    for (const p of raw.points) for (const k of Object.keys(p)) allKeys.add(k);
    const numericKeys = [...allKeys].filter(k => k !== tk);

    // build rows
    const rows = raw.points
      .map(p => {
        const tRaw = (p as any)[tk];
        const t = typeof tRaw === 'string' || typeof tRaw === 'number'
          ? new Date(tRaw as any)
          : null;
        if (!(t instanceof Date) || Number.isNaN(t.getTime())) return null;
        const row: any = { t };
        for (const k of numericKeys) {
          const v = (p as any)[k];
          row[k] = (typeof v === 'number' && Number.isFinite(v)) ? v : null;
        }
        return row;
      })
      .filter(Boolean) as Array<Record<string, any>>;

    // sort by time
    rows.sort((a, b) => (a.t as Date).getTime() - (b.t as Date).getTime());

    // keep only keys that have at least one numeric value
    const keep = numericKeys.filter(k => rows.some(r => typeof r[k] === 'number'));
    return { data: rows, seriesKeys: keep, timeKey: tk };
  }, [raw]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(2px)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '90vw',
          height: '85vh',
          background: '#111',
          color: '#fff',
          borderRadius: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
          display: 'grid',
          gridTemplateRows: '48px 1fr',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()} // prevent backdrop click
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12, borderBottom: '1px solid #222' }}>
          <strong style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial' }}>
            Station {stationId}
          </strong>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Plotting all numeric fields over time {loading ? '…' : ''}</div>
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto', background: '#333', color: '#fff',
              border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>

        <div style={{ padding: 8, height: '100%', width: '100%' }}>
          {err && <div style={{ color: '#ff8a8a' }}>{err}</div>}
          {!err && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="t"
                  tickFormatter={(v: any) => new Date(v).toLocaleString()}
                  type="number"
                  domain={['auto', 'auto']}
                  scale="time"
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(v: any) => new Date(v).toLocaleString()}
                  contentStyle={{
                    background: '#3a3a3a',   // gray background
                    border: '1px solid #555',
                    borderRadius: 8,
                    color: '#f0f0f0',        // text color inside
                    boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
                  }}
                  labelStyle={{ color: '#40b1fbff' }}
                  itemStyle={{ color: '#eee' }}
                  wrapperStyle={{ outline: 'none', zIndex: 1001 }}
                />
                <Legend />
                {seriesKeys.map((k) => (
                  <Line key={k} type="monotone" dataKey={k} dot={false} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
