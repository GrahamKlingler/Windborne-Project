import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';

type MultiStationDialogProps = {
  stationIds: string[];
  makeUrl: (id: string) => string;
  onClose: () => void;
};

export default function MultiStationDialog({ stationIds, makeUrl, onClose }: MultiStationDialogProps) {
  const [data, setData] = useState<any[]>([]);
  const [seriesKeys, setSeriesKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr(null);
    (async () => {
      try {
        // fetch all stations' points
        const resps = await Promise.all(
          stationIds.map(async (id) => {
            const r = await fetch(makeUrl(id));
            if (!r.ok) throw new Error(`HTTP ${r.status} for ${id}`);
            const j = await r.json();
            if (!j || typeof j !== 'object' || !Array.isArray(j.points)) {
              throw new Error(`Malformed response for ${id}`);
            }
            return { id, points: j.points as Array<Record<string, unknown>> };
          })
        );
        if (cancelled) return;

        // choose a time key
        const timeCandidates = ['timestamp', 'time', 'ts', 'date'];
        const tk = timeCandidates.find((k) => resps[0].points[0] && k in resps[0].points[0]) ?? 'time';

        // union all numeric keys across stations, excluding time key
        const numeric = new Set<string>();
        for (const { points } of resps) {
          for (const p of points) {
            for (const [k, v] of Object.entries(p)) {
              if (k === tk) continue;
              if (typeof v === 'number' && Number.isFinite(v)) numeric.add(k);
            }
          }
        }

        // build a unified time-axis map: t (ms since epoch) -> row object
        const rows = new Map<number, any>();
        for (const { id, points } of resps) {
          for (const p of points) {
            const tRaw = (p as any)[tk];
            const t = new Date(tRaw as any).getTime();
            if (!Number.isFinite(t)) continue;
            const key = t;
            const row = rows.get(key) ?? { t };
            // write <id>:<field> values to row
            for (const k of numeric) {
              const v = (p as any)[k];
              if (typeof v === 'number' && Number.isFinite(v)) {
                row[`${id}:${k}`] = v;
              }
            }
            rows.set(key, row);
          }
        }

        const dataArr = [...rows.values()].sort((a, b) => a.t - b.t);
        const sKeys = [...numeric].flatMap((k) => stationIds.map((id) => `${id}:${k}`));

        setData(dataArr);
        setSeriesKeys(sKeys);
      } catch (e: any) {
        setErr(String(e?.message ?? e));
      } finally {
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [stationIds, makeUrl]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', display: 'grid', placeItems: 'center', zIndex: 1000 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '92vw', height: '86vh', background: '#111', color: '#fff', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.6)', display: 'grid', gridTemplateRows: '48px 1fr', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12, borderBottom: '1px solid #222' }}>
          <strong>Viewing {stationIds.length} station{stationIds.length !== 1 ? 's' : ''}</strong>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: '#333', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
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
                  domain={["auto", "auto"]}
                  scale="time"
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(v: any) => new Date(v).toLocaleString()}
                  contentStyle={{ background: '#3a3a3a', border: '1px solid #555', borderRadius: 8, color: '#f0f0f0' }}
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
