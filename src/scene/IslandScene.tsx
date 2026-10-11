import { Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore, localPos } from '../store';
import { input, zoomBy, tiltBy } from '../input';
import { Lighting } from './Lighting';
import { Sea, Lagoon, Land, Roads, Buildings, Piers, Pitches, Mosque } from './Terrain';
import { Vegetation } from './Vegetation';
import { LocalPlayer, RemotePlayers, CameraRig, GroundClick } from './Players';
import { Cats } from './Cats';
import { Boats } from './Boats';
import { Bots } from './Bots';
import { PlaceMarkers, WalkMarker, HomeMarker, PartyMarkers, LandingMarkers, IslandLabels, RouteLine } from './Markers';
import { labelPortal } from './constants';

export default function IslandScene() {
  const world = useStore((s) => s.world)!;
  const houses = useStore((s) => s.houses);
  const obstacles = useStore((s) => s.obstacles);
  const quality = useStore((s) => s.settings.quality);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let dragged = false; let start = { x: 0, y: 0 }; let pinch = 0;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('.hud, .sheet, .table-root, .joystick, .label-layer button')) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); dragged = false; start = { x: e.clientX, y: e.clientY };
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) dragged = true;
      const dy = e.clientY - p.y;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0 && d > 0) zoomBy(pinch / d);
        pinch = d;
        tiltBy(dy * 0.002); // two-finger vertical drag tilts a little
        return;
      }
      if (e.buttons === 0 && e.pointerType === 'mouse') return;
      if (e.buttons === 2 || e.shiftKey) { tiltBy(dy * 0.004); return; } // right-drag or shift-drag: small tilt
      input.orbit.targetYaw -= dx * 0.0055;
    };
    const up = (e: PointerEvent) => {
      const had = pointers.has(e.pointerId); pointers.delete(e.pointerId); pinch = 0;
      if (had && !dragged && e.button === 0 && pointers.size === 0) {
        const r = el.getBoundingClientRect();
        input.clickToWalk = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
      }
    };
    const ctx = (e: Event) => e.preventDefault();
    el.addEventListener('contextmenu', ctx);
    const wheel = (e: WheelEvent) => { if ((e.target as HTMLElement).closest('.hud, .sheet, .table-root')) return; zoomBy(1 + Math.sign(e.deltaY) * 0.14); };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('wheel', wheel, { passive: true });
    return () => { el.removeEventListener('contextmenu', ctx); el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('wheel', wheel); };
  }, []);

  return (
    <div ref={wrap} className="scene" style={{ touchAction: 'none' }}>
      <div ref={(el) => { if (el) labelPortal.current = el; }} className="label-layer" />
      <Canvas shadows={quality !== 'low'} dpr={quality === 'high' ? [1, 2] : [1, 1.5]} camera={{ fov: 45, near: 0.5, far: 32000, position: [world.spawn.x + 8, 12, world.spawn.z + 8] }}
        gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping }}
        onCreated={(state) => { (window as unknown as { __l15?: Record<string, unknown> }).__l15 = { r3f: state, input, store: useStore, localPos }; }}>
        <Suspense fallback={null}>
          <Lighting />
          <Sea />
          <Lagoon world={world} />
          <Land world={world} />
          <Roads world={world} />
          <Pitches world={world} />
          <Piers world={world} />
          <Buildings world={world} houses={houses} />
          <Mosque world={world} />
          <Vegetation world={world} obstacles={obstacles} />
          <Boats world={world} />
          <Cats />
          <Bots />
          <PlaceMarkers />
          <LandingMarkers />
          <IslandLabels />
          <HomeMarker />
          <PartyMarkers />
          <WalkMarker />
          <RouteLine />
          <LocalPlayer />
          <RemotePlayers />
          <CameraRig />
          <GroundClick />
        </Suspense>
      </Canvas>
    </div>
  );
}
