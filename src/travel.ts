// Transport modes, teleportation and sea travel.
import { useStore, localPos } from './store';
import { input } from './input';
import { nearestWalkable, nearestLanding } from './world/geometry';
import { seaRoute } from './world/sea';
import { roadRoute } from './world/roadRoute';
import { sfx } from './audio';
import type { TransportMode } from '../shared/protocol';
import type { Landing } from './world/types';

export const MODE_INFO: Record<TransportMode, { label: string; emoji: string; speed: number; fast: number; turn: number; blurb: string }> = {
  walk: { label: 'Walk', emoji: '🚶', speed: 2.6, fast: 4.6, turn: 14, blurb: 'Stroll the lanes. Shift to jog.' },
  bicycle: { label: 'Bicycle', emoji: '🚲', speed: 6.5, fast: 8.5, turn: 8, blurb: 'About 2.5× walking speed, goes anywhere. H rings the bell.' },
  car: { label: 'Car', emoji: '🚗', speed: 12, fast: 17, turn: 5, blurb: 'About 4.5× walking speed. Cars stay on the road. H honks.' },
  boat: { label: 'Dhoni', emoji: '⛵', speed: 20, fast: 28, turn: 2.4, blurb: 'Boats stay on the water. Sail to another island from Travel, or dock at any jetty.' },
};

export const BOARD_RADIUS = 45;
export const DOCK_RADIUS = 40;

/** Auto-sail speed grows with distance: a set cruising speed for nearby islands, faster for far ones. */
export function sailSpeed(distance: number): number {
  return Math.max(25, Math.min(110, distance / 120));
}
export function fmtEta(seconds: number): string {
  const s = Math.max(1, Math.round(seconds));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min`;
}
export function fmtDist(m: number): string { return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`; }

export function setMode(mode: TransportMode): boolean {
  const st = useStore.getState();
  if (st.mode === mode) return true;
  if (mode === 'boat') { st.toast('Walk to a jetty and board a dhoni from the Travel panel.'); return false; }
  if (st.mode === 'boat') {
    const near = st.world ? nearestLanding(st.world, localPos.x, localPos.z, 'water') : null;
    if (!near || near.dist > DOCK_RADIUS) { st.toast('Dock at a jetty first.', 'error'); return false; }
    dockAt(near.landing);
    if (mode === 'walk') return true;
  }
  if (mode === 'car' && st.roadTest && !st.roadTest(localPos.x, localPos.z)) { st.toast('Cars stay on the road. Walk onto a street first.', 'error'); return false; }
  st.setMode(mode);
  try { localStorage.setItem('l15.mode', mode); } catch { /* ignore */ }
  if (mode === 'car') input.orbit.targetDistance = Math.max(input.orbit.targetDistance, 30);
  else if (mode === 'bicycle') input.orbit.targetDistance = Math.max(input.orbit.targetDistance, 22);
  sfx('tap');
  st.toast(`${MODE_INFO[mode].emoji} ${MODE_INFO[mode].label}${mode === 'walk' ? '' : ` · ${MODE_INFO[mode].blurb}`}`);
  return true;
}

export function loadMode(): TransportMode {
  try { const m = localStorage.getItem('l15.mode'); if (m === 'bicycle' || m === 'car') return m; } catch { /* ignore */ }
  return 'walk';
}

/** Instant travel: short fade, then the character and camera appear at the closest open spot. */
export function teleportTo(x: number, z: number, label: string): boolean {
  const st = useStore.getState();
  const spot = st.walkTest ? nearestWalkable(st.walkTest, x, z, 90) : { x, z };
  if (!spot) { st.toast('There is no open spot to land on near there.', 'error'); return false; }
  st.setTeleporting({ label, at: Date.now() });
  sfx('teleport');
  window.setTimeout(() => {
    const s = useStore.getState();
    localPos.x = spot.x; localPos.z = spot.z;
    input.snapCamera = true;
    s.setWalkTarget(null); s.setFollowAvatar(true); s.setSailing(null);
    if (s.mode === 'boat' || (s.mode === 'car' && s.roadTest && !s.roadTest(spot.x, spot.z))) { s.setMode('walk'); s.toast('You arrive on foot.'); }
  }, 380);
  window.setTimeout(() => useStore.getState().setTeleporting(null), 950);
  return true;
}

function waterSpot(x: number, z: number): { x: number; z: number } | null {
  const st = useStore.getState();
  return st.waterTest ? nearestWalkable(st.waterTest, x, z, 220) : { x, z };
}

export function boardBoat(landing: Landing): boolean {
  const st = useStore.getState();
  if (st.mode === 'boat') return true;
  const spot = waterSpot(landing.water[0], landing.water[1]);
  if (!spot) { st.toast('No open water near that jetty.', 'error'); return false; }
  localPos.x = spot.x; localPos.z = spot.z;
  localPos.rot = Math.atan2(landing.water[0] - landing.dock[0], landing.water[1] - landing.dock[1]);
  st.setMode('boat');
  st.setWalkTarget(null); st.setFollowAvatar(true);
  input.orbit.targetDistance = Math.max(input.orbit.targetDistance, 48);
  input.snapCamera = true;
  sfx('tap');
  st.toast(`⛵ You're aboard at ${landing.name}. Steer with WASD, or pick an island in Travel.`);
  return true;
}

export function dockAt(landing: Landing): void {
  const st = useStore.getState();
  const spot = st.walkTest ? nearestWalkable(st.walkTest, landing.dock[0], landing.dock[1], 80) ?? { x: landing.dock[0], z: landing.dock[1] } : { x: landing.dock[0], z: landing.dock[1] };
  localPos.x = spot.x; localPos.z = spot.z;
  st.setSailing(null);
  st.setMode('walk');
  input.snapCamera = true;
  sfx('tap');
  st.toast(`⚓ Docked at ${landing.name}. Welcome to ${landing.island}.`, 'success');
}

export function sailTo(landing: Landing): boolean {
  const st = useStore.getState();
  if (!st.world) return false;
  if (st.mode !== 'boat') { st.toast('Board a dhoni first.', 'error'); return false; }
  const waypoints = seaRoute(st.world, localPos.x, localPos.z, landing.water[0], landing.water[1]);
  let total = 0;
  for (let i = 1; i < waypoints.length; i++) total += Math.hypot(waypoints[i][0] - waypoints[i - 1][0], waypoints[i][1] - waypoints[i - 1][1]);
  const speed = sailSpeed(total);
  st.setSailing({ dest: landing, waypoints, index: 1, speed, total, startedAt: Date.now() });
  st.setFollowAvatar(true);
  sfx('tap');
  st.toast(`⛵ Sailing to ${landing.island} · ${fmtDist(total)} · about ${fmtEta(total / speed)} at ${Math.round(speed * 3.6)} km/h`);
  return true;
}

export function stopSailing(): void {
  const st = useStore.getState();
  if (!st.sailing) return;
  st.setSailing(null);
  st.toast('Sailing stopped. You have the helm.');
}

/** Instant crossing by ferry: arrive in the boat at the island's landing, or on foot at its jetty. */
export function ferryTo(landing: Landing): boolean {
  const st = useStore.getState();
  const inBoat = st.mode === 'boat';
  st.setTeleporting({ label: `${landing.island} by ferry`, at: Date.now() });
  sfx('teleport');
  window.setTimeout(() => {
    const s = useStore.getState();
    s.setSailing(null);
    if (inBoat) {
      const spot = waterSpot(landing.water[0], landing.water[1]) ?? { x: landing.water[0], z: landing.water[1] };
      localPos.x = spot.x; localPos.z = spot.z;
    } else {
      const spot = s.walkTest ? nearestWalkable(s.walkTest, landing.dock[0], landing.dock[1], 80) ?? { x: landing.dock[0], z: landing.dock[1] } : { x: landing.dock[0], z: landing.dock[1] };
      localPos.x = spot.x; localPos.z = spot.z;
      if (s.mode === 'car') s.setMode('walk');
    }
    input.snapCamera = true;
    s.setWalkTarget(null); s.setFollowAvatar(true);
    s.toast(`Welcome to ${landing.island}.`, 'success');
  }, 380);
  window.setTimeout(() => useStore.getState().setTeleporting(null), 950);
  return true;
}

/** Travel by road: snap to the nearest road, follow the shortest route, auto-drive at the current mode's speed. */
export function driveTo(x: number, z: number, label: string): boolean {
  const st = useStore.getState();
  if (!st.world) return false;
  if (st.mode === 'boat') { st.toast('Dock first, then travel by road.', 'error'); return false; }
  const car = st.mode === 'car';
  const route = roadRoute(st.world, localPos.x, localPos.z, x, z, car);
  if (!route) { st.toast('No road connects here to there. Try the boat or a teleport.', 'error'); return false; }
  const speed = MODE_INFO[st.mode].fast;
  st.setDriving({ label, waypoints: route.points, index: 1, speed, total: route.length, startedAt: Date.now() });
  st.setWalkTarget(null); st.setFollowAvatar(true);
  sfx('tap');
  const verb = st.mode === 'car' ? 'Driving' : st.mode === 'bicycle' ? 'Riding' : 'Walking';
  st.toast(`${MODE_INFO[st.mode].emoji} ${verb} to ${label} by road · ${fmtDist(route.length)} · about ${fmtEta(route.length / speed)}${route.reachesDestination ? '' : ' · ends at the nearest street'}`);
  return true;
}

export function stopDriving(): void {
  const st = useStore.getState();
  if (!st.driving) return;
  st.setDriving(null);
  st.toast('Route cancelled. You have the wheel.');
}
