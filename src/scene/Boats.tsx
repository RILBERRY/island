import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { World } from '../world/types';

export function Dhoni({ color = '#f4f1e8', trim = '#1e4d8f' }: { color?: string; trim?: string }) {
  return (
    <group>
      <mesh position={[0, 0.4, 0]} castShadow><boxGeometry args={[2.4, 0.8, 7.5]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 0.45, 4.4]} rotation={[0.35, 0, 0]} castShadow><coneGeometry args={[1.2, 2.4, 4]} /><meshStandardMaterial color={color} flatShading /></mesh>
      <mesh position={[0, 0.78, 0]}><boxGeometry args={[2.5, 0.1, 7.6]} /><meshStandardMaterial color={trim} /></mesh>
      <mesh position={[0, 1.3, -1.6]} castShadow><boxGeometry args={[2.0, 1.0, 2.6]} /><meshStandardMaterial color="#e9e2cc" /></mesh>
      <mesh position={[0, 1.95, -1.6]}><boxGeometry args={[2.3, 0.12, 3.0]} /><meshStandardMaterial color="#2a6f8a" /></mesh>
      <mesh position={[0, 2.4, 1.2]}><cylinderGeometry args={[0.05, 0.07, 3.2, 6]} /><meshStandardMaterial color="#6b5236" /></mesh>
    </group>
  );
}

export function Boats({ world }: { world: World }) {
  const spots = useMemo(() => {
    const pier = world.piers[0];
    if (!pier) return [] as { x: number; z: number; rot: number; moving: boolean; color: string; trim: string }[];
    const [ax, az] = pier.points[pier.points.length - 1]; const [bx, bz] = pier.points[0];
    let dx = bx - ax, dz = bz - az; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; // points from the shore end toward the sea end
    const px = -dz, pz = dx;
    const out = (d: number, s: number) => ({ x: bx + dx * d + px * s, z: bz + dz * d + pz * s });
    return [
      { ...out(18, 9), rot: Math.atan2(dx, dz) + 0.2, moving: false, color: '#f4f1e8', trim: '#1e4d8f' },
      { ...out(22, -10), rot: Math.atan2(dx, dz) - 0.3, moving: false, color: '#fff3d6', trim: '#c8372d' },
      { ...out(34, 2), rot: Math.atan2(dx, dz) + 1.3, moving: false, color: '#e8f1f2', trim: '#2f9e7a' },
      { ...out(90, 0), rot: 0, moving: true, color: '#f4f1e8', trim: '#087887' },
    ];
  }, [world]);
  return <>{spots.map((s, i) => <Boat key={i} {...s} />)}</>;
}

function Boat({ x, z, rot, moving, color, trim }: { x: number; z: number; rot: number; moving: boolean; color: string; trim: string }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime; const m = g.current; if (!m) return;
    if (moving) { const a = t * 0.05; m.position.set(x + Math.cos(a) * 70, Math.sin(t * 1.1) * 0.12, z + Math.sin(a) * 70); m.rotation.set(Math.sin(t * 0.9) * 0.03, -a - Math.PI / 2 + Math.PI, Math.sin(t * 1.3) * 0.04); }
    else { m.position.set(x, Math.sin(t * 1.1 + x) * 0.1, z); m.rotation.set(Math.sin(t * 0.8 + z) * 0.03, rot, Math.sin(t * 1.2 + x) * 0.05); }
  });
  return <group ref={g} position={[x, 0, z]}><Dhoni color={color} trim={trim} /></group>;
}
