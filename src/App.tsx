import { lazy, Suspense, useEffect } from 'react';
import { useStore, loadProfile, localPos } from './store';
import type { World } from './world/types';
import { generateHouses, makeObstacles, makeWalkTest, makeWaterTest, makeRoadTest, nearestWalkable, illustrativeMosque } from './world/geometry';
import { connect, disconnect } from './net/socket';
import { installKeyboard, input, FOLLOW_DIST } from './input';
import { computeDaylight } from '../shared/daylight';
import { Hud } from './ui/Hud';
import { Panels } from './ui/Panels';
import { StartScreen } from './ui/StartScreen';
import { Onboarding } from './ui/Onboarding';
import { TableHost } from './games/TableHost';
import { applyVolumes } from './audio';
import { NEARBY_RADIUS } from '../shared/protocol';
import type { Profile } from '../shared/profile';
import { loadMode } from './travel';

const IslandScene = lazy(() => import('./scene/IslandScene'));

export default function App() {
  const phase = useStore((s) => s.phase);
  const world = useStore((s) => s.world);
  const panel = useStore((s) => s.panel);
  const settings = useStore((s) => s.settings);

  useEffect(() => {
    fetch('/world/isdhoo.json').then((r) => r.json()).then((w: World) => {
      const houses = generateHouses(w);
      const mosque = illustrativeMosque(w);
      const obstacles = makeObstacles(w.buildings, houses, mosque ? [mosque.points] : []);
      const walkTest = makeWalkTest(w, obstacles);
      useStore.getState().setWorld(w, houses, obstacles, walkTest, makeWaterTest(w), makeRoadTest(w));
      const p = loadProfile();
      if (p) useStore.setState({ profile: p, settings: { ...useStore.getState().settings, language: p.language } });
      useStore.getState().setPhase('start');
    }).catch(() => useStore.getState().toast('The island could not load. Reload the app in a moment.', 'error'));
  }, []);

  useEffect(() => {
    const tick = () => {
      const w = useStore.getState().world;
      const lat = w?.island.latitude ?? 2.1265, lon = w?.island.longitude ?? 73.5795;
      const mode = useStore.getState().settings.daylight;
      let d = computeDaylight(new Date(), lat, lon);
      if (mode === 'day') d = { ...d, elevation: 55, daylight: 1, golden: 0, night: 0, phase: 'Day', sun: { x: 0.3, y: 0.85, z: -0.4 } };
      if (mode === 'night') d = { ...d, elevation: -20, daylight: 0, golden: 0, night: 1, phase: 'Night', sun: { x: 0, y: -0.5, z: 0 } };
      useStore.getState().setDaylight(d);
    };
    tick();
    const t = setInterval(tick, 10000);
    return () => clearInterval(t);
  }, [settings.daylight]);

  useEffect(() => {
    if (phase !== 'island') return;
    const un = installKeyboard();
    connect();
    applyVolumes();
    const nearby = setInterval(() => {
      const s = useStore.getState();
      const ids = Object.values(s.players).filter((p) => p.id !== s.me && Math.hypot(p.x - localPos.x, p.z - localPos.z) <= NEARBY_RADIUS).map((p) => p.id);
      if (ids.join() !== s.nearbyIds.join()) s.setNearbyIds(ids);
      (window as unknown as { __l15pos?: { x: number; z: number } }).__l15pos = { x: localPos.x, z: localPos.z };
    }, 1000);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { useStore.getState().setPanel(null); useStore.getState().setSelectedPlace(null); } };
    window.addEventListener('keydown', esc);
    return () => { un(); disconnect(); clearInterval(nearby); window.removeEventListener('keydown', esc); };
  }, [phase]);

  const enterIsland = (p: Profile) => {
    const st = useStore.getState();
    st.setProfile(p);
    const w = st.world!;
    const start = p.home ?? w.spawn;
    const spot = st.walkTest ? nearestWalkable(st.walkTest, start.x, start.z, 60) ?? w.spawn : start;
    localPos.x = spot.x; localPos.z = spot.z; localPos.rot = 0; localPos.ready = true;
    input.orbit.yaw = input.orbit.targetYaw = Math.PI + 0.35; input.orbit.distance = input.orbit.targetDistance = FOLLOW_DIST;
    st.setSettings({ language: p.language });
    st.setMode(loadMode());
    st.setPhase('island');
  };

  if (phase === 'loading' || !world) return <div className="loading"><span className="brand-mark big">L15</span><p>Loading the island…</p></div>;
  if (phase === 'start') return <><StartScreen onStart={() => enterIsland(useStore.getState().profile!)} onNew={() => useStore.getState().setPhase('onboarding')} />{panel === 'about' && <Panels />}</>;
  if (phase === 'onboarding') return <Onboarding onDone={enterIsland} />;
  return (
    <div className="app">
      <Suspense fallback={<div className="loading"><span className="brand-mark big">L15</span><p>Flying to Isdhoo…</p></div>}>
        <IslandScene />
      </Suspense>
      <Hud />
      <Panels />
      <TableHost />
    </div>
  );
}
