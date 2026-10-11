import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, localPos } from '../store';
import { input } from '../input';
import { Icon } from './icons';
import { simplify } from '../world/geometry';

export function Minimap() {
  const world = useStore((s) => s.world)!;
  const houses = useStore((s) => s.houses);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(0.5); // px per metre
  const [big, setBig] = useState(false);
  const size = big ? 300 : 170;

  const paths = useMemo(() => {
    const land = world.coastlines.map((c) => simplify(c.points, 3));
    const roads = world.roads.map((r) => r.points);
    const buildings = [...world.buildings.map((b) => b.points), ...houses.map((h) => h.points)];
    const piers = world.piers.map((p) => p.points);
    return { land, roads, buildings, piers };
  }, [world, houses]);

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const cv = canvas.current; if (!cv) { raf = requestAnimationFrame(draw); return; }
      const ctx = cv.getContext('2d')!;
      const dpr = window.devicePixelRatio || 1;
      if (cv.width !== size * dpr) { cv.width = size * dpr; cv.height = size * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#1f8fb8'; ctx.fillRect(0, 0, size, size);
      const cx = localPos.x, cz = localPos.z;
      const reach = (size / 2) / zoom + 30;
      const toPx = (x: number, z: number): [number, number] => [size / 2 + (x - cx) * zoom, size / 2 + (z - cz) * zoom];
      const poly = (pts: [number, number][], fill?: string, stroke?: string, width = 1) => {
        ctx.beginPath(); pts.forEach(([x, z], i) => { const [px, pz] = toPx(x, z); if (i) ctx.lineTo(px, pz); else ctx.moveTo(px, pz); });
        if (fill) { ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
      };
      for (const l of paths.land) poly(l, '#e5d9b0', '#f4ecd3', 2);
      for (const r of paths.roads) { if (Math.abs(r[0][0] - cx) > reach * 6 && Math.abs(r[0][1] - cz) > reach * 6) continue; poly(r, undefined, '#c9b88f', Math.max(1, 5 * zoom)); }
      for (const p of paths.piers) poly(p, undefined, '#9a8f7c', Math.max(1.5, 4 * zoom));
      ctx.globalAlpha = 0.9; for (const b of paths.buildings) { if (Math.abs(b[0][0] - cx) > reach || Math.abs(b[0][1] - cz) > reach) continue; poly(b, '#c8553d'); } ctx.globalAlpha = 1;
      const st = useStore.getState();
      for (const p of world.places) { const [px, pz] = toPx(p.x, p.z); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(px, pz, 3.5, 0, Math.PI * 2); ctx.fill(); }
      for (const party of Object.values(st.parties)) { const [px, pz] = toPx(party.x, party.z); ctx.fillStyle = '#6b3b1c'; ctx.beginPath(); ctx.arc(px, pz, 4, 0, Math.PI * 2); ctx.fill(); }
      for (const p of Object.values(st.players)) { if (p.id === st.me) continue; const [px, pz] = toPx(p.x, p.z); ctx.fillStyle = '#ffcf3f'; ctx.strokeStyle = '#155b63'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, pz, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      const route = st.driving ?? st.sailing;
      if (route) { ctx.strokeStyle = st.driving ? '#087887' : '#ffcf3f'; ctx.lineWidth = 2.5; ctx.beginPath(); route.waypoints.forEach(([x, z], i) => { const [px, pz] = toPx(x, z); if (i) ctx.lineTo(px, pz); else ctx.moveTo(px, pz); }); ctx.stroke(); }
      if (st.walkTarget) { const [px, pz] = toPx(st.walkTarget.x, st.walkTarget.z); ctx.strokeStyle = '#ff6b57'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, pz, 5, 0, Math.PI * 2); ctx.stroke(); }
      if (st.profile?.home) { const [px, pz] = toPx(st.profile.home.x, st.profile.home.z); ctx.fillStyle = '#ff6b57'; ctx.beginPath(); ctx.moveTo(px, pz - 6); ctx.lineTo(px + 5, pz); ctx.lineTo(px - 5, pz); ctx.closePath(); ctx.fill(); }
      // me
      ctx.save(); ctx.translate(size / 2, size / 2); ctx.rotate(-localPos.rot);
      ctx.fillStyle = '#ff6b57'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      // camera cone
      ctx.save(); ctx.translate(size / 2, size / 2); ctx.rotate(-input.orbit.yaw + Math.PI); ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 28, -Math.PI / 2 - 0.45, -Math.PI / 2 + 0.45); ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [paths, zoom, size, world]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = localPos.x + (e.clientX - r.left - size / 2) / zoom;
    const z = localPos.z + (e.clientY - r.top - size / 2) / zoom;
    const st = useStore.getState();
    if (st.walkTest && !st.walkTest(x, z)) { st.toast('There is no open walking point near this location yet.', 'error'); return; }
    st.setWalkTarget({ x, z });
  };

  return (
    <div className={`minimap ${big ? 'big' : ''}`}>
      <canvas ref={canvas} style={{ width: size, height: size }} onClick={onClick} aria-label="Island map. Tap to walk there." />
      <div className="minimap-tools">
        <button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(3, z * 1.5))}><Icon name="plus" size={14} /></button>
        <button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.05, z / 1.5))}><Icon name="minus" size={14} /></button>
        <button aria-label={big ? 'Smaller map' : 'Bigger map'} onClick={() => setBig((b) => !b)}><Icon name="compass" size={14} /></button>
      </div>
      <span className="minimap-n">N</span>
    </div>
  );
}
