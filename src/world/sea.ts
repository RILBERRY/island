// Sea routing: a coarse grid over the atoll where island cells are blocked, searched with A*.
import type { World, Pt } from './types';
import { bounds } from './geometry';

const CELL = 80;

export interface SeaGrid { w: number; h: number; minX: number; minZ: number; blocked: Uint8Array }

let cache: { world: World; grid: SeaGrid } | null = null;

export function seaGrid(world: World): SeaGrid {
  if (cache && cache.world === world) return cache.grid;
  const b = world.atoll ? bounds(world.atoll) : bounds(world.coastlines.flatMap((c) => c.points));
  const pad = 2000;
  const minX = b.minX - pad, minZ = b.minZ - pad;
  const w = Math.ceil((b.maxX + pad - minX) / CELL), h = Math.ceil((b.maxZ + pad - minZ) / CELL);
  const blocked = new Uint8Array(w * h);
  // Scanline-rasterise every island ring.
  for (const island of world.coastlines) {
    const pts = island.points;
    const ib = bounds(pts);
    const r0 = Math.max(0, Math.floor((ib.minZ - minZ) / CELL)), r1 = Math.min(h - 1, Math.ceil((ib.maxZ - minZ) / CELL));
    for (let r = r0; r <= r1; r++) {
      const z = minZ + (r + 0.5) * CELL;
      const xs: number[] = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, zi] = pts[i]; const [xj, zj] = pts[j];
        if (zi > z !== zj > z) xs.push(xi + ((z - zi) * (xj - xi)) / (zj - zi));
      }
      xs.sort((a, c) => a - c);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.floor((xs[k] - minX) / CELL)), c1 = Math.min(w - 1, Math.ceil((xs[k + 1] - minX) / CELL));
        for (let c = c0; c <= c1; c++) blocked[r * w + c] = 1;
      }
    }
  }
  // Dilate by one cell so routes keep clear of the shore.
  const dil = new Uint8Array(blocked);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (blocked[r * w + c]) {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < h && cc >= 0 && cc < w) dil[rr * w + cc] = 1; }
  }
  const grid = { w, h, minX, minZ, blocked: dil };
  cache = { world, grid };
  return grid;
}

function cellOf(g: SeaGrid, x: number, z: number): [number, number] {
  return [Math.max(0, Math.min(g.w - 1, Math.floor((x - g.minX) / CELL))), Math.max(0, Math.min(g.h - 1, Math.floor((z - g.minZ) / CELL)))];
}

function nearestFree(g: SeaGrid, c: number, r: number): [number, number] {
  if (!g.blocked[r * g.w + c]) return [c, r];
  for (let rad = 1; rad < 40; rad++) for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
    if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < g.h && cc >= 0 && cc < g.w && !g.blocked[rr * g.w + cc]) return [cc, rr];
  }
  return [c, r];
}

class Heap {
  private a: { i: number; f: number }[] = [];
  push(i: number, f: number) { const a = this.a; a.push({ i, f }); let k = a.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (a[p].f <= a[k].f) break; [a[p], a[k]] = [a[k], a[p]]; k = p; } }
  pop(): { i: number; f: number } | undefined { const a = this.a; if (!a.length) return undefined; const top = a[0]; const last = a.pop()!; if (a.length) { a[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < a.length && a[l].f < a[m].f) m = l; if (r < a.length && a[r].f < a[m].f) m = r; if (m === k) break; [a[m], a[k]] = [a[k], a[m]]; k = m; } } return top; }
  get size() { return this.a.length; }
}

function lineClear(g: SeaGrid, c0: number, r0: number, c1: number, r1: number): boolean {
  let dc = Math.abs(c1 - c0), dr = -Math.abs(r1 - r0); const sc = c0 < c1 ? 1 : -1, sr = r0 < r1 ? 1 : -1; let err = dc + dr;
  let c = c0, r = r0;
  for (;;) {
    if (g.blocked[r * g.w + c]) return false;
    if (c === c1 && r === r1) return true;
    const e2 = 2 * err;
    if (e2 >= dr) { err += dr; c += sc; }
    if (e2 <= dc) { err += dc; r += sr; }
  }
}

/** Returns water waypoints from (x0,z0) to (x1,z1) around islands, or a straight line if no route exists. */
export function seaRoute(world: World, x0: number, z0: number, x1: number, z1: number): Pt[] {
  const g = seaGrid(world);
  const [sc, sr] = nearestFree(g, ...cellOf(g, x0, z0));
  const [ec, er] = nearestFree(g, ...cellOf(g, x1, z1));
  const start = sr * g.w + sc, goal = er * g.w + ec;
  const gScore = new Float32Array(g.w * g.h).fill(Infinity);
  const prev = new Int32Array(g.w * g.h).fill(-1);
  const closed = new Uint8Array(g.w * g.h);
  const heur = (i: number) => { const c = i % g.w, r = (i / g.w) | 0; const dc = Math.abs(c - ec), dr = Math.abs(r - er); return Math.max(dc, dr) + (Math.SQRT2 - 1) * Math.min(dc, dr); };
  const heap = new Heap();
  gScore[start] = 0; heap.push(start, heur(start));
  let found = false, expanded = 0;
  while (heap.size) {
    const cur = heap.pop()!.i;
    if (cur === goal) { found = true; break; }
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (++expanded > 400000) break;
    const c = cur % g.w, r = (cur / g.w) | 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= g.h || cc < 0 || cc >= g.w) continue;
      const ni = rr * g.w + cc;
      if (g.blocked[ni] || closed[ni]) continue;
      const ng = gScore[cur] + (dr && dc ? Math.SQRT2 : 1);
      if (ng < gScore[ni]) { gScore[ni] = ng; prev[ni] = cur; heap.push(ni, ng + heur(ni)); }
    }
  }
  if (!found) return [[x0, z0], [x1, z1]];
  const cells: number[] = [];
  for (let v = goal; v !== -1; v = prev[v]) cells.push(v);
  cells.reverse();
  // String-pull: keep only the corners that are needed.
  const keep = [cells[0]];
  let anchor = 0;
  for (let i = 2; i < cells.length; i++) {
    const a = cells[anchor], b = cells[i];
    if (!lineClear(g, a % g.w, (a / g.w) | 0, b % g.w, (b / g.w) | 0)) { keep.push(cells[i - 1]); anchor = i - 1; }
  }
  keep.push(cells[cells.length - 1]);
  const pts: Pt[] = keep.map((i) => [g.minX + ((i % g.w) + 0.5) * CELL, g.minZ + (((i / g.w) | 0) + 0.5) * CELL]);
  pts[0] = [x0, z0]; pts[pts.length - 1] = [x1, z1];
  return pts;
}
