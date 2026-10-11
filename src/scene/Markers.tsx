import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, localPos, placeName } from '../store';
import type { Place } from '../world/types';
import { LAND_Y, labelPortal } from './constants';
import { PlaceIcon } from '../ui/icons';
import { ribbon } from '../world/geometry';
import { useMemo } from 'react';

function Marker({ place }: { place: Place }) {
  const [near, setNear] = useState(false);
  const language = useStore((s) => s.settings.language);
  const selected = useStore((s) => s.selectedPlace?.id === place.id);
  useFrame(() => { const n = Math.hypot(place.x - localPos.x, place.z - localPos.z) < 260 || selected; if (n !== near) setNear(n); });
  if (!near) return null;
  const address = place.kind === 'address';
  return (
    <group position={[place.x, LAND_Y + (address ? 4.2 : 5.2), place.z]}>
      <Html portal={labelPortal} center distanceFactor={12} zIndexRange={[30, 0]}>
        <button className={`place-pin ${address ? 'address' : ''} ${selected ? 'selected' : ''}`} style={{ '--c': place.color } as React.CSSProperties} onClick={(e) => { e.stopPropagation(); useStore.getState().setSelectedPlace(place); }}>
          <PlaceIcon icon={place.icon} /><span className={language === 'dv' && place.nameDv ? 'dv' : ''}>{placeName(place, language)}</span>
        </button>
      </Html>
    </group>
  );
}

export function PlaceMarkers() {
  const world = useStore((s) => s.world);
  if (!world) return null;
  return <>{[...world.places, ...world.addresses].map((p) => <Marker key={p.id} place={p} />)}</>;
}

export function HomeMarker() {
  const home = useStore((s) => s.profile?.home);
  if (!home) return null;
  return (
    <group position={[home.x, LAND_Y + 3.4, home.z]}>
      <Html portal={labelPortal} center distanceFactor={12} zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}><div className="house-name-bubble">🏠 {home.label || 'Home'}</div></Html>
    </group>
  );
}

export function WalkMarker() {
  const target = useStore((s) => s.walkTarget);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => { if (ring.current) { const s = 1 + Math.sin(clock.elapsedTime * 6) * 0.15; ring.current.scale.set(s, s, 1); } });
  if (!target) return null;
  return (
    <mesh ref={ring} position={[target.x, LAND_Y + 0.05, target.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.45, 0.7, 28]} /><meshBasicMaterial color="#ff6b57" transparent opacity={0.9} />
    </mesh>
  );
}

export function PartyMarkers() {
  const parties = useStore((s) => s.parties);
  return (
    <>{Object.values(parties).map((p) => (
      <group key={p.id} position={[p.x, LAND_Y, p.z]}>
        <mesh position={[0, 0.5, 0]} castShadow><cylinderGeometry args={[0.9, 0.9, 0.08, 20]} /><meshStandardMaterial color="#6b3b1c" /></mesh>
        <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.12, 0.14, 0.5, 8]} /><meshStandardMaterial color="#4a2a14" /></mesh>
        <Html portal={labelPortal} position={[0, 1.6, 0]} center distanceFactor={12} zIndexRange={[35, 0]} style={{ pointerEvents: 'none' }}>
          <div className="house-name-bubble table-bubble">🎲 {p.status === 'playing' ? 'Playing' : 'Open table'} · {p.members.length}</div>
        </Html>
      </group>
    ))}</>
  );
}

function LandingMarker({ landing }: { landing: import('../world/types').Landing }) {
  const [near, setNear] = useState(false);
  const buoy = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const n = Math.hypot(landing.water[0] - localPos.x, landing.water[1] - localPos.z) < 320; if (n !== near) setNear(n);
    if (buoy.current) buoy.current.position.y = Math.sin(clock.elapsedTime * 1.4 + landing.water[0]) * 0.15;
  });
  return (
    <group>
      <group ref={buoy} position={[landing.water[0], 0, landing.water[1]]}>
        <mesh position={[0, 0.4, 0]} castShadow><sphereGeometry args={[0.6, 12, 10]} /><meshStandardMaterial color="#ff6b57" /></mesh>
        <mesh position={[0, 1.4, 0]}><cylinderGeometry args={[0.06, 0.06, 1.6, 6]} /><meshStandardMaterial color="#444" /></mesh>
        <mesh position={[0, 2.3, 0]}><boxGeometry args={[0.6, 0.4, 0.05]} /><meshStandardMaterial color="#ffcf3f" /></mesh>
      </group>
      {near && (
        <group position={[landing.dock[0], LAND_Y + 4, landing.dock[1]]}>
          <Html portal={labelPortal} center distanceFactor={12} zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
            <div className="place-pin" style={{ '--c': '#2f6f8f' } as React.CSSProperties}><PlaceIcon icon="anchor" /><span>{landing.name}</span></div>
          </Html>
        </group>
      )}
    </group>
  );
}

export function LandingMarkers() {
  const world = useStore((s) => s.world);
  if (!world) return null;
  return <>{(world.landings ?? []).map((l) => <LandingMarker key={l.id} landing={l} />)}</>;
}

function IslandLabel({ island }: { island: import('../world/types').Island }) {
  const [show, setShow] = useState(false);
  const language = useStore((s) => s.settings.language);
  useFrame(() => { const d = Math.hypot(island.x - localPos.x, island.z - localPos.z); const n = d < 3500 && d > 120; if (n !== show) setShow(n); });
  if (!show) return null;
  return (
    <group position={[island.x, LAND_Y + 18, island.z]}>
      <Html portal={labelPortal} center distanceFactor={40} zIndexRange={[28, 0]} style={{ pointerEvents: 'none' }}>
        <div className={`island-label ${island.inhabited ? 'inhabited' : ''}`}>{language === 'dv' && island.nameDv ? <span className="dv">{island.nameDv}</span> : island.name}{island.inhabited ? <small>Inhabited</small> : island.note ? <small>{island.note}</small> : null}</div>
      </Html>
    </group>
  );
}

export function IslandLabels() {
  const world = useStore((s) => s.world);
  if (!world) return null;
  return <>{world.coastlines.filter((c) => !c.main && c.name !== 'Islet').map((c) => <IslandLabel key={c.id} island={c} />)}</>;
}

/** The active road or sea route, drawn as a translucent ribbon. */
export function RouteLine() {
  const driving = useStore((s) => s.driving);
  const sailing = useStore((s) => s.sailing);
  const route = driving ?? sailing;
  const geom = useMemo(() => {
    if (!route || route.waypoints.length < 2) return null;
    const r = ribbon(route.waypoints, driving ? 1.4 : 6, driving ? LAND_Y + 0.08 : 0.25);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(r.positions, 3));
    g.setIndex(new THREE.BufferAttribute(r.indices, 1));
    return g;
  }, [route?.waypoints, driving]);
  if (!geom) return null;
  return <mesh geometry={geom}><meshBasicMaterial color={driving ? '#087887' : '#ffcf3f'} transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} /></mesh>;
}
