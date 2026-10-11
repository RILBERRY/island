// Road network graph for ambient traffic: pedestrians, cyclists, cars and the Kalaidhoo bus.
import type { World, Pt } from './types';
import { rng } from './geometry';
import { HUMAN_PRESETS, defaultCharacter, type Character } from '../../shared/profile';

export interface RoadGraph { nodes: Pt[]; adj: Map<number, { to: number; len: number }[]> }

export function buildRoadGraph(world: World): RoadGraph {
  const nodes: Pt[] = []; const index = new Map<string, number>(); const adj = new Map<number, { to: number; len: number }[]>();
  const nodeId = (p: Pt) => {
    const k = `${Math.round(p[0] * 2)}/${Math.round(p[1] * 2)}`;
    let id = index.get(k);
    if (id === undefined) { id = nodes.length; nodes.push(p); index.set(k, id); adj.set(id, []); }
    return id;
  };
  for (const r of world.roads) {
    let prev = -1;
    for (const p of r.points) {
      const id = nodeId(p);
      if (prev >= 0 && prev !== id) {
        const len = Math.hypot(nodes[prev][0] - nodes[id][0], nodes[prev][1] - nodes[id][1]);
        if (!adj.get(prev)!.some((e) => e.to === id)) { adj.get(prev)!.push({ to: id, len }); adj.get(id)!.push({ to: prev, len }); }
      }
      prev = id;
    }
  }
  return { nodes, adj };
}

export interface Route { points: Pt[]; cum: number[]; length: number }

function routeFrom(points: Pt[]): Route {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  return { points, cum, length: cum[cum.length - 1] };
}

export function nearestNode(g: RoadGraph, x: number, z: number): number {
  let best = 0, bd = Infinity;
  g.nodes.forEach(([nx, nz], i) => { const d = Math.hypot(nx - x, nz - z); if (d < bd) { bd = d; best = i; } });
  return best;
}

/** Random walk over the graph, preferring to stay within `radius` of the origin. */
export function randomRoute(g: RoadGraph, rand: () => number, start: number, targetLen: number, radius: number): Route {
  const ids = [start]; let prev = -1, cur = start, len = 0;
  while (len < targetLen && ids.length < 400) {
    const edges = g.adj.get(cur) ?? [];
    if (edges.length === 0) break;
    let options = edges.filter((e) => e.to !== prev);
    if (options.length === 0) options = edges;
    const inside = options.filter((e) => Math.hypot(g.nodes[e.to][0], g.nodes[e.to][1]) < radius);
    const pick = (inside.length ? inside : options)[Math.floor(rand() * (inside.length ? inside.length : options.length))];
    prev = cur; cur = pick.to; len += pick.len; ids.push(cur);
  }
  return routeFrom(ids.map((i) => g.nodes[i]));
}

/** Shortest path from the harbour to the farthest reachable node: the island's "main line" for the bus. */
export function busRoute(g: RoadGraph, world: World): Route | null {
  const src = nearestNode(g, world.spawn.x, world.spawn.z);
  const dist = new Array(g.nodes.length).fill(Infinity); const prev = new Array(g.nodes.length).fill(-1);
  dist[src] = 0;
  const done = new Array(g.nodes.length).fill(false);
  for (let k = 0; k < g.nodes.length; k++) {
    let u = -1, best = Infinity;
    for (let i = 0; i < g.nodes.length; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
    if (u < 0) break;
    done[u] = true;
    for (const e of g.adj.get(u) ?? []) if (dist[u] + e.len < dist[e.to]) { dist[e.to] = dist[u] + e.len; prev[e.to] = u; }
  }
  let far = src;
  for (let i = 0; i < g.nodes.length; i++) if (dist[i] < Infinity && dist[i] > dist[far]) far = i;
  if (far === src) return null;
  const ids: number[] = [];
  for (let v = far; v !== -1; v = prev[v]) ids.push(v);
  ids.reverse();
  return routeFrom(ids.map((i) => g.nodes[i]));
}

export function routePose(route: Route, s: number): { x: number; z: number; dx: number; dz: number } {
  const { points, cum } = route;
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid; }
  const a = points[lo], b = points[Math.min(hi, points.length - 1)];
  const segLen = cum[hi] - cum[lo] || 1;
  const t = Math.max(0, Math.min(1, (s - cum[lo]) / segLen));
  const dx = (b[0] - a[0]) / segLen, dz = (b[1] - a[1]) / segLen;
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx, dz };
}

export type BotKind = 'walker' | 'cyclist' | 'car' | 'bus';
export interface Bot { id: string; kind: BotKind; route: Route; speed: number; phase: number; side: number; color: string; character: Character; name: string }

const CAR_COLORS = ['#e8e8e8', '#2b2b2b', '#c8372d', '#1e4d8f', '#f2c600', '#8fa3b5', '#2f9e7a', '#ff6b57'];
const BIKE_COLORS = ['#c8372d', '#1e4d8f', '#2f9e7a', '#f2c600', '#7a3fb0', '#ff6b57'];
const BOT_NAMES = ['Moosa', 'Zahira', 'Shafiu', 'Nazima', 'Waheed', 'Rasheedha', 'Ali', 'Hawwa', 'Niyaz', 'Sofiya', 'Latheef', 'Shiuna', 'Adam', 'Zulfa', 'Fauzan', 'Raziya', 'Hamid', 'Mausooma'];

function botCharacter(rand: () => number): Character {
  const preset = HUMAN_PRESETS[Math.floor(rand() * HUMAN_PRESETS.length)];
  const c = { ...defaultCharacter(), ...preset.patch };
  const tops = ['#ffffff', '#1e4d8f', '#2f9e7a', '#ffcf3f', '#ff6b57', '#7a3fb0', '#e4c6a0', '#f28fb2', '#087887'];
  c.top = tops[Math.floor(rand() * tops.length)];
  return c;
}

/** Deterministic set of ambient bots; positions derive from synchronised time so every client sees the same traffic. */
export function generateBots(world: World): Bot[] {
  const g = buildRoadGraph(world);
  if (g.nodes.length < 2) return [];
  const rand = rng(1973);
  const bots: Bot[] = [];
  const villageNodes = g.nodes.map((p, i) => ({ p, i })).filter(({ p }) => Math.hypot(p[0], p[1]) < 420).map(({ i }) => i);
  const pool = villageNodes.length > 10 ? villageNodes : g.nodes.map((_, i) => i);
  const pickStart = () => pool[Math.floor(rand() * pool.length)];
  let n = 0;
  const add = (kind: BotKind, speed: number, side: number, color: string, targetLen: number) => {
    const route = randomRoute(g, rand, pickStart(), targetLen, 520);
    if (route.length < 60) return;
    bots.push({ id: `bot-${n}`, kind, route, speed: speed * (0.9 + rand() * 0.2), phase: rand() * route.length * 2, side, color, character: botCharacter(rand), name: BOT_NAMES[n % BOT_NAMES.length] });
    n++;
  };
  for (let i = 0; i < 12; i++) add('walker', 1.3, 2.6, '#000', 500 + rand() * 700);
  for (let i = 0; i < 5; i++) add('cyclist', 5, 1.7, BIKE_COLORS[i % BIKE_COLORS.length], 900 + rand() * 900);
  for (let i = 0; i < 5; i++) add('car', 9, 1.5, CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)], 1200 + rand() * 1200);
  const bus = busRoute(g, world);
  if (bus && bus.length > 200) bots.push({ id: 'bot-bus', kind: 'bus', route: bus, speed: 8, phase: 0, side: 1.6, color: '#087887', character: botCharacter(rand), name: 'Kalaidhoo bus' });
  return bots;
}

export function botPose(bot: Bot, time: number): { x: number; z: number; dx: number; dz: number } {
  const L = bot.route.length; const period = 2 * L;
  let s = (time * bot.speed + bot.phase) % period; if (s < 0) s += period;
  let rev = false;
  if (s > L) { s = period - s; rev = true; }
  const p = routePose(bot.route, s);
  let dx = p.dx, dz = p.dz;
  if (rev) { dx = -dx; dz = -dz; }
  // Keep to the left of the carriageway (left-hand traffic), relative to the direction of travel.
  return { x: p.x + dz * bot.side, z: p.z - dx * bot.side, dx, dz };
}
