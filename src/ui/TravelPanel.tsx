import { useMemo, useState } from 'react';
import { useStore, localPos, placeName } from '../store';
import { Icon, PlaceIcon } from './icons';
import { usePlaceSearch } from './PlacesPanel';
import { MODE_INFO, setMode, teleportTo, driveTo, boardBoat, dockAt, sailTo, ferryTo, stopSailing, sailSpeed, fmtEta, fmtDist, BOARD_RADIUS, DOCK_RADIUS } from '../travel';
import { nearestLanding } from '../world/geometry';
import type { TransportMode } from '../../shared/protocol';

const MODE_ICON: Record<TransportMode, string> = { walk: 'walk', bicycle: 'bike', car: 'car', boat: 'boat' };

export function TravelPanel() {
  const mode = useStore((s) => s.mode);
  const profile = useStore((s) => s.profile)!;
  const players = useStore((s) => s.players);
  const me = useStore((s) => s.me);
  const language = useStore((s) => s.settings.language);
  const [q, setQ] = useState('');
  const places = usePlaceSearch(q);
  const others = useMemo(() => Object.values(players).filter((p) => p.id !== me).map((p) => ({ p, d: Math.hypot(p.x - localPos.x, p.z - localPos.z) })).sort((a, b) => a.d - b.d).slice(0, 6), [players, me]);
  const go = (x: number, z: number, label: string) => { if (teleportTo(x, z, label)) useStore.getState().setPanel(null); };
  const world = useStore((s) => s.world)!;
  const sailing = useStore((s) => s.sailing);
  const inBoat = mode === 'boat';
  const nearDock = useMemo(() => nearestLanding(world, localPos.x, localPos.z, 'dock'), [world, mode, sailing]);
  const nearWater = useMemo(() => nearestLanding(world, localPos.x, localPos.z, 'water'), [world, mode, sailing]);
  const islands = useMemo(() => (world.landings ?? []).map((l) => ({ l, d: Math.hypot(l.water[0] - localPos.x, l.water[1] - localPos.z), isl: world.coastlines.find((c) => c.name === l.island) })).filter((x) => x.d > 60).sort((a, b) => a.d - b.d), [world, mode, sailing]);
  const close = () => useStore.getState().setPanel(null);
  return (
    <div className="travel">
      <h3>Get around</h3>
      <div className="mode-grid">
        {(['walk', 'bicycle', 'car'] as TransportMode[]).map((m) => (
          <button key={m} className={`mode-card ${mode === m ? 'on' : ''}`} onClick={() => setMode(m)} aria-pressed={mode === m}>
            <Icon name={MODE_ICON[m]} size={26} /><strong>{MODE_INFO[m].label}</strong><small>{m === 'walk' ? 'Shift to jog' : `${MODE_INFO[m].speed} m/s · Shift for more`}</small>
          </button>
        ))}
      </div>
      <p className="muted small">Keys 1, 2, 3 switch modes. Cars only run on streets; bicycles go anywhere. Press H for the bell or horn.</p>
      <h3><Icon name="boat" size={14} /> By sea</h3>
      {!inBoat && nearDock && nearDock.dist <= BOARD_RADIUS && <button className="wide" onClick={() => { if (boardBoat(nearDock.landing)) close(); }}><Icon name="anchor" size={14} /> Board a dhoni at {nearDock.landing.name}</button>}
      {!inBoat && nearDock && nearDock.dist > BOARD_RADIUS && (
        <div className="sea-hint"><p className="muted small">Boats leave from jetties. Nearest: <strong>{nearDock.landing.name}</strong> · {fmtDist(nearDock.dist)}.</p>
          <div className="row"><button className="small" onClick={() => { useStore.getState().setWalkTarget({ x: nearDock.landing.dock[0], z: nearDock.landing.dock[1] }); close(); }}><Icon name="walk" size={14} /> Walk there</button><button className="small secondary" onClick={() => go(nearDock.landing.dock[0], nearDock.landing.dock[1], nearDock.landing.name)}><Icon name="sparkles" size={14} /> Teleport</button></div></div>
      )}
      {inBoat && sailing && <div className="notice"><Icon name="boat" size={16} /><p>Sailing to <strong>{sailing.dest.island}</strong> at {Math.round(sailing.speed * 3.6)} km/h. <button className="quiet" onClick={stopSailing}>Stop</button><button className="quiet" onClick={() => { ferryTo(sailing.dest); close(); }}>Skip ahead</button></p></div>}
      {inBoat && nearWater && nearWater.dist <= DOCK_RADIUS && <button className="wide" onClick={() => { dockAt(nearWater.landing); close(); }}><Icon name="anchor" size={14} /> Dock at {nearWater.landing.name}</button>}
      {inBoat && <p className="muted small">Steer with WASD or the joystick, or pick an island. Sailing speed rises with distance: nearby islands at {Math.round(sailSpeed(0) * 3.6)} km/h, far ones up to {Math.round(sailSpeed(1e9) * 3.6)} km/h. The ferry is instant.</p>}
      {(inBoat || (nearDock && nearDock.dist <= BOARD_RADIUS)) && islands.slice(0, 40).map(({ l, d, isl }) => (
        <div key={l.id} className="sea-row">
          <span className="place-icon" style={{ background: isl?.inhabited ? '#2f6f8f' : '#6a8f7a' }}><Icon name={l.kind === 'beach' ? 'map' : 'anchor'} size={14} /></span>
          <span className="place-text"><strong>{l.island}{isl?.nameDv && <> <span className="dv">{isl.nameDv}</span></>}</strong><small>{isl?.inhabited ? 'Inhabited' : isl?.note || (isl?.kind === 'islet' ? 'Islet' : 'Island')} · {fmtDist(d)} · ~{fmtEta(d / sailSpeed(d))} by boat · {l.name}</small></span>
          <span className="sea-actions">{inBoat && <button className="small" onClick={() => { if (sailTo(l)) close(); }}>Sail</button>}<button className="small secondary" onClick={() => { ferryTo(l); close(); }}>Ferry</button></span>
        </div>
      ))}
      <h3><Icon name="sparkles" size={14} /> Teleport</h3>
      <p className="muted small">Instant travel to a place, home, or next to an islander. You land at the nearest open spot.</p>
      {profile.home && <button className="place-row" onClick={() => go(profile.home!.x, profile.home!.z, profile.home!.label || 'Home')}><span className="place-icon" style={{ background: '#ef6a58' }}><Icon name="home" size={14} /></span><span className="place-text"><strong>Home</strong><small>{profile.home.label}</small></span><Icon name="sparkles" size={16} /></button>}
      {others.length > 0 && (<>
        <h4 className="muted small">Islanders</h4>
        {others.map(({ p, d }) => <button key={p.id} className="place-row" onClick={() => go(p.x, p.z, p.name)}><span className="place-icon" style={{ background: '#f3eedb', color: '#000' }}>{p.emoji}</span><span className="place-text"><strong>{p.name}</strong><small>{d < 1000 ? `${Math.round(d)} m away` : `${(d / 1000).toFixed(1)} km away`}{p.mode && p.mode !== 'walk' ? ` · ${MODE_INFO[p.mode].emoji}` : ''}</small></span><Icon name="sparkles" size={16} /></button>)}
      </>)}
      <label className="search"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search places" aria-label="Search places to teleport to" /></label>
      <p className="muted small">Teleport is instant. “Road” snaps to the nearest street and follows the shortest route in your current mode (cars stay on streets).</p>
      {places.slice(0, 60).map((p) => (
        <div key={p.id} className="sea-row">
          <span className="place-icon" style={{ background: p.color }}><PlaceIcon icon={p.icon} /></span>
          <span className="place-text"><strong className={language === 'dv' && p.nameDv ? 'dv' : ''}>{placeName(p, language)}</strong><small>{p.category}{p.island ? ` · ${p.island}` : ''} · {fmtDist(Math.hypot(p.x - localPos.x, p.z - localPos.z))} away</small></span>
          <span className="sea-actions">{!inBoat && <button className="small secondary" onClick={() => { if (driveTo(p.x, p.z, p.name)) close(); }}><Icon name="road" size={13} /> Road</button>}<button className="small" onClick={() => go(p.x, p.z, p.name)}><Icon name="sparkles" size={13} /></button></span>
        </div>
      ))}
    </div>
  );
}
