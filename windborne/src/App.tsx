import { useEffect, useState } from 'react';
import Globe from './globe_vis/globe';
import Plain from './plain_view/plain';
import './App.css';

type ViewMode = 'globe' | 'plain';

export default function App() {
  const [mode, setMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('viewMode');
    return (saved === 'plain' || saved === 'globe') ? saved : 'globe';
  });

  useEffect(() => {
    localStorage.setItem('viewMode', mode);
  }, [mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'g') setMode('globe');
      if (e.key === 'p') setMode('plain');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isPlain = mode === 'plain';

  return (
    <div className="app-root">
      {/* Toggle overlay */}
      <div className="toggle">
        <label className="switch" aria-label="Toggle view between Globe and Plain">
          <input
            type="checkbox"
            checked={isPlain}
            onChange={(e) => setMode(e.target.checked ? 'plain' : 'globe')}
          />
          <span className="slider" />
        </label>
        <span className="toggle-label">{isPlain ? 'Plain' : 'Globe'}</span>
      </div>

      {/* View */}
      <div className="view">
        {isPlain ? <Plain /> : <Globe />}
      </div>
    </div>
  );
}

