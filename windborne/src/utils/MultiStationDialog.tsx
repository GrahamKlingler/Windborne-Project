import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getDataOnce, type DataRecord } from './dataCache';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';

export type MultiStationDialogProps = {
  stationIds: string[];           // full set of stations passed in
  onClose: () => void;
  ttlMs?: number;                 // optional cache TTL override (default 6h)
};

// --- Small dropdown with checkbox list ------------------------------------

type Option = { value: string; label: string };

function useOnClickOutside<T extends HTMLElement>(ref: React.RefObject<T | null>, handler: () => void) {
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref) return;
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) handler();
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [ref, handler]);
}

function DropdownMulti({
  label,
  options,
  selected,
  onChange,
  width = 260,
  maxHeight = 180,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  width?: number;
  maxHeight?: number;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(boxRef, () => setOpen(false));

  const allSelected = selected.length && selected.length === options.length;
  const buttonText = allSelected
    ? `${label}: All (${options.length})`
    : selected.length
    ? `${label}: ${selected.length}`
    : `${label}: None`;

  function toggle(value: string) {
    const set = new Set(selected);
    if (set.has(value)) set.delete(value); else set.add(value);
    onChange([...set]);
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', width }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', background: '#1a1a1f', color: '#e6e6e6',
          border: '1px solid #2a2d36', borderRadius: 8, padding: '8px 10px',
          textAlign: 'left', cursor: 'pointer'
        }}
      >
        {buttonText}
        <span style={{ float: 'right', opacity: 0.7 }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', zIndex: 20, marginTop: 6, width: '100%',
            background: '#141418', color: '#e6e6e6', border: '1px solid #2a2d36', borderRadius: 8,
            boxShadow: '0 12px 30px rgba(0,0,0,0.45)'
          }}
        >
          <div style={{ maxHeight, overflow: 'auto', padding: 6 }}>
            {options.map((opt) => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => toggle(opt.value)}
                  style={{ accentColor: '#2c62ff' }}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main dialog ----------------------------------------------------------

export default function MultiStationDialog({ stationIds, onClose, ttlMs = 6 * 60 * 60 * 1000 }: MultiStationDialogProps) {
  const [dataById, setDataById] = useState<Record<string, DataRecord>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Selections
  const [selectedStations, setSelectedStations] = useState<string[]>(stationIds);
  const [selectedVars, setSelectedVars] = useState<string[]>([]); // set after load

  // Load all stations via cache
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setErr(null);

    (async () => {
      try {
        const ids = [...new Set(stationIds)];
        const recs = await Promise.all(ids.map(id => getDataOnce(id, { ttlMs, useETag: true })));
        if (cancelled) return;

        const map: Record<string, DataRecord> = {};
        ids.forEach((id, i) => { map[id] = recs[i]; });
        setDataById(map);

        // discover all numeric variables across all stations; exclude 'timestamp'
        const varSet = new Set<string>();
        for (const r of Object.values(map)) {
          for (const p of (r.points ?? [])) {
            for (const [k, v] of Object.entries(p)) {
              if (k === 'timestamp') continue;
              if (typeof v === 'number' && Number.isFinite(v)) varSet.add(k);
            }
          }
        }
        const all = [...varSet].sort();
        setSelectedVars(all); // default to all vars
        setSelectedStations(ids); // default to all stations
      } catch (e: any) {
        setErr(String(e?.message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [stationIds, ttlMs]);

  // Options for dropdowns
  const stationOptions = useMemo<Option[]>(() => stationIds.map((id) => ({ value: id, label: id })), [stationIds]);
  const varOptions = useMemo<Option[]>(() => {
    const s = new Set<string>();
    for (const r of Object.values(dataById)) {
      for (const p of (r.points ?? [])) {
        for (const [k, v] of Object.entries(p)) {
          if (k === 'timestamp') continue;
          if (typeof v === 'number' && Number.isFinite(v)) s.add(k);
        }
      }
    }
    return [...s].sort().map(v => ({ value: v, label: v }));
  }, [dataById]);

  // Build merged rows given selections
  const { rows, seriesKeys } = useMemo(() => {
    const vars = selectedVars.length ? selectedVars : [];
    const stns = selectedStations.length ? selectedStations : [];

    const rowsMap = new Map<number, any>(); // t(ms) -> row
    for (const id of stns) {
      const rec = dataById[id];
      if (!rec?.points?.length) continue;
      for (const p of rec.points) {
        const t = Date.parse(p.timestamp);
        if (!Number.isFinite(t)) continue;
        const row = rowsMap.get(t) ?? { t };
        for (const k of vars) {
          const v = (p as any)[k];
          if (typeof v === 'number' && Number.isFinite(v)) {
            row[`${id}:${k}`] = v;
          }
        }
        rowsMap.set(t, row);
      }
    }

    const rows = [...rowsMap.values()].sort((a, b) => a.t - b.t);
    const seriesKeys = selectedVars.flatMap((k) => selectedStations.map((id) => `${id}:${k}`));

    return { rows, seriesKeys };
  }, [dataById, selectedVars, selectedStations]);

  const anySeries = seriesKeys.length > 0 && rows.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)', display: 'grid', placeItems: 'center', zIndex: 1000 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '92vw', height: '86vh', background: '#111', color: '#fff', borderRadius: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,0.6)', display: 'grid', gridTemplateRows: '48px auto 1fr', overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12, borderBottom: '1px solid #222' }}>
          <strong>Viewing {selectedStations.length} station{selectedStations.length !== 1 ? 's' : ''}</strong>
          <span style={{ opacity: 0.7, fontSize: 12 }}>
            {loading ? 'Loading…' : `${rows.length} time steps • ${seriesKeys.length} series`}
          </span>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: '#333', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
            Close
          </button>
        </div>

        {/* Controls */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: 12, padding: '8px 12px', borderBottom: '1px solid #222', alignItems: 'start' }}>
          <DropdownMulti
            label="Stations"
            options={stationOptions}
            selected={selectedStations}
            onChange={setSelectedStations}
          />
          <DropdownMulti
            label="Variables"
            options={varOptions}
            selected={selectedVars}
            onChange={setSelectedVars}
          />
          <div style={{ alignSelf: 'center', color: '#a0a4b0', fontSize: 12 }}>
            Tip: Use the dropdowns to filter series.
          </div>
        </div>

        {/* Chart */}
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
                  contentStyle={{ background: '#3a3a3a', border: '1px solid #555', borderRadius: 8, color: '#f0f0f0' }}
                  labelStyle={{ color: '#ddd' }}
                  itemStyle={{ color: '#eee' }}
                  wrapperStyle={{ outline: 'none', zIndex: 1001 }}
                  cursor={{ fill: 'rgba(180,180,180,0.08)' }}
                />
                <Legend />
                {anySeries ? (
                  seriesKeys.map((k) => (
                    <Line key={k} type="monotone" dataKey={k} dot={false} isAnimationActive={false} />
                  ))
                ) : (
                  <></>
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
