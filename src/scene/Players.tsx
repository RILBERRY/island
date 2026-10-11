import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, localPos, remoteTargets } from '../store';
import { input, readMove, pitchFor } from '../input';
import { Bicycle, Car } from './Vehicles';
import { MODE_INFO, setMode, stopSailing, dockAt, stopDriving } from '../travel';
import { Dhoni } from './Boats';
import { send } from '../net/socket';
import { sfx } from '../audio';
import { Character, characterHeight } from './Character';
import { LAND_Y, EMOTE_MS, RENDER_LABEL_DISTANCE, labelPortal } from './constants';
import type { PlayerPublic } from '../../shared/protocol';
import { EMOTES } from '../../shared/profile';

function emoteEmoji(id: string): string { if (id === 'bell') return '🔔'; if (id === 'horn') return '📯'; return EMOTES.find((e) => e.id === id)?.emoji ?? id; }

/** A character on foot, on a bicycle, or driving a car. */
function Rider({ character, anim, mode, moving, emote, emoteAt }: { character: PlayerPublic['character']; anim: string; mode: PlayerPublic['mode']; moving: boolean; emote?: string | null; emoteAt?: number }) {
  if (mode === 'boat') return <group><Dhoni color="#f4f1e8" trim={character.top} /><group position={[0, 0.82, -2.4]}><Character character={character} anim={moving ? 'idle' : 'idle'} emote={emote} emoteAt={emoteAt} /></group></group>;
  if (mode === 'car') return <Car color={character.top} moving={moving} />;
  if (mode === 'bicycle') return <Bicycle color={character.top} moving={moving}><Character character={character} anim={moving ? 'ride' : 'seat'} emote={emote} emoteAt={emoteAt} /></Bicycle>;
  return <Character character={character} anim={anim} emote={emote} emoteAt={emoteAt} />;
}

export function LocalPlayer() {
  const group = useRef<THREE.Group>(null);
  const profile = useStore((s) => s.profile)!;
  const me = useStore((s) => s.me);
  const myEmote = useStore((s) => (s.me ? s.emotes[s.me] : undefined));
  const walkTest = useStore((s) => s.walkTest);
  const [anim, setAnim] = useState('idle');
  const mode = useStore((s) => s.mode);
  const stuckFor = useRef(0);
  const lastProgress = useRef({ x: 0, z: 0 });
  const lastHorn = useRef(0);

  useFrame((_, dt) => {
    const g = group.current; if (!g || !walkTest) return;
    const d = Math.min(dt, 0.1);
    const st = useStore.getState();
    if (input.pressed.size && !input.typing) {
      if (input.pressed.has('Digit1')) setMode('walk');
      if (input.pressed.has('Digit2')) setMode('bicycle');
      if (input.pressed.has('Digit3')) setMode('car');
      if (input.pressed.has('KeyT')) st.setPanel(st.panel === 'travel' ? null : 'travel');
      if (input.pressed.has('KeyH') && st.mode !== 'walk' && Date.now() - lastHorn.current > 900) {
        lastHorn.current = Date.now(); const e = st.mode === 'car' ? 'horn' : 'bell'; sfx(e); send({ t: 'emote', emote: e }); if (st.me) st.setEmote(st.me, e);
      }
      input.pressed.clear();
    }
    const info = MODE_INFO[st.mode];
    const boat = st.mode === 'boat';
    const roadTest = st.roadTest;
    const test = boat ? (st.waterTest ?? walkTest) : st.mode === 'car' && roadTest ? (x: number, z: number) => walkTest(x, z) && roadTest(x, z) : walkTest;
    const mv = readMove();
    let dirX = 0, dirZ = 0, running = false;
    let autoSpeed = 0;
    const yaw = input.orbit.yaw;
    const sailing = boat ? st.sailing : null;
    const driving = !boat ? st.driving : null;
    const auto = sailing ?? driving;
    if (auto && !input.typing && (mv.x !== 0 || mv.y !== 0)) { if (sailing) stopSailing(); else stopDriving(); }
    else if (auto) {
      const wp = auto.waypoints[auto.index];
      const tx = wp[0] - localPos.x, tz = wp[1] - localPos.z; const dist = Math.hypot(tx, tz);
      const step = auto.speed * d;
      const arriveR = sailing ? Math.max(14, step * 1.5) : Math.max(1.2, step * 1.2);
      if (dist <= arriveR) {
        if (auto.index + 1 >= auto.waypoints.length) {
          if (sailing) { dockAt(sailing.dest); return; }
          st.setDriving(null); st.toast(`You've arrived at ${driving!.label}.`, 'success');
        } else if (sailing) st.setSailing({ ...sailing, index: sailing.index + 1 });
        else st.setDriving({ ...driving!, index: driving!.index + 1 });
      } else { dirX = tx / dist; dirZ = tz / dist; autoSpeed = auto.speed; }
    }
    if (autoSpeed === 0 && !input.typing && (mv.x !== 0 || mv.y !== 0)) {
      // Camera-relative movement: forward is away from the camera.
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      dirX = fx * mv.y + rx * mv.x; dirZ = fz * mv.y + rz * mv.x;
      running = mv.sprint;
      if (st.walkTarget) st.setWalkTarget(null);
    } else if (st.walkTarget) {
      const tx = st.walkTarget.x - localPos.x, tz = st.walkTarget.z - localPos.z;
      const dist = Math.hypot(tx, tz);
      if (dist < 0.45) st.setWalkTarget(null);
      else { dirX = tx / dist; dirZ = tz / dist; running = dist > 12; }
    }
    const len = Math.hypot(dirX, dirZ);
    if (len > 0) {
      dirX /= len; dirZ /= len;
      const speed = autoSpeed > 0 ? autoSpeed : (running ? info.fast : info.speed) * Math.min(1, len);
      let nx = localPos.x + dirX * speed * d, nz = localPos.z + dirZ * speed * d;
      if (!test(nx, nz)) {
        if (test(nx, localPos.z)) nz = localPos.z;
        else if (test(localPos.x, nz)) nx = localPos.x;
        else { nx = localPos.x; nz = localPos.z; }
      }
      localPos.x = nx; localPos.z = nz;
      const targetRot = Math.atan2(dirX, dirZ);
      let diff = targetRot - localPos.rot;
      while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
      localPos.rot += diff * Math.min(1, d * (autoSpeed > 0 ? (boat ? 3.5 : 10) : info.turn));
      const a = running || autoSpeed > 0 ? 'run' : 'walk';
      if (localPos.anim !== a) { localPos.anim = a; setAnim(a); }
      if (st.walkTarget) {
        const moved = Math.hypot(localPos.x - lastProgress.current.x, localPos.z - lastProgress.current.z);
        if (moved < 0.02) { stuckFor.current += d; if (stuckFor.current > 1.2) { st.setWalkTarget(null); st.toast('That route is blocked. Try another nearby point.', 'error'); stuckFor.current = 0; } }
        else { stuckFor.current = 0; lastProgress.current = { x: localPos.x, z: localPos.z }; }
      }
    } else if (localPos.anim !== 'idle') { localPos.anim = 'idle'; setAnim('idle'); }
    g.position.set(localPos.x, boat ? 0.05 + Math.sin(performance.now() / 800) * 0.08 : LAND_Y, localPos.z);
    g.rotation.y = localPos.rot;
  });

  const h = mode === 'boat' ? 3.4 : mode === 'car' ? 1.9 : characterHeight(profile.character) + (mode === 'bicycle' ? 0.25 : 0);
  const moving = anim !== 'idle';
  return (
    <group ref={group}>
      <Rider character={profile.character} anim={anim} mode={mode} moving={moving} emote={myEmote?.emote} emoteAt={myEmote?.at} />
      <Html portal={labelPortal} position={[0, h + 0.35, 0]} center distanceFactor={14} zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
        <div className="player-indicator me"><span className="pi-emoji">{profile.emoji}</span>{profile.name}<small>You</small></div>
      </Html>
      {myEmote && Date.now() - myEmote.at < EMOTE_MS && <EmoteBubble emote={myEmote.emote} height={h} />}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.35, 0.5, 24]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.35} /></mesh>
      {me === null && null}
    </group>
  );
}

function EmoteBubble({ emote, height }: { emote: string; height: number }) {
  const [, force] = useState(0);
  useEffect(() => { const t = setTimeout(() => force((n) => n + 1), EMOTE_MS); return () => clearTimeout(t); }, [emote]);
  return (
    <Html portal={labelPortal} position={[0, height + 0.9, 0]} center distanceFactor={12} zIndexRange={[45, 0]} style={{ pointerEvents: 'none' }}>
      <div className="emote-bubble">{emoteEmoji(emote)}</div>
    </Html>
  );
}

function RemotePlayer({ player }: { player: PlayerPublic }) {
  const group = useRef<THREE.Group>(null);
  const [anim, setAnim] = useState(player.anim);
  const emote = useStore((s) => s.emotes[player.id]);
  const [near, setNear] = useState(true);
  const start = useRef({ x: player.x, z: player.z, rot: player.rot });
  useFrame((_, dt) => {
    const g = group.current; if (!g) return;
    const t = remoteTargets.get(player.id);
    const cur = start.current;
    if (t) {
      const k = Math.min(1, dt * 9);
      cur.x += (t.x - cur.x) * k; cur.z += (t.z - cur.z) * k;
      let diff = t.rot - cur.rot; while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
      cur.rot += diff * Math.min(1, dt * 10);
      const moving = Math.hypot(t.x - cur.x, t.z - cur.z) > 0.08;
      const a = moving ? t.anim === 'run' ? 'run' : 'walk' : t.anim === 'idle' ? 'idle' : Date.now() - t.at > 300 ? 'idle' : t.anim;
      if (a !== anim) setAnim(a);
    }
    g.position.set(cur.x, (t?.mode ?? player.mode) === 'boat' ? 0.05 : LAND_Y, cur.z); g.rotation.y = cur.rot;
    const dist = Math.hypot(cur.x - localPos.x, cur.z - localPos.z);
    const n = dist < RENDER_LABEL_DISTANCE; if (n !== near) setNear(n);
  });
  const mode = player.mode ?? 'walk';
  const h = mode === 'boat' ? 3.4 : mode === 'car' ? 1.9 : characterHeight(player.character) + (mode === 'bicycle' ? 0.25 : 0);
  const party = useStore((s) => (player.partyId ? s.parties[player.partyId] : undefined));
  return (
    <group ref={group} onClick={(e) => { e.stopPropagation(); useStore.getState().setPanel('nearby'); }}>
      <Rider character={player.character} anim={anim} mode={mode} moving={anim !== 'idle'} emote={emote?.emote} emoteAt={emote?.at} />
      {near && (
        <Html portal={labelPortal} position={[0, h + 0.35, 0]} center distanceFactor={14} zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
          <div className="player-indicator"><span className="pi-emoji">{player.emoji}</span>{player.name}{party && <small>🎲 {party.status === 'playing' ? 'Playing' : 'At a table'}</small>}</div>
        </Html>
      )}
      {emote && Date.now() - emote.at < EMOTE_MS && <EmoteBubble emote={emote.emote} height={h} />}
    </group>
  );
}

export function RemotePlayers() {
  const players = useStore((s) => s.players);
  const me = useStore((s) => s.me);
  const list = useMemo(() => Object.values(players).filter((p) => p.id !== me), [players, me]);
  return <>{list.map((p) => <RemotePlayer key={p.id} player={p} />)}</>;
}

export function CameraRig() {
  const { camera } = useThree();
  const smooth = useRef(new THREE.Vector3(localPos.x, LAND_Y, localPos.z));
  const first = useRef(true);
  useFrame((_, dt) => {
    const o = input.orbit;
    const d = Math.min(dt, 0.1);
    if (!input.typing) {
      if (input.keys.has('KeyQ')) o.targetYaw += d * 1.5;
      if (input.keys.has('KeyE')) o.targetYaw -= d * 1.5;
    }
    // Exponential smoothing toward the targets: yaw linearly, distance in log space.
    o.yaw += (o.targetYaw - o.yaw) * Math.min(1, d * 9);
    o.distance = Math.exp(Math.log(o.distance) + (Math.log(o.targetDistance) - Math.log(o.distance)) * Math.min(1, d * 6));
    o.tilt += (o.targetTilt - o.tilt) * Math.min(1, d * 8);
    const follow = useStore.getState().followAvatar;
    const target = smooth.current;
    if (input.snapCamera) { target.set(localPos.x, LAND_Y, localPos.z); input.snapCamera = false; }
    else if (follow) { const k = Math.min(1, d * 7); target.x += (localPos.x - target.x) * k; target.z += (localPos.z - target.z) * k; }
    const pitch = pitchFor(o.distance, o.tilt);
    const px = target.x + Math.sin(o.yaw) * Math.cos(pitch) * o.distance;
    const pz = target.z + Math.cos(o.yaw) * Math.cos(pitch) * o.distance;
    const py = LAND_Y + 1.4 + Math.sin(pitch) * o.distance;
    camera.position.set(px, py, pz);
    camera.lookAt(target.x, LAND_Y + 1.2, target.z);
    // Push the near plane out as we zoom out so thin water layers don't z-fight from high up.
    const near = Math.max(0.4, o.distance * 0.03);
    if (Math.abs((camera as THREE.PerspectiveCamera).near - near) > 0.05 || first.current) { (camera as THREE.PerspectiveCamera).near = near; (camera as THREE.PerspectiveCamera).updateProjectionMatrix(); first.current = false; }
  });
  return null;
}

/** Converts a click on the canvas into a walk destination on the ground plane. */
export function GroundClick() {
  const { camera } = useThree();
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -LAND_Y), []);
  useFrame(() => {
    const c = input.clickToWalk; if (!c) return; input.clickToWalk = null;
    ray.setFromCamera(new THREE.Vector2(c.x, c.y), camera);
    const hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(plane, hit)) {
      const st = useStore.getState();
      if (st.walkTest && !st.walkTest(hit.x, hit.z)) { st.toast('There is no open walking point near this location yet.', 'error'); return; }
      st.setWalkTarget({ x: hit.x, z: hit.z });
    }
  });
  return null;
}
