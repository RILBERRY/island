import { useMemo, useState } from 'react';
import { useStore, placeName } from '../store';
import { Icon, PlaceIcon } from './icons';
import type { Place } from '../world/types';

const CATEGORIES = ['All', 'Community', 'Waterfront', 'Street', 'Stay', 'Transport', 'Address'];

export function usePlaceSearch(query: string, category = 'All'): Place[] {
  const world = useStore((s) => s.world);
  return useMemo(() => {
    if (!world) return [];
    const all = [...world.places, ...world.addresses];
    const q = query.trim().toLowerCase();
    return all.filter((p) => (category === 'All' || p.category === category) && (!q || p.name.toLowerCase().includes(q) || p.nameDv.includes(q) || p.category.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || (p.island ?? '').toLowerCase().includes(q))).sort((a, b) => (a.island === 'Isdhoo' ? 0 : 1) - (b.island === 'Isdhoo' ? 0 : 1));
  }, [world, query, category]);
}

export function PlacesPanel() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const results = usePlaceSearch(q, cat);
  const language = useStore((s) => s.settings.language);
  const world = useStore((s) => s.world)!;
  const st = useStore.getState();
  return (
    <div className="places">
      <label className="search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search places, streets or addresses" aria-label="Search places" /></label>
      <div className="chips">{CATEGORIES.map((c) => <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}</div>
      {results.length === 0 && <div className="empty-state"><Icon name="map" size={30} /><h4>No places found</h4><p>Try “harbour”, “mosque”, or another category.</p></div>}
      {results.map((p) => (
        <button key={p.id} className="place-row" onClick={() => { st.setSelectedPlace(p); st.setWalkTarget(null); }}>
          <span className="place-icon" style={{ background: p.color }}><PlaceIcon icon={p.icon} /></span>
          <span className="place-text"><strong className={language === 'dv' && p.nameDv ? 'dv' : ''}>{placeName(p, language)}</strong><small>{p.category}{p.island ? ` · ${p.island}` : ''} · {(() => { const d = Math.hypot(p.x - (st.profile?.home?.x ?? world.spawn.x), p.z - (st.profile?.home?.z ?? world.spawn.z)); return d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`; })()} from {st.profile?.home ? 'home' : 'the jetty'}</small></span>
          <Icon name="back" size={16} style={{ transform: 'rotate(180deg)' }} />
        </button>
      ))}
      <p className="muted small">{world.coverage.notes} Data © <a href={world.source.licenseUrl} target="_blank" rel="noreferrer">OpenStreetMap contributors</a>.</p>
    </div>
  );
}
