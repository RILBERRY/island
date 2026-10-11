// Keyboard, joystick and camera input, kept outside React state for per-frame reads.
export const MIN_DIST = 9;
export const MAX_DIST = 1400;
export const OVERVIEW_DIST = 900;
export const FOLLOW_DIST = 16;

export const input = {
  keys: new Set<string>(),
  joystick: { x: 0, y: 0, active: false },
  sprint: false,
  /** Fixed-tilt orbit camera: only yaw and distance are user controlled; both are smoothed toward their targets. */
  orbit: { yaw: Math.PI + 0.35, targetYaw: Math.PI + 0.35, distance: FOLLOW_DIST, targetDistance: FOLLOW_DIST, tilt: 0, targetTilt: 0 },
  clickToWalk: null as { x: number; y: number } | null,
  typing: false,
  /** Set by teleport: the camera target jumps to the character instead of gliding. */
  snapCamera: false,
  pressed: new Set<string>(),
};

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
const ACTION_KEYS = new Set(['Digit1', 'Digit2', 'Digit3', 'KeyH', 'KeyT']);

export function installKeyboard(): () => void {
  const isTyping = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  };
  const down = (e: KeyboardEvent) => {
    if (isTyping(e)) { input.typing = true; return; }
    input.typing = false;
    if (MOVE_KEYS.has(e.code)) { input.keys.add(e.code); if (e.code.startsWith('Arrow')) e.preventDefault(); }
    if (ACTION_KEYS.has(e.code) && !e.repeat) input.pressed.add(e.code);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.sprint = true;
  };
  const up = (e: KeyboardEvent) => {
    input.keys.delete(e.code);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.sprint = false;
  };
  const blur = () => { input.keys.clear(); input.sprint = false; };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
}

/** Movement vector in camera space: x = strafe (right +), y = forward (+). */
export function readMove(): { x: number; y: number; sprint: boolean } {
  let x = 0, y = 0;
  const k = input.keys;
  if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
  if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
  if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
  if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
  if (input.joystick.active) { x += input.joystick.x; y += input.joystick.y; }
  const l = Math.hypot(x, y);
  if (l > 1) { x /= l; y /= l; }
  return { x, y, sprint: input.sprint || l > 0.92 && input.joystick.active };
}

export function zoomBy(factor: number): void {
  input.orbit.targetDistance = Math.min(MAX_DIST, Math.max(MIN_DIST, input.orbit.targetDistance * factor));
}
export function setOverview(on: boolean): void {
  input.orbit.targetDistance = on ? OVERVIEW_DIST : FOLLOW_DIST;
}
export const TILT_MIN = -0.2;
export const TILT_MAX = 0.3;
/** Camera tilt is shallow and grows gently with distance: ~33° close up, ~58° in the island overview, plus a small manual tilt. */
export function pitchFor(distance: number, tilt = 0): number {
  const t = Math.log(distance / MIN_DIST) / Math.log(MAX_DIST / MIN_DIST);
  const s = t * t * (3 - 2 * t);
  return Math.min(1.25, Math.max(0.3, 0.58 + 0.44 * s + tilt));
}
export function tiltBy(delta: number): void {
  input.orbit.targetTilt = Math.min(TILT_MAX, Math.max(TILT_MIN, input.orbit.targetTilt + delta));
}
