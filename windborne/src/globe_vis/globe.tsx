import React, { useEffect, useCallback, useMemo, useState } from 'react';
import GlobeStations from './vis.tsx';
import StationDialog from '../utils/stationDialog.tsx';

type DatasetOption = {
  label: string;
  countriesUrl: string;
};

// 👇 Put your real files here. If you only have one set, keep just the first option.
const DATASETS: DatasetOption[] = [
  { label: 'Countries',    countriesUrl: '/geojson/countries.json' },
  { label: 'Land', countriesUrl: '/geojson/ne_110m_land.json' },
  { label: 'Regions', countriesUrl: '/geojson/ne_110m_geography_regions_polys.json' }
];

export default function App() {
    const [datasetIdx, setDatasetIdx] = useState(0);
    const [selected, setSelected] = useState<{ id: string, name: string } | null>(null);

      const makeUrl = useCallback((id: string) => {
        return `https://sfc.windbornesystems.com/historical_weather?station=${id}`;
  }, []);
  // Optional: allow the user to upload their own files
  const [countriesBlobUrl, setCountriesBlobUrl] = useState<string | null>(null);

  // Effective URLs (blob URLs win if present)
  const { countriesUrl  } = useMemo(() => {
    const base = DATASETS[datasetIdx];
    return {
      countriesUrl: countriesBlobUrl ?? base.countriesUrl,
    };
  }, [datasetIdx, countriesBlobUrl]);

  // Clean up blob URLs to avoid leaks
  useEffect(() => {
    return () => {
      if (countriesBlobUrl) URL.revokeObjectURL(countriesBlobUrl);
    };
  }, [countriesBlobUrl]);

  function onChooseDataset(e: React.ChangeEvent<HTMLSelectElement>) {
    setDatasetIdx(Number(e.target.value));
    // Clear custom uploads when switching presets (optional)
    setCountriesBlobUrl(null);
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Controls overlay */}
      <div
        style={{
          position: 'absolute',
          top: 12, left: 12, zIndex: 10,
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
          padding: '8px 12px',
          borderRadius: 8,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          backdropFilter: 'blur(4px)',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Base Map:
          <select value={datasetIdx} onChange={onChooseDataset}>
            {DATASETS.map((d, i) => (
              <option key={d.label} value={i}>{d.label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Globe */}
      <GlobeStations
        countriesUrl={countriesUrl}
        stationUrl= '/geojson1/stations.json'//'https://sfc.windbornesystems.com/stations'
        radius={2}
        onStationClick={({ id, name }) => setSelected({ id, name })}
      />
      {selected && (
        <StationDialog
          stationId={selected.id}
          stationName={selected.name}
          makeUrl={makeUrl}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
