import { useEffect, useRef } from 'react';
import { input } from '../input';
import { useStore } from '../store';

export function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const mode = useStore((s) => s.settings.joystick);
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const show = mode === 'on' || (mode === 'auto' && coarse);

  useEffect(() => {
    const el = base.current; const k = knob.current; if (!el || !k || !show) return;
    let active = false; let id = -1;
    const radius = 36;
    const update = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect();
      let dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
      const l = Math.hypot(dx, dy); if (l > radius) { dx = (dx / l) * radius; dy = (dy / l) * radius; }
      k.style.transform = `translate(${dx}px, ${dy}px)`;
      input.joystick.x = dx / radius; input.joystick.y = -dy / radius; input.joystick.active = true;
    };
    const down = (e: PointerEvent) => { active = true; id = e.pointerId; el.setPointerCapture(id); update(e.clientX, e.clientY); e.preventDefault(); e.stopPropagation(); };
    const move = (e: PointerEvent) => { if (active && e.pointerId === id) { update(e.clientX, e.clientY); e.stopPropagation(); } };
    const up = (e: PointerEvent) => { if (e.pointerId !== id) return; active = false; k.style.transform = ''; input.joystick.x = 0; input.joystick.y = 0; input.joystick.active = false; e.stopPropagation(); };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
  }, [show]);

  if (!show) return null;
  return (
    <div className="joystick-wrap">
      <div ref={base} className="joystick" aria-label="Touch movement joystick" role="application">
        <div ref={knob} className="joystick-knob" />
      </div>
    </div>
  );
}
