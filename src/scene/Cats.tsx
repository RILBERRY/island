import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, localPos } from '../store';
import { Character } from './Character';
import { LAND_Y, labelPortal } from './constants';
import { nearestWalkable, rng } from '../world/geometry';
import { defaultCharacter } from '../../shared/profile';
import { sfx } from '../audio';

const CAT_NAMES = ['Kalhu', 'Dhon Kokko', 'Mithuru', 'Bulhaa', 'Rathu', 'Mas Kalo'];
const CAT_FUR = ['#2b2b2b', '#e9a23b', '#9a9a9a', '#f3e9d2', '#c27a3a', '#4a4a4a'];
const STATUSES = ['Fast asleep', 'Strolling about', 'Sitting pretty', 'Stalking something', 'Having a wash', 'Keeping watch', 'Doing zoomies!', 'Chasing its tail', 'Trotting along', 'Having a big stretch'];

interface Cat { id: string; name: string; fur: string; x: number; z: number; rot: number; tx: number; tz: number; state: 'idle' | 'walk'; until: number; status: string; hearts: number }

export function Cats() {
  const world = useStore((s) => s.world);
  const walkTest = useStore((s) => s.walkTest);
  const seeds = useMemo(() => {
    if (!world || !walkTest) return [] as Cat[];
    const rand = rng(77);
    const anchors = [world.spawn, ...world.places.filter((p) => Math.hypot(p.x, p.z) < 400).map((p) => ({ x: p.x, z: p.z })), { x: 0, z: -60 }, { x: -60, z: -120 }];
    const cats: Cat[] = [];
    for (let i = 0; i < 6; i++) {
      const a = anchors[i % anchors.length];
      const spot = nearestWalkable(walkTest, a.x + (rand() - 0.5) * 30, a.z + (rand() - 0.5) * 30, 40);
      if (!spot) continue;
      cats.push({ id: `cat${i}`, name: CAT_NAMES[i], fur: CAT_FUR[i], x: spot.x, z: spot.z, rot: rand() * Math.PI * 2, tx: spot.x, tz: spot.z, state: 'idle', until: 0, status: STATUSES[i % STATUSES.length], hearts: 0 });
    }
    return cats;
  }, [world, walkTest]);
  return <>{seeds.map((c) => <CatActor key={c.id} seed={c} />)}</>;
}

function CatActor({ seed }: { seed: Cat }) {
  const cat = useRef<Cat>({ ...seed });
  const group = useRef<THREE.Group>(null);
  const [anim, setAnim] = useState('idle');
  const [near, setNear] = useState(false);
  const [hearts, setHearts] = useState(0);
  const walkTest = useStore((s) => s.walkTest)!;
  const character = useMemo(() => ({ ...defaultCharacter(), kind: 'animal' as const, animal: 'cat' as const, hairColor: seed.fur, clothesColor: ['#ff6b57', '#087887', '#ffcf3f', '#7a3fb0', '#2f9e7a', '#1e4d8f'][Number(seed.id.slice(3)) % 6] }), [seed]);
  const popup = useStore((s) => s.catPopup);
  const selected = popup?.id === seed.id;

  useFrame((state, dt) => {
    const c = cat.current; const g = group.current; if (!g) return;
    const now = state.clock.elapsedTime;
    if (now > c.until) {
      if (c.state === 'idle' && Math.random() < 0.6) {
        const spot = nearestWalkable(walkTest, c.x + (Math.random() - 0.5) * 24, c.z + (Math.random() - 0.5) * 24, 10);
        if (spot) { c.tx = spot.x; c.tz = spot.z; c.state = 'walk'; c.status = ['Strolling about', 'Trotting along', 'Off somewhere', 'Coming to say hi', 'Doing zoomies!'][Math.floor(Math.random() * 5)]; }
        c.until = now + 4 + Math.random() * 6;
      } else { c.state = 'idle'; c.status = STATUSES[Math.floor(Math.random() * STATUSES.length)]; c.until = now + 3 + Math.random() * 8; }
      if (selected) useStore.getState().setCatPopup({ id: c.id, name: c.name, status: c.status, x: c.x, z: c.z });
    }
    if (c.state === 'walk') {
      const dx = c.tx - c.x, dz = c.tz - c.z; const dist = Math.hypot(dx, dz);
      if (dist < 0.3) c.state = 'idle';
      else {
        const sp = c.status === 'Doing zoomies!' ? 3.2 : 1.1;
        const nx = c.x + (dx / dist) * sp * dt, nz = c.z + (dz / dist) * sp * dt;
        if (walkTest(nx, nz)) { c.x = nx; c.z = nz; } else c.state = 'idle';
        const tr = Math.atan2(dx, dz); let diff = tr - c.rot; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2; c.rot += diff * Math.min(1, dt * 8);
      }
    }
    const a = c.state === 'walk' ? (c.status === 'Doing zoomies!' ? 'run' : 'walk') : 'idle';
    if (a !== anim) setAnim(a);
    g.position.set(c.x, LAND_Y, c.z); g.rotation.y = c.rot;
    const n = Math.hypot(c.x - localPos.x, c.z - localPos.z) < 2.6; if (n !== near) setNear(n);
  });

  useEffect(() => { if (hearts > 0) { const t = setTimeout(() => setHearts(0), 1500); return () => clearTimeout(t); } }, [hearts]);

  const pat = () => {
    const c = cat.current;
    if (Math.hypot(c.x - localPos.x, c.z - localPos.z) > 2.6) { useStore.getState().toast(`Walk closer to pat ${c.name}.`); useStore.getState().setWalkTarget({ x: c.x, z: c.z }); return; }
    setHearts((h) => h + 1); sfx('purr');
    useStore.getState().setCatPopup({ id: c.id, name: c.name, status: 'Purring happily', x: c.x, z: c.z });
  };

  return (
    <group ref={group} onClick={(e) => { e.stopPropagation(); const c = cat.current; useStore.getState().setCatPopup({ id: c.id, name: c.name, status: c.status, x: c.x, z: c.z }); if (near) pat(); }}>
      <Character character={character} anim={anim} scale={0.9} emote={hearts ? 'heart' : null} emoteAt={hearts ? Date.now() : 0} />
      {(near || selected) && (
        <Html portal={labelPortal} position={[0, 0.95, 0]} center distanceFactor={10} zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
          <div className="player-indicator cat-tag">🐾 {seed.name}<small>{cat.current.status}</small></div>
        </Html>
      )}
      {hearts > 0 && <Html portal={labelPortal} position={[0, 1.3, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}><div className="cat-hearts">❤️</div></Html>}
    </group>
  );
}
