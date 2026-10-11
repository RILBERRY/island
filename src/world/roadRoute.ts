// Shortest road routes: snap to the nearest road node, Dijkstra across the network.
import type { World, Pt } from './types';
import { buildRoadGraph, nearestNode, type RoadGraph } from './roadGraph';
import { distToSegment } from './geometry';

let cache: { world: World; graph: RoadGraph } | null = null;
export function roadGraphFor(world: World): RoadGraph {
  if (cache && cache.world === world) return cache.graph;
  const graph = buildRoadGraph(world);
  cache = { world, graph };
  return graph;
}

/** Closest point on any road to (x,z), with the road's nearest graph node. */
export function snapToRoad(world: World, x: number, z: number): { x: number; z: number; dist: number } {
  let best = { x, z, dist: Infinity };
  for (const r of world.roads) {
    for (let i = 1; i < r.points.length; i++) {
      const [ax, az] = r.points[i - 1]; const [bx, bz] = r.points[i];
      const d = distToSegment(x, z, ax, az, bx, bz);
      if (d < best.dist) {
        const dx = bx - ax, dz = bz - az; const l2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
        best = { x: ax + t * dx, z: az + t * dz, dist: d };
      }
    }
  }
  return best;
}

export interface RoadRoute { points: Pt[]; length: number; reachesDestination: boolean }

/** Route from (x0,z0) to (x1,z1): straight to the nearest road, shortest path along roads, then (for non-cars) straight to the target. */
export function roadRoute(world: World, x0: number, z0: number, x1: number, z1: number, stayOnRoad: boolean): RoadRoute | null {
  const g = roadGraphFor(world);
  if (g.nodes.length < 2) return null;
  const s = nearestNode(g, x0, z0), e = nearestNode(g, x1, z1);
  const dist = new Float64Array(g.nodes.length).fill(Infinity); const prev = new Int32Array(g.nodes.length).fill(-1);
  const done = new Uint8Array(g.nodes.length);
  dist[s] = 0;
  // Simple binary-heap Dijkstra.
  const heap: { i: number; d: number }[] = [{ i: s, d: 0 }];
  const push = (i: number, d: number) => { heap.push({ i, d }); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p].d <= heap[k].d) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0]; const last = heap.pop()!; if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l].d < heap[m].d) m = l; if (r < heap.length && heap[r].d < heap[m].d) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  while (heap.length) {
    const { i } = pop();
    if (done[i]) continue; done[i] = 1;
    if (i === e) break;
    for (const edge of g.adj.get(i) ?? []) { const nd = dist[i] + edge.len; if (nd < dist[edge.to]) { dist[edge.to] = nd; prev[edge.to] = i; push(edge.to, nd); } }
  }
  if (dist[e] === Infinity) return null;
  const ids: number[] = [];
  for (let v = e; v !== -1; v = prev[v]) ids.push(v);
  ids.reverse();
  const points: Pt[] = [[x0, z0], ...ids.map((i) => g.nodes[i])];
  const endNode = g.nodes[e];
  const tail = Math.hypot(endNode[0] - x1, endNode[1] - z1);
  if (!stayOnRoad || tail < 2) points.push([x1, z1]);
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return { points, length, reachesDestination: !stayOnRoad || tail < 12 };
}
