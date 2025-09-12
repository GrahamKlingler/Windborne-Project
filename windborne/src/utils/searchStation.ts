import { useEffect, useState } from 'react';
import { searchStations, type Station } from './api';

export function useStationSearch(query: string, debounceMs = 250) {
  const [hits, setHits] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true); setErr(null);
      try {
        const res = await searchStations(query ?? '', 200);
        setHits(res);
      } catch (e: any) {
        setErr(String(e?.message ?? e));
      } finally {
        setLoading(false);
      }
    }, debounceMs);
    return () => clearTimeout(t);
  }, [query, debounceMs]);

  return { hits, loading, err };
}
