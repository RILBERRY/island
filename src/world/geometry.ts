import type { Pt, World, Road, Building, IllustrativeHouse, Landing } from './types';

export function pointInRing(x: number, z: number, ring: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i]; const [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function bounds(points: Pt[]): { minX: number; maxX: number; minZ: number; maxZ: number } {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of points) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z; }
  return { minX, maxX, minZ, maxZ };
}

export function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (pz - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cz = az + t * dz;
  return Math.hypot(px - cx, pz - cz);
}

export function distToRing(x: number, z: number, ring: Pt[]): number {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const d = distToSegment(x, z, ring[j][0], ring[j][1], ring[i][0], ring[i][1]);
    if (d < best) best = d;
  }
  return best;
}

export function distToPolyline(x: number, z: number, line: Pt[]): number {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const d = distToSegment(x, z, line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]);
    if (d < best) best = d;
  }
  return best;
}

export function signedArea(ring: Pt[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) { const [x1, z1] = ring[i]; const [x2, z2] = ring[(i + 1) % ring.length]; a += x1 * z2 - x2 * z1; }
  return a / 2;
}

/** Offsets a ring outward (positive) or inward (negative) by moving vertices along averaged edge normals. */
export function offsetRing(ring: Pt[], amount: number): Pt[] {
  const n = ring.length;
  const ccw = signedArea(ring) > 0;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const [px, pz] = ring[(i - 1 + n) % n]; const [cx, cz] = ring[i]; const [nx, nz] = ring[(i + 1) % n];
    let e1x = cx - px, e1z = cz - pz, e2x = nx - cx, e2z = nz - cz;
    const l1 = Math.hypot(e1x, e1z) || 1, l2 = Math.hypot(e2x, e2z) || 1;
    e1x /= l1; e1z /= l1; e2x /= l2; e2z /= l2;
    // Normal pointing outward for a CCW ring in x/z (screen-like) space.
    const s = ccw ? 1 : -1;
    const n1x = e1z * s, n1z = -e1x * s, n2x = e2z * s, n2z = -e2x * s;
    let mx = n1x + n2x, mz = n1z + n2z;
    const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    const dot = Math.max(0.35, mx * n1x + mz * n1z);
    out.push([cx + (mx * amount) / dot, cz + (mz * amount) / dot]);
  }
  return out;
}

/** Simplifies a polyline/ring with a distance tolerance (Douglas–Peucker). */
export function simplify(points: Pt[], tolerance: number): Pt[] {
  if (points.length < 3) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let maxD = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = distToSegment(points[i][0], points[i][1], points[a][0], points[a][1], points[b][0], points[b][1]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tolerance && idx > 0) { keep[idx] = true; stack.push([a, idx], [idx, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

/** Builds a flat ribbon mesh (positions/indices/uvs) along a polyline at a given width. */
export function ribbon(line: Pt[], width: number, y = 0): { positions: Float32Array; indices: Uint32Array; uvs: Float32Array } {
  const half = width / 2;
  const n = line.length;
  const positions = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);
  const indices = new Uint32Array((n - 1) * 6);
  let dist = 0;
  for (let i = 0; i < n; i++) {
    const [x, z] = line[i];
    let dx = 0, dz = 0;
    if (i > 0) { dx += x - line[i - 1][0]; dz += z - line[i - 1][1]; }
    if (i < n - 1) { dx += line[i + 1][0] - x; dz += line[i + 1][1] - z; }
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const nx = -dz, nz = dx;
    if (i > 0) dist += Math.hypot(x - line[i - 1][0], z - line[i - 1][1]);
    positions.set([x + nx * half, y, z + nz * half, x - nx * half, y, z - nz * half], i * 6);
    uvs.set([0, dist / width, 1, dist / width], i * 4);
    if (i < n - 1) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.set([a, c, b, b, c, d], i * 6);
    }
  }
  return { positions, indices, uvs };
}

/** Deterministic pseudo-random generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rect(cx: number, cz: number, w: number, d: number, rot: number): Pt[] {
  const c = Math.cos(rot), s = Math.sin(rot);
  const corners: Pt[] = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
  return corners.map(([x, z]) => [cx + x * c - z * s, cz + x * s + z * c]);
}

const HOUSE_COLORS = ['#fdf6e3', '#f7e9c8', '#eef3f1', '#f9dcd2', '#e4efe2', '#fff1b8', '#ebe4f5', '#dbeefa', '#f3e3cf'];
const ROOF_COLORS = ['#c8553d', '#b5452f', '#5f7f93', '#3f7e8f', '#6d8f5a', '#a04a3a', '#7a8fa3', '#2f8a8f', '#d2693f'];
const PLOT_MARGIN = 2.6;

/** Generates illustrative houses along roads near the village where OSM has no building footprint. */
export function generateHouses(world: World, radius = 420): IllustrativeHouse[] {
  const rand = rng(15011);
  const main = world.coastlines.find((c) => c.main)!;
  const land = offsetRing(main.points, -12);
  const houses: IllustrativeHouse[] = [];
  const buildings = world.buildings;
  const roads = world.roads;
  const occupied: { x: number; z: number; r: number }[] = buildings.map((b) => ({ x: b.x, z: b.z, r: Math.sqrt(b.areaM2) / 2 + 3 }));
  for (const pl of world.places) if (pl.icon === 'landmark') occupied.push({ x: pl.x, z: pl.z, r: 16 });
  for (const road of roads) {
    if (road.island && road.island !== main.name) continue;
    const pts = road.points;
    let along = rand() * 10;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1]; const [bx, bz] = pts[i];
      const segLen = Math.hypot(bx - ax, bz - az);
      const dx = (bx - ax) / (segLen || 1), dz = (bz - az) / (segLen || 1);
      const rot = Math.atan2(dz, dx);
      while (along < segLen) {
        const px = ax + dx * along, pz = az + dz * along;
        if (Math.hypot(px, pz) <= radius) {
          for (const side of [-1, 1]) {
            if (rand() < 0.22) continue;
            const w = 9 + rand() * 5, d = 7 + rand() * 4;
            const off = road.width / 2 + d / 2 + PLOT_MARGIN + 1 + rand() * 1.5;
            const cx = px - dz * off * side, cz = pz + dx * off * side;
            if (!pointInRing(cx, cz, land)) continue;
            const half = Math.max(w, d) / 2 + PLOT_MARGIN;
            if (occupied.some((o) => Math.hypot(o.x - cx, o.z - cz) < o.r + half + 0.5)) continue;
            let nearRoad = false;
            for (const r of roads) { if (distToPolyline(cx, cz, r.points) < r.width / 2 + Math.min(w, d) / 2 + PLOT_MARGIN) { nearRoad = true; break; } }
            if (nearRoad) continue;
            if (world.piers.some((p) => distToPolyline(cx, cz, p.points) < 14)) continue;
            if (distToRing(cx, cz, main.points) < 20) continue;
            // Which local side faces the road? local z = -dx*sin(rot) + dz*cos(rot)
            const lz = -(px - cx) * Math.sin(rot) + (pz - cz) * Math.cos(rot);
            const front: 1 | -1 = lz > 0 ? 1 : -1;
            const rr = rand();
            const roof: IllustrativeHouse['roof'] = rr < 0.5 ? 'hip' : rr < 0.85 ? 'gable' : 'flat';
            const h = roof === 'flat' ? (rand() < 0.3 ? 6.2 : 3.4) : rand() < 0.15 ? 6.2 : 3.4;
            const house: IllustrativeHouse = {
              id: `house-${houses.length}`, x: cx, z: cz, w, d, rot, height: h, roof, front,
              color: HOUSE_COLORS[Math.floor(rand() * HOUSE_COLORS.length)], roofColor: ROOF_COLORS[Math.floor(rand() * ROOF_COLORS.length)],
              points: rect(cx, cz, w, d, rot), plot: rect(cx, cz, w + PLOT_MARGIN * 2, d + PLOT_MARGIN * 2, rot),
            };
            houses.push(house);
            occupied.push({ x: cx, z: cz, r: half });
          }
        }
        along += 17 + rand() * 9;
      }
      along -= segLen;
    }
  }
  return houses;
}

export interface Obstacle { points: Pt[]; minX: number; maxX: number; minZ: number; maxZ: number }

/** Footprint for an illustrative mosque when OSM only has a node for it. */
export function illustrativeMosque(world: World): { x: number; z: number; rot: number; w: number; d: number; points: Pt[] } | null {
  const place = world.places.find((p) => /mosque|masjid/i.test(p.name) && (p.island === 'Isdhoo' || !p.island));
  if (!place) return null;
  if (world.buildings.some((b) => pointInRing(place.x, place.z, b.points))) return null;
  // Face the nearest road.
  let best: { d: number; rot: number } = { d: Infinity, rot: 0 };
  for (const r of world.roads) for (let i = 1; i < r.points.length; i++) {
    const d = distToSegment(place.x, place.z, r.points[i - 1][0], r.points[i - 1][1], r.points[i][0], r.points[i][1]);
    if (d < best.d) best = { d, rot: Math.atan2(r.points[i][1] - r.points[i - 1][1], r.points[i][0] - r.points[i - 1][0]) };
  }
  const w = 16, d = 12;
  return { x: place.x, z: place.z, rot: best.rot, w, d, points: rect(place.x, place.z, w + 4, d + 4, best.rot) };
}

export function makeObstacles(buildings: Building[], houses: IllustrativeHouse[], extra: Pt[][] = []): Obstacle[] {
  const all: Pt[][] = [...buildings.map((b) => b.points), ...houses.map((h) => h.plot), ...extra];
  return all.map((points) => ({ points, ...bounds(points) }));
}

interface RingBox { points: Pt[]; minX: number; maxX: number; minZ: number; maxZ: number }
function ringBoxes(rings: Pt[][]): RingBox[] { return rings.map((points) => ({ points, ...bounds(points) })); }
function inAny(boxes: RingBox[], x: number, z: number, pad = 0): boolean {
  for (const b of boxes) {
    if (x < b.minX - pad || x > b.maxX + pad || z < b.minZ - pad || z > b.maxZ + pad) continue;
    if (pointInRing(x, z, b.points)) return true;
  }
  return false;
}
function nearAnyLine(lines: { points: Pt[]; half: number; minX: number; maxX: number; minZ: number; maxZ: number }[], x: number, z: number): boolean {
  for (const l of lines) {
    if (x < l.minX - l.half || x > l.maxX + l.half || z < l.minZ - l.half || z > l.maxZ + l.half) continue;
    if (distToPolyline(x, z, l.points) < l.half) return true;
  }
  return false;
}
function lineBoxes(items: { points: Pt[]; width: number }[], extra: number) { return items.map((p) => ({ points: p.points, half: p.width / 2 + extra, ...bounds(p.points) })); }

/** Walkable: on any island (minus a shoreline margin), on a pier, dock or road (causeways), and outside buildings. */
export function makeWalkTest(world: World, obstacles: Obstacle[]) {
  const land = ringBoxes(world.coastlines.map((c) => (c.areaM2 > 20000 ? offsetRing(c.points, -2.5) : c.points)));
  const docks = ringBoxes((world.docks ?? []).map((d) => d.points));
  const pierLines = lineBoxes(world.piers.filter((p) => !p.closed), 0.5);
  const pierRings = ringBoxes(world.piers.filter((p) => p.closed).map((p) => p.points));
  const roadLines = lineBoxes(world.roads, 0.5);
  return (x: number, z: number): boolean => {
    const onStructure = nearAnyLine(pierLines, x, z) || inAny(pierRings, x, z) || inAny(docks, x, z) || nearAnyLine(roadLines, x, z);
    if (!onStructure && !inAny(land, x, z)) return false;
    for (const o of obstacles) {
      if (x < o.minX - 0.6 || x > o.maxX + 0.6 || z < o.minZ - 0.6 || z > o.maxZ + 0.6) continue;
      if (pointInRing(x, z, o.points) || distToRing(x, z, o.points) < 0.6) return false;
    }
    return true;
  };
}

/** Navigable water: inside the atoll area, off every island (plus a small buffer) and clear of piers. */
export function makeWaterTest(world: World) {
  const land = ringBoxes(world.coastlines.map((c) => offsetRing(simplify(c.points, 1), 3)));
  const pierLines = lineBoxes(world.piers.filter((p) => !p.closed), 1.5);
  const pierRings = ringBoxes(world.piers.filter((p) => p.closed).map((p) => p.points));
  const b = world.atoll ? bounds(world.atoll) : bounds(world.coastlines.flatMap((c) => c.points));
  const pad = 2500;
  return (x: number, z: number): boolean => {
    if (x < b.minX - pad || x > b.maxX + pad || z < b.minZ - pad || z > b.maxZ + pad) return false;
    if (inAny(land, x, z)) return false;
    if (nearAnyLine(pierLines, x, z) || inAny(pierRings, x, z)) return false;
    return true;
  };
}

/** On a road (cars only). */
export function makeRoadTest(world: World) {
  const lines = lineBoxes(world.roads, 0.9);
  return (x: number, z: number): boolean => nearAnyLine(lines, x, z);
}

export function nearestLanding(world: World, x: number, z: number, by: 'dock' | 'water' = 'dock'): { landing: Landing; dist: number } | null {
  let best: Landing | null = null, bd = Infinity;
  for (const l of world.landings ?? []) { const p = l[by]; const d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; best = l; } }
  return best ? { landing: best, dist: bd } : null;
}

/** Finds the closest walkable spot to a target by spiralling outward. */
export function nearestWalkable(test: (x: number, z: number) => boolean, x: number, z: number, maxR = 40): { x: number; z: number } | null {
  if (test(x, z)) return { x, z };
  for (let r = 1.5; r <= maxR; r += 1.5) {
    const steps = Math.max(8, Math.round(r * 2));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (test(px, pz)) return { x: px, z: pz };
    }
  }
  return null;
}

export interface VegetationSpots { palms: [number, number, number, number][]; trees: [number, number, number, number][]; bushes: [number, number, number][]; flowers: [number, number, number][] }

/** Vegetation across the atoll: dense near Isdhoo village roads, woods polygons elsewhere, sparse palms on every island. */
export function scatterVegetation(world: World, obstacles: Obstacle[], houses: IllustrativeHouse[] = []): VegetationSpots {
  const rand = rng(2026);
  const palms: [number, number, number, number][] = [];
  const trees: [number, number, number, number][] = [];
  const bushes: [number, number, number][] = [];
  const flowers: [number, number, number][] = [];
  const roads = world.roads;
  const buildingBoxes = ringBoxes(world.buildings.map((b) => b.points));
  const pitchBoxes = ringBoxes((world.pitches ?? []).map((p) => p.points));
  const roadLines = lineBoxes(roads, 1.5);
  const isClear = (x: number, z: number, margin: number) => {
    for (const o of obstacles) {
      if (x < o.minX - margin || x > o.maxX + margin || z < o.minZ - margin || z > o.maxZ + margin) continue;
      if (pointInRing(x, z, o.points) || distToRing(x, z, o.points) < margin) return false;
    }
    if (inAny(buildingBoxes, x, z, margin)) return false;
    if (nearAnyLine(roadLines, x, z)) return false;
    for (const p of world.piers) if (distToPolyline(x, z, p.points) < 8) return false;
    if (inAny(pitchBoxes, x, z, 4)) return false;
    return true;
  };
  const MAX_PALMS = 32000;
  for (const island of world.coastlines) {
    const ring = simplify(island.points, island.main ? 1.5 : 3);
    const inner = offsetRing(ring, -6);
    const b = bounds(ring);
    const area = (b.maxX - b.minX) * (b.maxZ - b.minZ);
    const attempts = island.main ? Math.min(30000, Math.round(area / 150)) : Math.min(1400, Math.round(area / 700));
    for (let i = 0; i < attempts && palms.length < MAX_PALMS; i++) {
      const x = b.minX + rand() * (b.maxX - b.minX);
      const z = b.minZ + rand() * (b.maxZ - b.minZ);
      if (!pointInRing(x, z, inner)) continue;
      const village = island.main && Math.hypot(x, z) < 420;
      if (village && rand() < 0.4) continue;
      if (!isClear(x, z, village ? 2.2 : 1.5)) continue;
      const kind = rand();
      if (!island.main) { if (kind < 0.75) palms.push([x, z, 6 + rand() * 6, rand() * Math.PI * 2]); else bushes.push([x, z, 0.8 + rand() * 1.2]); continue; }
      if (kind < 0.42) palms.push([x, z, 6 + rand() * 6, rand() * Math.PI * 2]);
      else if (kind < 0.68) trees.push([x, z, 4 + rand() * 3, rand() * Math.PI * 2]);
      else if (kind < 0.9) bushes.push([x, z, 0.8 + rand() * 1.2]);
      else flowers.push([x, z, 0.7 + rand() * 0.8]);
    }
  }
  // Mapped woods: dense palms.
  for (const w of world.woods ?? []) {
    const b = bounds(w.points);
    const area = (b.maxX - b.minX) * (b.maxZ - b.minZ);
    const attempts = Math.min(500, Math.round(area / 220));
    for (let i = 0; i < attempts && palms.length < MAX_PALMS; i++) {
      const x = b.minX + rand() * (b.maxX - b.minX);
      const z = b.minZ + rand() * (b.maxZ - b.minZ);
      if (!pointInRing(x, z, w.points) || !isClear(x, z, 1.5)) continue;
      if (rand() < 0.8) palms.push([x, z, 6 + rand() * 6, rand() * Math.PI * 2]); else trees.push([x, z, 4 + rand() * 3, rand() * Math.PI * 2]);
    }
  }
  // A tree or palm in many Isdhoo yards, in the corner away from the street.
  for (const h of houses) {
    const r = rand();
    if (r < 0.35) continue;
    const c = Math.cos(h.rot), sn = Math.sin(h.rot);
    const lx = (rand() < 0.5 ? -1 : 1) * (h.w / 2 + 1.3), lz = -h.front * (h.d / 2 + 1.4);
    const x = h.x + lx * c - lz * sn, z = h.z + lx * sn + lz * c;
    if (r < 0.65) trees.push([x, z, 3.5 + rand() * 2, rand() * Math.PI * 2]); else palms.push([x, z, 6 + rand() * 4, rand() * Math.PI * 2]);
  }
  return { palms, trees, bushes, flowers };
}

export function localToLatLon(world: World, x: number, z: number): { latitude: number; longitude: number } {
  const c = world.coordinates;
  return { latitude: c.origin.latitude - z / c.northScale, longitude: c.origin.longitude + x / c.eastScale };
}

export function roadsToObstacleFree(_: Road[]): void { /* placeholder for future pathing */ }
