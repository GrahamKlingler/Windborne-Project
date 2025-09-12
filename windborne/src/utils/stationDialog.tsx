import { useEffect, useMemo, useState } from 'react';
import { getDataOnce } from './dataCache';
import { type DataRecord } from './api';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';

export type StationDialogProps = {
  stationId: string;
  stationName: string;
  /** (optional) no longer used when caching; kept for backward compatibility */
  makeUrl?: (id: string) => string;
  onClose: () => void;
  /** override cache TTL if you want (defaults to 6h) */
  ttlMs?: number;
};

export default function StationDialog({
  stationId,
  stationName,
  onClose,
  ttlMs = 6 * 60 * 60 * 1000, // 6 hours
}: StationDialogProps) {
  const [rec, setRec] = useState<DataRecord | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Pull from cache (in-memory + localStorage, with ETag if available)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);

    getDataOnce(stationId, { ttlMs, useETag: true })
      .then((data) => { if (!cancelled) setRec(data); })
      .catch((e) => { if (!cancelled) setErr(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [stationId, ttlMs]);

  // Prepare Recharts rows: t (ms) + numeric fields
  const { rows, seriesKeys } = useMemo(() => {
    if (!rec?.points?.length) return { rows: [] as any[], seriesKeys: [] as string[] };

    // collect numeric keys from the normalized points (timestamp is ISO string)
    const keySet = new Set<string>();
    for (const p of rec.points) {
      for (const [k, v] of Object.entries(p)) {
        if (k === 'timestamp') continue;
        if (typeof v === 'number' && Number.isFinite(v)) keySet.add(k);
      }
    }
    const keys = [...keySet];

    const rows = rec.points
      .map((p) => {
        const t = Date.parse(p.timestamp);
        if (!Number.isFinite(t)) return null;
        const row: any = { t };
        for (const k of keys) {
          const v = (p as any)[k];
          row[k] = (typeof v === 'number' && Number.isFinite(v)) ? v : null;
        }
        return row;
      })
      .filter(Boolean)
      .sort((a, b) => a.t - b.t);

    return { rows, seriesKeys: keys };
  }, [rec]);

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
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12, borderBottom: '1px solid #222' }}>
          <strong style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial' }}>
            {stationName} (ID: {stationId})
          </strong>
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Plotting all numeric fields over time {loading ? '…' : ''}
          </div>
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
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="t"
                  tickFormatter={(v: number) => new Date(v).toLocaleString()}
                  type="number"
                  domain={['auto', 'auto']}
                  scale="time"
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(v: number) => new Date(v).toLocaleString()}
                  contentStyle={{
                    background: '#3a3a3a',
                    border: '1px solid #555',
                    borderRadius: 8,
                    color: '#f0f0f0',
                    boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
                  }}
                  labelStyle={{ color: '#ddd' }}
                  itemStyle={{ color: '#eee' }}
                  wrapperStyle={{ outline: 'none', zIndex: 1001 }}
                  cursor={{ fill: 'rgba(180,180,180,0.08)' }}
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
