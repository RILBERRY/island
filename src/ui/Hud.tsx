import { useEffect, useState } from 'react';
import { useStore, placeName } from '../store';
import { send, sendProfile } from '../net/socket';
import { Icon } from './icons';
import { Joystick } from './Joystick';
import { Minimap } from './Minimap';
import { islandClock } from '../../shared/daylight';
import { QUICK_REACTIONS, EMOTES } from '../../shared/profile';
import { sfx } from '../audio';
import { input, setOverview, zoomBy, OVERVIEW_DIST } from '../input';
import { teleportTo, boardBoat, dockAt, ferryTo, stopSailing, fmtEta, BOARD_RADIUS, DOCK_RADIUS, driveTo, stopDriving, MODE_INFO } from '../travel';
import { nearestLanding } from '../world/geometry';
import { localPos } from '../store';

function TopBar() {
  const world = useStore((s) => s.world)!;
  const profile = useStore((s) => s.profile)!;
  const daylight = useStore((s) => s.daylight);
  const connection = useStore((s) => s.connection);
  const language = useStore((s) => s.settings.language);
  const players = useStore((s) => Object.keys(s.players).length);
  const [clock, setClock] = useState(islandClock(new Date()));
  useEffect(() => { const t = setInterval(() => setClock(islandClock(new Date())), 10000); return () => clearInterval(t); }, []);
  const setPanel = useStore((s) => s.setPanel);
  return (
    <header className="topbar">
      <div className="brand" onClick={() => setPanel('about')} role="button" tabIndex={0}>
        <span className="brand-mark">L15</span>
        <span className="brand-sub">{language === 'dv' ? world.island.nameDv : world.island.name}<small>{language === 'dv' ? 'ލ. އިސްދޫ' : `L. ${world.island.name} · ${world.island.postcode}`}</small></span>
      </div>
      <div className="topbar-mid">
        <span className="chip"><Icon name={daylight.phase === 'Night' ? 'moon' : 'sun'} size={14} />{clock} · {daylight.phase}</span>
        <span className={`chip conn ${connection}`}><Icon name="wifi" size={14} />{connection === 'online' ? `${players} online` : connection === 'offline' ? 'Offline' : 'Connecting…'}</span>
      </div>
      <button className="profile-button" onClick={() => setPanel('profile')} aria-label="Open your profile">
        <span className="pb-emoji">{profile.emoji}</span><span className="pb-name">{profile.name}<small>Guest · saved in this browser</small></span>
      </button>
    </header>
  );
}

function Dock() {
  const panel = useStore((s) => s.panel);
  const setPanel = useStore((s) => s.setPanel);
  const unread = useStore((s) => s.unread);
  const nearby = useStore((s) => s.nearbyIds.length);
  const myPartyId = useStore((s) => s.myPartyId);
  const [tray, setTray] = useState(false);
  const toggle = (p: typeof panel) => { sfx('tap'); setPanel(panel === p ? null : p); setTray(false); };
  const emote = (e: string) => { send({ t: 'emote', emote: e }); const me = useStore.getState().me; if (me) useStore.getState().setEmote(me, e); setTray(false); };
  const items: { id: Exclude<typeof panel, null>; icon: string; label: string; badge?: number }[] = [
    { id: 'chat', icon: 'chat', label: 'Global chat', badge: unread },
    { id: 'nearby', icon: 'users', label: 'Nearby islanders', badge: nearby },
    { id: 'places', icon: 'map', label: 'Find a location' },
    { id: 'games', icon: 'games', label: myPartyId ? 'Your party' : 'Games' },
    { id: 'travel', icon: 'car', label: 'Travel' },
    { id: 'settings', icon: 'settings', label: 'Settings' },
  ];
  return (
    <nav className="dock" aria-label="Island tools">
      {items.map((it) => (
        <button key={it.id} className={`dock-button ${panel === it.id ? 'active' : ''}`} onClick={() => toggle(it.id)} aria-label={it.label} title={it.label}>
          <Icon name={it.icon} size={20} />{it.badge ? <span className="dock-badge">{it.badge > 99 ? '99+' : it.badge}</span> : null}
          <small>{it.label.split(' ')[0]}</small>
        </button>
      ))}
      <div className="dock-divider" />
      <div className="dock-emote">
        <button className={`dock-button ${tray ? 'active' : ''}`} onClick={() => { sfx('tap'); setTray((t) => !t); }} aria-label="Send an emote" title="Send an emote"><Icon name="smile" size={20} /><small>Emote</small></button>
        {tray && (
          <div className="emote-tray">
            {EMOTES.map((e) => <button key={e.id} aria-label={e.label} title={e.label} onClick={() => emote(e.id)}>{e.emoji}</button>)}
            {QUICK_REACTIONS.filter((r) => !EMOTES.some((e) => e.emoji === r)).map((r) => <button key={r} aria-label={`React with ${r}`} onClick={() => emote(r)}>{r}</button>)}
          </div>
        )}
      </div>
    </nav>
  );
}

function CornerTools() {
  const [overview, setOv] = useState(false);
  const follow = useStore((s) => s.followAvatar);
  useEffect(() => { const t = setInterval(() => setOv(input.orbit.targetDistance >= OVERVIEW_DIST * 0.8), 500); return () => clearInterval(t); }, []);
  return (
    <div className="corner-tools">
      <button className={`corner-button ${overview ? 'active' : ''}`} aria-label={overview ? 'Back to your character' : 'Island overview'} title={overview ? 'Back to your character' : 'Island overview'} onClick={() => { sfx('tap'); setOverview(!overview); setOv(!overview); }}><Icon name="compass" size={18} /></button>
      <button className="corner-button" aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy(0.7)}><Icon name="plus" size={18} /></button>
      <button className="corner-button" aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(1.4)}><Icon name="minus" size={18} /></button>
      {!follow && <button className="corner-button" aria-label="Follow my avatar" title="Follow my avatar" onClick={() => useStore.getState().setFollowAvatar(true)}><Icon name="locate" size={18} /></button>}
    </div>
  );
}

function HarbourPrompt() {
  const world = useStore((s) => s.world)!;
  const mode = useStore((s) => s.mode);
  const sailing = useStore((s) => s.sailing);
  const driving = useStore((s) => s.driving);
  const [near, setNear] = useState<{ landing: import('../world/types').Landing; dist: number } | null>(null);
  const [eta, setEta] = useState('');
  useEffect(() => {
    const t = setInterval(() => {
      const n = nearestLanding(world, localPos.x, localPos.z, mode === 'boat' ? 'water' : 'dock');
      const limit = mode === 'boat' ? DOCK_RADIUS : BOARD_RADIUS;
      setNear(n && n.dist <= limit ? n : null);
      const s = useStore.getState().sailing ?? useStore.getState().driving;
      if (s) { let rem = 0; for (let i = s.index; i < s.waypoints.length; i++) { const a = i === s.index ? [localPos.x, localPos.z] : s.waypoints[i - 1]; rem += Math.hypot(s.waypoints[i][0] - a[0], s.waypoints[i][1] - a[1]); } setEta(fmtEta(rem / s.speed)); }
    }, 400);
    return () => clearInterval(t);
  }, [world, mode]);
  if (driving) return <div className="harbour-prompt"><span>{MODE_INFO[mode].emoji} To <strong>{driving.label}</strong> by road · {eta}</span><button className="quiet" onClick={stopDriving}>Stop</button></div>;
  if (sailing) return <div className="harbour-prompt"><span>⛵ Sailing to <strong>{sailing.dest.island}</strong> · {eta}</span><button onClick={() => ferryTo(sailing.dest)}>Skip ahead</button><button className="quiet" onClick={stopSailing}>Stop</button></div>;
  if (!near) return null;
  if (mode === 'boat') return <div className="harbour-prompt"><span>⚓ {near.landing.name}</span><button onClick={() => dockAt(near.landing)}>Dock here</button></div>;
  if (mode === 'walk' || mode === 'bicycle') return <div className="harbour-prompt"><span>⚓ {near.landing.name}</span><button onClick={() => boardBoat(near.landing)}>Board a dhoni</button><button className="quiet" onClick={() => useStore.getState().setPanel('travel')}>Islands…</button></div>;
  return null;
}

function TeleportOverlay() {
  const t = useStore((s) => s.teleporting);
  if (!t) return null;
  return <div className="teleport-fade"><span className="brand-mark">L15</span><p>Flying to {t.label}…</p></div>;
}

function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => <button key={t.id} className={`toast ${t.kind}`} onClick={() => dismiss(t.id)}>{t.text}</button>)}
    </div>
  );
}

function WaveNotice() {
  const wave = useStore((s) => s.wave);
  const setWave = useStore((s) => s.setWave);
  useEffect(() => { if (!wave) return; const t = setTimeout(() => setWave(null), 8000); return () => clearTimeout(t); }, [wave, setWave]);
  if (!wave) return null;
  return (
    <div className="wave-notice">
      <span className="wn-emoji">{wave.from.emoji}</span>
      <div><strong>{wave.from.name}</strong> waved at you 👋</div>
      <button onClick={() => { send({ t: 'wave', to: wave.from.id }); send({ t: 'emote', emote: 'wave' }); const me = useStore.getState().me; if (me) useStore.getState().setEmote(me, 'wave'); setWave(null); }}>Wave back</button>
      <button className="quiet" onClick={() => setWave(null)} aria-label="Dismiss notification"><Icon name="x" size={14} /></button>
    </div>
  );
}

function PlaceCard() {
  const place = useStore((s) => s.selectedPlace);
  const language = useStore((s) => s.settings.language);
  const profile = useStore((s) => s.profile)!;
  const setProfile = useStore((s) => s.setProfile);
  if (!place) return null;
  const st = useStore.getState();
  const setHome = () => {
    const spot = st.walkTest ? nearest(st.walkTest, place.x, place.z) : { x: place.x, z: place.z };
    setProfile({ ...profile, home: { x: spot.x, z: spot.z, label: place.name } });
    st.toast(`Home set to ${place.name}. You'll start here next time.`, 'success');
    sendProfile();
  };
  return (
    <div className="place-card">
      <div className="pc-head">
        <strong className={language === 'dv' && place.nameDv ? 'dv' : ''}>{placeName(place, language)}</strong>
        <button className="quiet" aria-label="Close location details" onClick={() => st.setSelectedPlace(null)}><Icon name="x" size={16} /></button>
      </div>
      <small>{place.category}{place.nameDv && language !== 'dv' ? <> · <span className="dv">{place.nameDv}</span></> : null}</small>
      {place.description && <p>{place.description}</p>}
      <p className="review">{place.review}{place.source && <> · <a href={place.source} target="_blank" rel="noreferrer">View source ↗</a></>}</p>
      <div className="pc-actions">
        <button onClick={() => { const spot = st.walkTest ? nearest(st.walkTest, place.x, place.z) : place; st.setWalkTarget({ x: spot.x, z: spot.z }); st.setFollowAvatar(true); }}><Icon name="walk" size={14} /> Walk there</button>
        <button className="secondary" onClick={() => { if (driveTo(place.x, place.z, place.name)) st.setSelectedPlace(null); }}><Icon name="road" size={14} /> By road</button>
        <button className="secondary" onClick={() => { if (teleportTo(place.x, place.z, place.name)) st.setSelectedPlace(null); }}><Icon name="sparkles" size={14} /> Teleport</button>
        <button className="secondary" onClick={setHome}><Icon name="home" size={14} /> Set as home</button>
      </div>
    </div>
  );
}

function nearest(test: (x: number, z: number) => boolean, x: number, z: number) {
  if (test(x, z)) return { x, z };
  for (let r = 2; r < 60; r += 2) for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (test(px, pz)) return { x: px, z: pz }; }
  return { x, z };
}

function CatPopup() {
  const cat = useStore((s) => s.catPopup);
  const set = useStore((s) => s.setCatPopup);
  if (!cat) return null;
  return (
    <div className="cat-popup">
      <div className="pc-head"><strong>🐾 {cat.name}</strong><button className="quiet" aria-label="Close" onClick={() => set(null)}><Icon name="x" size={16} /></button></div>
      <p>{cat.status}</p>
      <small>Island cats wander Isdhoo. Walk close and tap to pat them.</small>
    </div>
  );
}

function ControlsHint() {
  const [hide, setHide] = useState(() => { try { return localStorage.getItem('l15.hint') === '1'; } catch { return false; } });
  if (hide) return null;
  const coarse = matchMedia('(pointer: coarse)').matches;
  return (
    <div className="controls-hint">
      {coarse ? 'Joystick to move, drag to rotate, pinch to zoom, two fingers up/down to tilt. Travel for bikes, cars, boats and teleports.' : 'WASD to move, Shift for speed. Drag or Q/E to rotate, right-drag to tilt, scroll to zoom. 1/2/3 walk, bike, car · T to travel.'}
      <button onClick={() => { setHide(true); try { localStorage.setItem('l15.hint', '1'); } catch { /* ignore */ } }} aria-label="Hide hint"><Icon name="x" size={12} /></button>
    </div>
  );
}

export function Hud() {
  return (
    <div className="hud">
      <TopBar />
      <CornerTools />
      <TeleportOverlay />
      <HarbourPrompt />
      <Toasts />
      <WaveNotice />
      <PlaceCard />
      <CatPopup />
      <Minimap />
      <Joystick />
      <ControlsHint />
      <Dock />
    </div>
  );
}
