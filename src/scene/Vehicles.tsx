import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Vehicles face +z like the characters. `moving` spins the wheels. */
export function Bicycle({ color, moving, children }: { color: string; moving: boolean; children?: ReactNode }) {
  const front = useRef<THREE.Mesh>(null); const rear = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (!moving) return; const a = dt * 9; if (front.current) front.current.rotation.x += a; if (rear.current) rear.current.rotation.x += a; });
  const wheel = (ref: React.RefObject<THREE.Mesh | null>, z: number) => (
    <group position={[0, 0.34, z]}>
      <mesh ref={ref} rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.32, 0.035, 8, 20]} /><meshStandardMaterial color="#2b2b2b" /></mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.03, 0.03, 0.12, 6]} /><meshStandardMaterial color="#888" /></mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.16, 0.012, 4, 12]} /><meshStandardMaterial color="#aaaaaa" /></mesh>
    </group>
  );
  return (
    <group>
      {wheel(front, 0.58)}{wheel(rear, -0.58)}
      <mesh position={[0, 0.58, 0.1]} rotation={[0.55, 0, 0]} castShadow><cylinderGeometry args={[0.03, 0.03, 0.78, 6]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 0.78, -0.18]} rotation={[-0.2, 0, 0]}><cylinderGeometry args={[0.03, 0.03, 0.62, 6]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 0.6, -0.4]} rotation={[0.9, 0, 0]}><cylinderGeometry args={[0.025, 0.025, 0.5, 6]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 0.72, 0.5]} rotation={[-0.35, 0, 0]}><cylinderGeometry args={[0.025, 0.025, 0.75, 6]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 1.02, 0.42]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.02, 0.02, 0.5, 6]} /><meshStandardMaterial color="#333" /></mesh>
      <mesh position={[0, 0.98, -0.2]}><boxGeometry args={[0.18, 0.06, 0.26]} /><meshStandardMaterial color="#2b2b2b" /></mesh>
      <mesh position={[0, 0.36, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.02, 0.02, 0.32, 6]} /><meshStandardMaterial color="#555" /></mesh>
      <group position={[0, 0.2, -0.12]}>{children}</group>
    </group>
  );
}

export function Car({ color, moving }: { color: string; moving: boolean }) {
  const wheels = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (!moving || !wheels.current) return; for (const w of wheels.current.children) w.rotation.x += dt * 12; });
  return (
    <group>
      <mesh position={[0, 0.62, 0]} castShadow receiveShadow><boxGeometry args={[1.8, 0.5, 4.0]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 1.12, -0.25]} castShadow><boxGeometry args={[1.6, 0.58, 2.1]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 1.14, -0.25]}><boxGeometry args={[1.64, 0.42, 1.7]} /><meshStandardMaterial color="#9ad4e8" /></mesh>
      <mesh position={[0, 1.08, 0.86]} rotation={[0.55, 0, 0]}><boxGeometry args={[1.5, 0.5, 0.06]} /><meshStandardMaterial color="#9ad4e8" /></mesh>
      <mesh position={[0, 0.5, 2.0]}><boxGeometry args={[1.8, 0.2, 0.08]} /><meshStandardMaterial color="#444" /></mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * 0.62, 0.72, 2.0]}><boxGeometry args={[0.3, 0.14, 0.05]} /><meshStandardMaterial color="#fff6c0" emissive="#ffe39a" emissiveIntensity={0.6} /></mesh>)}
      {[-1, 1].map((s) => <mesh key={s} position={[s * 0.62, 0.72, -2.0]}><boxGeometry args={[0.3, 0.12, 0.05]} /><meshStandardMaterial color="#d12b2b" emissive="#8a1212" emissiveIntensity={0.5} /></mesh>)}
      <group ref={wheels}>
        {[[-0.88, 1.3], [0.88, 1.3], [-0.88, -1.3], [0.88, -1.3]].map(([x, z], i) => <mesh key={i} position={[x, 0.33, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.33, 0.33, 0.24, 14]} /><meshStandardMaterial color="#222" /></mesh>)}
      </group>
    </group>
  );
}

export function Bus({ moving }: { moving: boolean }) {
  const wheels = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (!moving || !wheels.current) return; for (const w of wheels.current.children) w.rotation.x += dt * 9; });
  return (
    <group>
      <mesh position={[0, 1.65, 0]} castShadow receiveShadow><boxGeometry args={[2.4, 2.3, 9]} /><meshStandardMaterial color="#087887" /></mesh>
      <mesh position={[0, 1.05, 0]}><boxGeometry args={[2.44, 0.5, 9.04]} /><meshStandardMaterial color="#fff3cf" /></mesh>
      <mesh position={[0, 2.15, 0]}><boxGeometry args={[2.44, 0.8, 8.2]} /><meshStandardMaterial color="#9ad4e8" /></mesh>
      <mesh position={[0, 2.0, 4.52]}><boxGeometry args={[2.1, 1.3, 0.06]} /><meshStandardMaterial color="#9ad4e8" /></mesh>
      <mesh position={[0, 2.85, 0]}><boxGeometry args={[2.2, 0.1, 8.6]} /><meshStandardMaterial color="#e7f3f4" /></mesh>
      <mesh position={[0, 2.75, 4.53]}><boxGeometry args={[1.6, 0.3, 0.05]} /><meshStandardMaterial color="#ffcf3f" /></mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * 0.85, 0.9, 4.52]}><boxGeometry args={[0.35, 0.18, 0.05]} /><meshStandardMaterial color="#fff6c0" emissive="#ffe39a" emissiveIntensity={0.6} /></mesh>)}
      <group ref={wheels}>
        {[[-1.15, 3.0], [1.15, 3.0], [-1.15, -2.6], [1.15, -2.6], [-1.15, -3.5], [1.15, -3.5]].map(([x, z], i) => <mesh key={i} position={[x, 0.45, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.45, 0.45, 0.3, 14]} /><meshStandardMaterial color="#222" /></mesh>)}
      </group>
    </group>
  );
}
