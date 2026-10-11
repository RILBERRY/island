import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { useStore } from '../store';
import type { World } from '../world/types';
import type { Obstacle } from '../world/geometry';
import { scatterVegetation } from '../world/geometry';
import { LAND_Y } from './constants';

function colored(g: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function palmGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.11, 0.2, 1, 7, 4);
  trunk.translate(0, 0.5, 0);
  const pos = trunk.getAttribute('position');
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setX(i, pos.getX(i) + y * y * 0.12); }
  trunk.computeVertexNormals();
  parts.push(colored(trunk, '#8a6a46'));
  const top = new THREE.Vector3(0.12, 1, 0);
  for (let i = 0; i < 8; i++) {
    const frond = new THREE.PlaneGeometry(0.4, 2.3, 1, 3);
    const p = frond.getAttribute('position');
    for (let j = 0; j < p.count; j++) { const y = p.getY(j); p.setZ(j, -(y + 1.15) * (y + 1.15) * 0.15); }
    frond.translate(0, 1.15, 0);
    frond.rotateX(-Math.PI * 0.4);
    frond.rotateY((i / 8) * Math.PI * 2 + (i % 2) * 0.2);
    frond.translate(top.x, top.y, top.z);
    parts.push(colored(frond, i % 2 ? '#3f8a3c' : '#55a44a'));
  }
  const nuts = new THREE.SphereGeometry(0.1, 6, 5); nuts.translate(top.x, top.y - 0.08, 0.1);
  parts.push(colored(nuts, '#6b8f3a'));
  return mergeGeometries(parts, false)!;
}

function canopyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const blobs: [number, number, number, number][] = [[0, 1.3, 0, 0.62], [0.38, 1.1, 0.18, 0.46], [-0.34, 1.15, -0.2, 0.48], [0.05, 1.05, 0.4, 0.42], [-0.1, 1.08, -0.42, 0.4]];
  for (const [x, y, z, r] of blobs) { const g = new THREE.IcosahedronGeometry(r, 1); g.translate(x, y, z); parts.push(g); }
  return mergeGeometries(parts, false)!;
}

const TREE_GREENS = ['#4f9a3e', '#3f8a44', '#6aae4a', '#58a052', '#45944a'];

export function Vegetation({ world, obstacles }: { world: World; obstacles: Obstacle[] }) {
  const quality = useStore((s) => s.settings.quality);
  const houses = useStore((s) => s.houses);
  const spots = useMemo(() => scatterVegetation(world, obstacles, houses), [world, obstacles, houses]);
  const palmGeom = useMemo(() => palmGeometry(), []);
  const canopyGeom = useMemo(() => canopyGeometry(), []);
  const trunkGeom = useMemo(() => { const g = new THREE.CylinderGeometry(0.1, 0.16, 1.1, 6); g.translate(0, 0.55, 0); return g; }, []);
  const bushGeom = useMemo(() => colored(new THREE.IcosahedronGeometry(1, 1), '#4c9a4e'), []);
  const flowerGeom = useMemo(() => colored(new THREE.IcosahedronGeometry(1, 1), '#e8529b'), []);
  const palmRef = useRef<THREE.InstancedMesh>(null);
  const canopyRef = useRef<THREE.InstancedMesh>(null);
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const bushRef = useRef<THREE.InstancedMesh>(null);
  const flowerRef = useRef<THREE.InstancedMesh>(null);
  const thin = <T,>(list: T[]) => (quality === 'low' ? list.filter((_, i) => i % 2 === 0) : list);
  const palms = useMemo(() => thin(spots.palms), [spots, quality]);
  const trees = useMemo(() => thin(spots.trees), [spots, quality]);
  const bushes = useMemo(() => thin(spots.bushes), [spots, quality]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const s = new THREE.Vector3(); const p = new THREE.Vector3(); const up = new THREE.Vector3(0, 1, 0); const col = new THREE.Color();
    if (palmRef.current) {
      palms.forEach(([x, z, h, rot], i) => { p.set(x, LAND_Y, z); q.setFromAxisAngle(up, rot); const k = 0.9 + h * 0.06; s.set(k, h, k); m.compose(p, q, s); palmRef.current!.setMatrixAt(i, m); });
      palmRef.current.instanceMatrix.needsUpdate = true; palmRef.current.computeBoundingSphere();
    }
    if (canopyRef.current && trunkRef.current) {
      trees.forEach(([x, z, h, rot], i) => {
        p.set(x, LAND_Y, z); q.setFromAxisAngle(up, rot); const k = h / 1.9; s.set(k * (0.9 + (i % 3) * 0.08), k, k * (0.9 + ((i + 1) % 3) * 0.08));
        m.compose(p, q, s); canopyRef.current!.setMatrixAt(i, m); trunkRef.current!.setMatrixAt(i, m);
        col.set(TREE_GREENS[i % TREE_GREENS.length]); canopyRef.current!.setColorAt(i, col);
      });
      canopyRef.current.instanceMatrix.needsUpdate = true; trunkRef.current.instanceMatrix.needsUpdate = true;
      if (canopyRef.current.instanceColor) canopyRef.current.instanceColor.needsUpdate = true;
      canopyRef.current.computeBoundingSphere(); trunkRef.current.computeBoundingSphere();
    }
    if (bushRef.current) {
      bushes.forEach(([x, z, r], i) => { p.set(x, LAND_Y + r * 0.5, z); q.identity(); s.set(r * 1.3, r * 0.8, r * 1.1); m.compose(p, q, s); bushRef.current!.setMatrixAt(i, m); });
      bushRef.current.instanceMatrix.needsUpdate = true; bushRef.current.computeBoundingSphere();
    }
    if (flowerRef.current) {
      spots.flowers.forEach(([x, z, r], i) => { p.set(x, LAND_Y + r * 0.55, z); q.identity(); s.set(r * 1.2, r * 0.9, r * 1.2); m.compose(p, q, s); flowerRef.current!.setMatrixAt(i, m); });
      flowerRef.current.instanceMatrix.needsUpdate = true; flowerRef.current.computeBoundingSphere();
    }
  }, [palms, trees, bushes, spots]);

  return (
    <group>
      <instancedMesh ref={palmRef} args={[palmGeom, undefined, palms.length]} castShadow={quality !== 'low'} receiveShadow frustumCulled={false}>
        <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={trunkRef} args={[trunkGeom, undefined, trees.length]} castShadow={quality !== 'low'} frustumCulled={false}>
        <meshStandardMaterial color="#7a5a3c" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={canopyRef} args={[canopyGeom, undefined, trees.length]} castShadow={quality !== 'low'} receiveShadow frustumCulled={false}>
        <meshStandardMaterial color="#ffffff" flatShading roughness={1} />
      </instancedMesh>
      <instancedMesh ref={bushRef} args={[bushGeom, undefined, bushes.length]} castShadow={quality === 'high'} frustumCulled={false}>
        <meshStandardMaterial vertexColors flatShading roughness={1} />
      </instancedMesh>
      <instancedMesh ref={flowerRef} args={[flowerGeom, undefined, spots.flowers.length]} frustumCulled={false}>
        <meshStandardMaterial vertexColors flatShading roughness={1} />
      </instancedMesh>
    </group>
  );
}
