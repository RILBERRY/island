// All sound is synthesised with the Web Audio API: ocean ambience, a soft
// generative pad and short game cues. No audio files are shipped.
import { useStore } from './store';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let oceanGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let started = false;
let musicTimer: number | null = null;

function getCtx(): AudioContext | null {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) { ctx = new AC(); master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination); }
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  return ctx;
}

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < d.length; i++) {
    // Pink-ish noise via a cheap filter cascade.
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
  }
  return buf;
}

export function startAmbience(): void {
  const c = getCtx();
  if (!c || !master || started) return;
  started = true;
  const s = useStore.getState().settings;
  // Ocean: looping pink noise through a low-pass, with slow swells.
  const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 6); src.loop = true;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; lp.Q.value = 0.4;
  oceanGain = c.createGain(); oceanGain.gain.value = s.oceanVolume * 0.6;
  const swell = c.createGain(); swell.gain.value = 0.7;
  const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.09;
  const lfoGain = c.createGain(); lfoGain.gain.value = 0.3;
  lfo.connect(lfoGain).connect(swell.gain);
  src.connect(lp).connect(swell).connect(oceanGain).connect(master);
  src.start(); lfo.start();
  // Music: a slow pentatonic pad.
  musicGain = c.createGain(); musicGain.gain.value = s.musicVolume * 0.35; musicGain.connect(master);
  scheduleMusic();
}

const SCALE = [0, 2, 4, 7, 9, 12, 14];
let step = 0;
function scheduleMusic() {
  const c = ctx; if (!c || !musicGain) return;
  const play = () => {
    if (!ctx || !musicGain) return;
    const t = ctx.currentTime;
    const base = 220;
    const n = SCALE[(step * 3 + Math.floor(Math.random() * 2)) % SCALE.length];
    const f = base * Math.pow(2, n / 12);
    for (const [mult, g] of [[1, 0.35], [2, 0.12], [0.5, 0.2]] as [number, number][]) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f * mult;
      const env = ctx.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(g, t + 1.2); env.gain.exponentialRampToValueAtTime(0.0001, t + 6);
      o.connect(env).connect(musicGain); o.start(t); o.stop(t + 6.2);
    }
    step++;
  };
  play();
  musicTimer = window.setInterval(play, 3600);
  void c;
}

export function applyVolumes(): void {
  const s = useStore.getState().settings;
  if (oceanGain) oceanGain.gain.value = s.oceanVolume * 0.6;
  if (musicGain) musicGain.gain.value = s.musicVolume * 0.35;
}

export function stopAmbience(): void {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  ctx?.suspend().catch(() => undefined);
  started = false;
}

function tone(c: AudioContext, vol: number, when: number, f0: number, f1: number, dur: number, type: OscillatorType = 'sine') {
  if (!master) return;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, when); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), when + dur);
  g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(vol, when + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g).connect(master); o.start(when); o.stop(when + dur + 0.02);
}
function click(c: AudioContext, vol: number, when: number, dur: number) {
  if (!master) return;
  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = c.createBufferSource(); s.buffer = buf; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; const g = c.createGain(); g.gain.value = vol;
  s.connect(f).connect(g).connect(master); s.start(when);
}

export type Sfx = 'play' | 'draw' | 'turn' | 'uno' | 'win' | 'lose' | 'message' | 'wave' | 'tap' | 'correct' | 'wrong' | 'tick' | 'move' | 'check' | 'purr' | 'bell' | 'horn' | 'teleport';
export function sfx(kind: Sfx): void {
  const c = getCtx(); if (!c) return;
  const v = useStore.getState().settings.gameVolume * 0.18;
  if (v <= 0.001) return;
  const t = c.currentTime;
  switch (kind) {
    case 'play': click(c, v * 1.4, t, 0.12); tone(c, v * 0.5, t + 0.05, 520, 380, 0.08); break;
    case 'draw': click(c, v, t, 0.09); break;
    case 'turn': tone(c, v * 0.7, t, 660, 660, 0.12, 'triangle'); tone(c, v * 0.7, t + 0.12, 880, 880, 0.18, 'triangle'); break;
    case 'uno': [523, 659, 784].forEach((f, i) => tone(c, v, t + i * 0.08, f, f, 0.16, 'square')); break;
    case 'win': case 'correct': [523, 659, 784, 1047].forEach((f, i) => tone(c, v, t + i * 0.12, f, f, 0.3, 'triangle')); break;
    case 'lose': case 'wrong': tone(c, v * 0.6, t, 220, 160, 0.14, 'sawtooth'); break;
    case 'message': tone(c, v * 0.5, t, 880, 1180, 0.09, 'sine'); break;
    case 'wave': tone(c, v * 0.6, t, 600, 900, 0.12, 'triangle'); tone(c, v * 0.6, t + 0.13, 900, 1200, 0.12, 'triangle'); break;
    case 'tap': click(c, v * 0.6, t, 0.05); break;
    case 'tick': tone(c, v * 0.3, t, 1200, 1200, 0.03, 'square'); break;
    case 'move': click(c, v * 1.2, t, 0.07); break;
    case 'check': tone(c, v * 0.8, t, 440, 660, 0.2, 'triangle'); break;
    case 'purr': tone(c, v * 0.4, t, 90, 70, 0.5, 'sawtooth'); break;
    case 'bell': tone(c, v * 0.9, t, 2100, 2100, 0.18, 'sine'); tone(c, v * 0.9, t + 0.16, 2100, 2100, 0.3, 'sine'); break;
    case 'horn': tone(c, v * 1.1, t, 330, 330, 0.35, 'square'); tone(c, v * 0.8, t, 415, 415, 0.35, 'square'); break;
    case 'teleport': tone(c, v * 0.8, t, 300, 1500, 0.45, 'sine'); tone(c, v * 0.5, t + 0.1, 600, 2400, 0.4, 'triangle'); break;
  }
}
