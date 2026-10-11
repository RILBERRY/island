import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';
import type { World, Pt, IllustrativeHouse } from '../world/types';
import { simplify, offsetRing, ribbon, pointInRing, illustrativeMosque, bounds } from '../world/geometry';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAND_Y } from './constants';

function shapeFrom(points: Pt[]): THREE.Shape {
  return new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
}
function extruded(points: Pt[], depth: number): THREE.ExtrudeGeometry {
  const g = new THREE.ExtrudeGeometry(shapeFrom(points), { depth, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}
function flat(points: Pt[]): THREE.ShapeGeometry {
  const g = new THREE.ShapeGeometry(shapeFrom(points));
  g.rotateX(-Math.PI / 2);
  return g;
}

// ---------- procedural sand texture (tiles seamlessly) ----------
let sandTexture: THREE.CanvasTexture | null = null;
export function getSandTexture(): THREE.CanvasTexture {
  if (sandTexture) return sandTexture;
  const size = 256;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e6d8ab'; ctx.fillRect(0, 0, size, size);
  for (let k = 0; k < 70; k++) {
    const x = Math.random() * size, y = Math.random() * size, r = 14 + Math.random() * 38;
    ctx.fillStyle = `rgba(${205 + Math.random() * 40 | 0}, ${185 + Math.random() * 40 | 0}, ${125 + Math.random() * 45 | 0}, 0.13)`;
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) { ctx.beginPath(); ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2); ctx.fill(); }
  }
  const img = ctx.getImageData(0, 0, size, size); const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.7; }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.repeat.set(1 / 16, 1 / 16);
  sandTexture = t;
  return t;
}

// ---------- water ----------
const WATER_VERT = `varying vec3 vPos;
void main(){
  vec4 mv = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    mv = instanceMatrix * mv;
  #endif
  vec4 wp = modelMatrix * mv;
  vPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const WATER_FRAG = `uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; uniform float uNight; uniform vec3 uSun; uniform float uRipple; varying vec3 vPos;
// Fine ripples (3-18 m) are only shown close up; medium swell (50-100 m) and long swell (400 m) carry the look from the overview.
float fine(vec2 p){
  return sin(p.x*0.32 + uTime*1.0)*sin(p.y*0.26 - uTime*0.7) + 0.55*sin((p.x+p.y)*0.75 + uTime*1.6) + 0.3*sin((p.x*1.3-p.y)*1.5 - uTime*2.0);
}
float mid(vec2 p){
  return sin(p.x*0.06 + uTime*0.45)*sin(p.y*0.045 - uTime*0.35) + 0.6*sin((p.x - p.y*0.7)*0.11 + uTime*0.5) + 0.35*sin((p.x*0.4 + p.y)*0.16 - uTime*0.4);
}
float coarse(vec2 p){
  return sin(p.x*0.012 + uTime*0.18)*sin(p.y*0.015 - uTime*0.14) + 0.5*sin((p.x + p.y)*0.009 + uTime*0.1);
}
void main(){
  vec2 p = vPos.xz;
  float dist = length(cameraPosition - vPos);
  float nearW = 1.0 - smoothstep(35.0, 220.0, dist);
  float midW = 1.0 - smoothstep(250.0, 1400.0, dist);
  float e = 0.4;
  float hx = (fine(p + vec2(e, 0.0)) - fine(p - vec2(e, 0.0))) * nearW + (mid(p + vec2(3.0, 0.0)) - mid(p - vec2(3.0, 0.0))) * 0.12 * midW;
  float hz = (fine(p + vec2(0.0, e)) - fine(p - vec2(0.0, e))) * nearW + (mid(p + vec2(0.0, 3.0)) - mid(p - vec2(0.0, 3.0))) * 0.12 * midW;
  vec3 n = normalize(vec3(-hx * uRipple, 1.0, -hz * uRipple));
  vec3 v = normalize(cameraPosition - vPos);
  vec3 l = normalize(uSun);
  float spec = pow(max(dot(normalize(l + v), n), 0.0), 170.0) * nearW;
  float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  float r = (fine(p) * 0.5 * nearW + mid(p) * 0.4 * midW + coarse(p) * 0.35) * 0.5 + 0.5;
  vec3 col = mix(uDeep, uShallow, 0.2 + 0.34 * r);
  col = mix(col, uShallow * 1.08, fres * 0.3);
  col += spec * 0.9 * (1.0 - uNight * 0.8);
  gl_FragColor = vec4(col, 1.0);
}`;

function useWaterMaterial(dayDeep: string, dayShallow: string, nightDeep: string, nightShallow: string, ripple: number) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: WATER_VERT, fragmentShader: WATER_FRAG,
    uniforms: { uTime: { value: 0 }, uDeep: { value: new THREE.Color(dayDeep) }, uShallow: { value: new THREE.Color(dayShallow) }, uNight: { value: 0 }, uSun: { value: new THREE.Vector3(0.3, 0.8, -0.4) }, uRipple: { value: ripple } },
  }), [dayDeep, dayShallow, ripple]);
  useFrame(({ clock }) => {
    const daylight = useStore.getState().daylight;
    mat.uniforms.uTime.value = clock.elapsedTime;
    mat.uniforms.uNight.value = daylight.night;
    const s = daylight.sun;
    (mat.uniforms.uSun.value as THREE.Vector3).set(s.y > 0.05 ? s.x : -0.5, s.y > 0.05 ? s.y : 0.6, s.y > 0.05 ? s.z : 0.4);
    const night = daylight.night > 0.5;
    (mat.uniforms.uDeep.value as THREE.Color).lerp(new THREE.Color(night ? nightDeep : dayDeep), 0.05);
    (mat.uniforms.uShallow.value as THREE.Color).lerp(new THREE.Color(night ? nightShallow : dayShallow), 0.05);
  });
  return mat;
}

export function Sea() {
  const world = useStore((s) => s.world)!;
  const ocean = useWaterMaterial('#0f3a85', '#2a62b8', '#06142c', '#0f2d56', 0.4);
  const atoll = useWaterMaterial('#1f62b8', '#3f8fde', '#0a2a5a', '#13376a', 0.35);
  const atollGeom = useMemo(() => (world.atoll ? flat(simplify(world.atoll, 15)) : null), [world]);
  const centre = useMemo(() => { const b = world.atoll ? bounds(world.atoll) : bounds(world.coastlines.flatMap((c) => c.points)); return [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2] as const; }, [world]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centre[0], 0, centre[1]]} material={ocean} frustumCulled={false}>
        <planeGeometry args={[90000, 90000, 60, 60]} />
      </mesh>
      {atollGeom && <mesh geometry={atollGeom} position={[0, 0.006, 0]} material={atoll} />}
    </group>
  );
}

/** Points along coastlines at a spacing chosen per island; discs centred here form a robust "offset band" that never self-intersects. */
function coastPoints(world: World, spacingFor: (areaM2: number, main: boolean) => number): [number, number][] {
  const out: [number, number][] = [];
  for (const c of world.coastlines) {
    const spacing = spacingFor(c.areaM2, c.main);
    if (spacing <= 0) continue;
    const ring = simplify(c.points, c.main ? 1.5 : 3);
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i]; const [bx, bz] = ring[(i + 1) % ring.length];
      const len = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.ceil(len / spacing));
      for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
    }
  }
  return out;
}

function DiscLayer({ centers, radius, y, material, segments = 36 }: { centers: [number, number][]; radius: number; y: number; material: THREE.Material; segments?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => { const g = new THREE.CircleGeometry(1, segments); g.rotateX(-Math.PI / 2); return g; }, [segments]);
  useLayoutEffect(() => {
    const m = ref.current; if (!m) return;
    const mat = new THREE.Matrix4();
    centers.forEach(([x, z], i) => { mat.makeScale(radius, 1, radius); mat.setPosition(x, y, z); m.setMatrixAt(i, mat); });
    m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
  }, [centers, radius, y]);
  return <instancedMesh ref={ref} args={[geom, material, centers.length]} frustumCulled={false} />;
}

export function Lagoon({ world }: { world: World }) {
  const coarse = useMemo(() => coastPoints(world, (a, main) => (main ? 12 : a > 100000 ? 30 : 42)), [world]);
  const fine = useMemo(() => coastPoints(world, (a, main) => (main ? 5 : a > 50000 ? 12 : 0)), [world]);
  const reef = useWaterMaterial('#1f9fc6', '#45c9de', '#0b3550', '#134d66', 0.3);
  const lagoon = useWaterMaterial('#3fd3e6', '#93f1f5', '#155a70', '#1f7a8c', 0.22);
  const foam = useMemo(() => new THREE.MeshBasicMaterial({ color: '#e9fafd' }), []);
  const foamSoft = useMemo(() => new THREE.MeshBasicMaterial({ color: '#cdeef7' }), []);
  return (
    <group>
      <DiscLayer centers={coarse} radius={193} y={0.02} material={foamSoft} segments={24} />
      <DiscLayer centers={coarse} radius={188} y={0.06} material={reef} segments={24} />
      <DiscLayer centers={coarse} radius={128} y={0.1} material={lagoon} segments={24} />
      <DiscLayer centers={fine} radius={8} y={0.14} material={foam} segments={12} />
    </group>
  );
}

export function Land({ world }: { world: World }) {
  const sand = getSandTexture();
  const geoms = useMemo(() => world.coastlines.map((c) => {
    const ring = simplify(c.points, c.main ? 0.8 : 2.5);
    const beach = offsetRing(ring, 4.5);
    return { id: c.id, land: extruded(ring, LAND_Y), beach: extruded(beach, LAND_Y * 0.5) };
  }), [world]);
  return (
    <group>
      {geoms.map((g) => (
        <group key={g.id}>
          <mesh geometry={g.beach} receiveShadow><meshStandardMaterial color="#f9efd4" map={sand} /></mesh>
          <mesh geometry={g.land} receiveShadow><meshStandardMaterial color="#f0e4bd" map={sand} roughness={1} /></mesh>
        </group>
      ))}
    </group>
  );
}

export function Roads({ world }: { world: World }) {
  const geom = useMemo(() => {
    const positions: number[] = []; const indices: number[] = []; const normals: number[] = []; const colors: number[] = [];
    let offset = 0;
    for (const road of world.roads) {
      if (road.points.length < 2) continue;
      const r = ribbon(road.points, road.width, LAND_Y + 0.02);
      const col = new THREE.Color(road.name ? '#c3b28a' : road.kind === 'track' ? '#d4c6a3' : '#ccbc95');
      for (let i = 0; i < r.positions.length; i += 3) { positions.push(r.positions[i], r.positions[i + 1], r.positions[i + 2]); normals.push(0, 1, 0); colors.push(col.r, col.g, col.b); }
      for (let i = 0; i < r.indices.length; i++) indices.push(r.indices[i] + offset);
      offset += r.positions.length / 3;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(indices);
    return g;
  }, [world]);
  return <mesh geometry={geom} receiveShadow><meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={1} /></mesh>;
}

export function Pitches({ world }: { world: World }) {
  const items = useMemo(() => (world.pitches ?? []).filter((p) => p.points.length >= 4).map((p) => {
    const pts = p.points; const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cz = pts.reduce((a, q) => a + q[1], 0) / pts.length;
    const [ax, az] = pts[0]; const [bx, bz] = pts[1]; const [qx, qz] = pts[2];
    return { id: p.id, cx, cz, w: Math.hypot(bx - ax, bz - az), d: Math.hypot(qx - bx, qz - bz), rot: Math.atan2(bz - az, bx - ax) };
  }), [world]);
  const line = '#f4f7ef';
  return (
    <>{items.map((p) => {
      const w = p.w - 3, d = p.d - 3; const long = Math.max(w, d), short = Math.min(w, d); const alongX = w >= d;
      const box = (x: number, z: number, lx: number, lz: number, key: string) => <mesh key={key} position={[x, 0.03, z]}><boxGeometry args={[lx, 0.02, lz]} /><meshBasicMaterial color={line} /></mesh>;
      return (
        <group key={p.id} position={[p.cx, LAND_Y + 0.02, p.cz]} rotation={[0, -p.rot, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[p.w + 3, p.d + 3]} /><meshStandardMaterial color="#4c9a3e" roughness={1} /></mesh>
          {box(0, -d / 2, w, 0.14, 'n')}{box(0, d / 2, w, 0.14, 's')}{box(-w / 2, 0, 0.14, d, 'w')}{box(w / 2, 0, 0.14, d, 'e')}
          {alongX ? box(0, 0, 0.14, d, 'mid') : box(0, 0, w, 0.14, 'mid')}
          <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[short * 0.11, short * 0.11 + 0.14, 40]} /><meshBasicMaterial color={line} /></mesh>
          {alongX ? (<>{box(-long / 2 + short * 0.18, 0, 0.14, short * 0.55, 'gw')}{box(long / 2 - short * 0.18, 0, 0.14, short * 0.55, 'ge')}{box(-long / 2 + short * 0.09, -short * 0.275, short * 0.18, 0.14, 'gw1')}{box(-long / 2 + short * 0.09, short * 0.275, short * 0.18, 0.14, 'gw2')}{box(long / 2 - short * 0.09, -short * 0.275, short * 0.18, 0.14, 'ge1')}{box(long / 2 - short * 0.09, short * 0.275, short * 0.18, 0.14, 'ge2')}</>)
            : (<>{box(0, -long / 2 + short * 0.18, short * 0.55, 0.14, 'gn')}{box(0, long / 2 - short * 0.18, short * 0.55, 0.14, 'gs')}</>)}
        </group>
      );
    })}</>
  );
}

const PASTELS = ['#fdf6e3', '#f7e9c8', '#e8f1f2', '#f9dcd2', '#dfeee0', '#fff1b8', '#e9e2f5', '#d9eefa'];
const ROOFS = ['#c8553d', '#8a9aa6', '#3f7e8f', '#b5641f', '#6d8f5a'];
function hashColor(id: string, list: string[]): string { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return list[h % list.length]; }
function paint(g: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  const c = new THREE.Color(color); const n = g.getAttribute('position').count; const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); return g;
}

/** All OSM building footprints across the atoll, merged into two draw calls (walls, roofs). */
function MappedBuildings({ world }: { world: World }) {
  const geoms = useMemo(() => {
    const walls: THREE.BufferGeometry[] = []; const roofs: THREE.BufferGeometry[] = [];
    for (const b of world.buildings) {
      if (b.points.length < 3) continue;
      try {
        const special = b.kind === 'hospital' || b.kind === 'school' || b.kind === 'hotel' || b.kind === 'university';
        const wall = extruded(b.points, b.height); wall.translate(0, LAND_Y, 0);
        walls.push(paint(wall, special ? '#ffffff' : hashColor(b.id, PASTELS)));
        const roof = flat(b.points); roof.translate(0, LAND_Y + b.height + 0.02, 0);
        roofs.push(paint(roof, special ? '#2f7a9a' : hashColor(b.id + 'r', ROOFS)));
      } catch { /* skip degenerate footprint */ }
    }
    for (const g of [...walls, ...roofs]) g.deleteAttribute('uv');
    return { walls: walls.length ? mergeGeometries(walls, false) : null, roofs: roofs.length ? mergeGeometries(roofs, false) : null };
  }, [world]);
  return (
    <group>
      {geoms.walls && <mesh geometry={geoms.walls} castShadow receiveShadow><meshStandardMaterial vertexColors /></mesh>}
      {geoms.roofs && <mesh geometry={geoms.roofs}><meshStandardMaterial vertexColors /></mesh>}
    </group>
  );
}

function gableGeometry(w: number, h: number, d: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  g.computeVertexNormals();
  return g;
}

function House({ h }: { h: IllustrativeHouse }) {
  const roofH = Math.min(h.w, h.d) * 0.34;
  const alongX = h.w >= h.d;
  const gable = useMemo(() => (h.roof === 'gable' ? (alongX ? gableGeometry(h.d * 1.14, roofH, h.w * 1.14) : gableGeometry(h.w * 1.14, roofH, h.d * 1.14)) : null), [h, roofH, alongX]);
  const f = h.front;
  const pw = h.w + 5.2, pd = h.d + 5.2; // plot incl. compound wall
  const wallH = 1.5, wallT = 0.22;
  const gate = 2.4;
  const sideLen = (pw - gate) / 2;
  return (
    <group position={[h.x, LAND_Y, h.z]} rotation={[0, -h.rot, 0]}>
      <mesh position={[0, h.height / 2, 0]} castShadow receiveShadow><boxGeometry args={[h.w, h.height, h.d]} /><meshStandardMaterial color={h.color} /></mesh>
      {h.roof === 'hip' && (
        <mesh position={[0, h.height + roofH / 2, 0]} rotation={[0, Math.PI / 4, 0]} scale={[(h.w * 1.14) / Math.SQRT2, 1, (h.d * 1.14) / Math.SQRT2]} castShadow>
          <coneGeometry args={[1, roofH, 4, 1]} /><meshStandardMaterial color={h.roofColor} flatShading />
        </mesh>
      )}
      {h.roof === 'gable' && gable && (
        <mesh geometry={gable} position={[0, h.height, 0]} rotation={[0, alongX ? Math.PI / 2 : 0, 0]} castShadow><meshStandardMaterial color={h.roofColor} flatShading /></mesh>
      )}
      {h.roof === 'flat' && (<>
        <mesh position={[0, h.height + 0.12, 0]}><boxGeometry args={[h.w + 0.3, 0.24, h.d + 0.3]} /><meshStandardMaterial color="#d9d2c0" /></mesh>
        <mesh position={[h.w * 0.3, h.height + 0.75, -h.d * 0.25]} castShadow><cylinderGeometry args={[0.55, 0.55, 1.1, 10]} /><meshStandardMaterial color="#2f6f8f" /></mesh>
      </>)}
      {/* door and windows on the street side, windows on the back */}
      <mesh position={[0, 1.05, f * (h.d / 2 + 0.03)]}><boxGeometry args={[1.0, 2.1, 0.06]} /><meshStandardMaterial color="#5b4634" /></mesh>
      <mesh position={[h.w * 0.3, 1.6, f * (h.d / 2 + 0.03)]}><boxGeometry args={[1.1, 1.0, 0.05]} /><meshStandardMaterial color="#7fc4de" /></mesh>
      <mesh position={[-h.w * 0.3, 1.6, f * (h.d / 2 + 0.03)]}><boxGeometry args={[1.1, 1.0, 0.05]} /><meshStandardMaterial color="#7fc4de" /></mesh>
      <mesh position={[0, 1.6, -f * (h.d / 2 + 0.03)]}><boxGeometry args={[1.1, 1.0, 0.05]} /><meshStandardMaterial color="#7fc4de" /></mesh>
      {/* compound wall with a gate on the street side */}
      <mesh position={[0, wallH / 2, -f * (pd / 2)]} castShadow><boxGeometry args={[pw, wallH, wallT]} /><meshStandardMaterial color="#f3eddd" /></mesh>
      <mesh position={[-pw / 2, wallH / 2, 0]} castShadow><boxGeometry args={[wallT, wallH, pd]} /><meshStandardMaterial color="#f3eddd" /></mesh>
      <mesh position={[pw / 2, wallH / 2, 0]} castShadow><boxGeometry args={[wallT, wallH, pd]} /><meshStandardMaterial color="#f3eddd" /></mesh>
      <mesh position={[-(gate / 2 + sideLen / 2), wallH / 2, f * (pd / 2)]} castShadow><boxGeometry args={[sideLen, wallH, wallT]} /><meshStandardMaterial color="#f3eddd" /></mesh>
      <mesh position={[gate / 2 + sideLen / 2, wallH / 2, f * (pd / 2)]} castShadow><boxGeometry args={[sideLen, wallH, wallT]} /><meshStandardMaterial color="#f3eddd" /></mesh>
      <mesh position={[0, 0.9, f * (pd / 2)]}><boxGeometry args={[gate, 1.6, 0.08]} /><meshStandardMaterial color={h.roofColor} /></mesh>
    </group>
  );
}

export function Buildings({ world, houses }: { world: World; houses: IllustrativeHouse[] }) {
  const show = useStore((s) => s.settings.illustrativeHouses);
  return (
    <group>
      <MappedBuildings world={world} />
      {show && houses.map((h) => <House key={h.id} h={h} />)}
    </group>
  );
}

export function Mosque({ world }: { world: World }) {
  const place = world.places.find((p) => /mosque|masjid/i.test(p.name) && (p.island === 'Isdhoo' || !p.island));
  const spec = useMemo(() => illustrativeMosque(world), [world]);
  if (!place) return null;
  const host = world.buildings.find((b) => pointInRing(place.x, place.z, b.points));
  if (host) {
    const r = Math.min(4, Math.sqrt(host.areaM2) / 4);
    const [cx, cz] = host.points[0];
    return (
      <group position={[0, LAND_Y, 0]}>
        <mesh position={[host.x, host.height + r * 0.3, host.z]} castShadow><sphereGeometry args={[r, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#2f8a8f" /></mesh>
        <mesh position={[cx, 7, cz]} castShadow><cylinderGeometry args={[0.7, 0.9, 14, 12]} /><meshStandardMaterial color="#ffffff" /></mesh>
        <mesh position={[cx, 14.5, cz]}><sphereGeometry args={[1.0, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#2f8a8f" /></mesh>
      </group>
    );
  }
  if (!spec) return null;
  return (
    <group position={[spec.x, LAND_Y, spec.z]} rotation={[0, -spec.rot, 0]}>
      <mesh position={[0, 3, 0]} castShadow receiveShadow><boxGeometry args={[spec.w, 6, spec.d]} /><meshStandardMaterial color="#ffffff" /></mesh>
      <mesh position={[0, 6, 0]} castShadow><sphereGeometry args={[4.6, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#2f8a8f" /></mesh>
      <mesh position={[0, 10.8, 0]}><coneGeometry args={[0.25, 1.2, 8]} /><meshStandardMaterial color="#e2b23a" /></mesh>
      <mesh position={[spec.w / 2 + 1.6, 7.5, spec.d / 2 + 1.6]} castShadow><cylinderGeometry args={[0.8, 1.0, 15, 12]} /><meshStandardMaterial color="#ffffff" /></mesh>
      <mesh position={[spec.w / 2 + 1.6, 15.4, spec.d / 2 + 1.6]}><sphereGeometry args={[1.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#2f8a8f" /></mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * spec.w * 0.3, 2.2, spec.d / 2 + 0.04]}><boxGeometry args={[1.6, 3.2, 0.06]} /><meshStandardMaterial color="#5b4634" /></mesh>)}
      <mesh position={[0, 2.4, spec.d / 2 + 0.04]}><boxGeometry args={[2.2, 3.6, 0.08]} /><meshStandardMaterial color="#2f6f8f" /></mesh>
    </group>
  );
}

export function Piers({ world }: { world: World }) {
  const breakwaters = useMemo(() => world.piers.filter((p) => p.kind === 'breakwater' || p.closed).map((p) => {
    if (p.closed) return { id: p.id, g: extruded(p.points, 1.6) };
    const r = ribbon(p.points, p.width, 0);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(r.positions, 3)); g.setIndex(new THREE.BufferAttribute(r.indices, 1)); g.computeVertexNormals();
    g.translate(0, 1.4, 0); return { id: p.id, g };
  }), [world]);
  const quays = useMemo(() => (world.docks ?? []).map((d) => ({ id: d.id, g: extruded(d.points, 0.9) })), [world]);
  const decks = useMemo(() => world.piers.filter((p) => p.kind === 'pier' && !p.closed).map((p) => {
    const r = ribbon(p.points, p.width, LAND_Y - 0.05);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(r.positions, 3));
    g.setIndex(new THREE.BufferAttribute(r.indices, 1));
    g.computeVertexNormals();
    const posts: [number, number][] = [];
    for (let i = 1; i < p.points.length; i++) {
      const [ax, az] = p.points[i - 1]; const [bx, bz] = p.points[i];
      const len = Math.hypot(bx - ax, bz - az); const dx = (bx - ax) / len, dz = (bz - az) / len;
      for (let d = 0; d <= len; d += 5) for (const s of [-1, 1]) posts.push([ax + dx * d - dz * s * (p.width / 2 - 0.3), az + dz * d + dx * s * (p.width / 2 - 0.3)]);
    }
    return { id: p.id, g, posts };
  }), [world]);
  return (
    <group>
      {breakwaters.map((b) => <mesh key={b.id} geometry={b.g} castShadow receiveShadow><meshStandardMaterial color="#6f6a62" flatShading side={THREE.DoubleSide} /></mesh>)}
      {quays.map((q) => <mesh key={q.id} geometry={q.g} receiveShadow><meshStandardMaterial color="#cfc8ba" /></mesh>)}
      {decks.map((d) => (
        <group key={d.id}>
          <mesh geometry={d.g} castShadow receiveShadow><meshStandardMaterial color="#d6cfc1" side={THREE.DoubleSide} /></mesh>
          {d.posts.map(([x, z], i) => <mesh key={i} position={[x, 0.3, z]}><cylinderGeometry args={[0.18, 0.18, 1.8, 6]} /><meshStandardMaterial color="#9a8f7c" /></mesh>)}
        </group>
      ))}
    </group>
  );
}
