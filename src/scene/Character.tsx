import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Character as CharacterSpec } from '../../shared/profile';
import { ANIMALS } from '../../shared/profile';
import { EMOTE_MS } from './constants';

interface Props { character: CharacterSpec; anim: string; emote?: string | null; emoteAt?: number; scale?: number }

export function characterHeight(c: CharacterSpec): number {
  if (c.kind === 'human') return 1.78;
  return { cat: 0.7, heron: 1.3, crab: 0.45, turtle: 0.5, goat: 1.0, fruitbat: 1.1 }[c.animal] ?? 0.8;
}

interface Rig { pose: THREE.Group | null; body: THREE.Group | null; head: THREE.Group | null; armL: THREE.Group | null; armR: THREE.Group | null; legL: THREE.Group | null; legR: THREE.Group | null; extraL: THREE.Group | null; extraR: THREE.Group | null }

export function Character({ character, anim, emote, emoteAt = 0, scale = 1 }: Props) {
  const rig = useRef<Rig>({ pose: null, body: null, head: null, armL: null, armR: null, legL: null, legR: null, extraL: null, extraR: null });
  const phase = useRef(Math.random() * 10);
  const human = character.kind === 'human';

  useFrame(({ clock }) => {
    const r = rig.current;
    if (!r.pose) return;
    const t = clock.elapsedTime + phase.current;
    const walking = anim === 'walk' || anim === 'run';
    const mul = anim === 'run' ? 1.55 : 1;
    const swing = walking ? Math.sin(t * 8.5 * mul) * (anim === 'run' ? 0.95 : 0.7) : 0;
    let bodyY = walking ? Math.abs(Math.sin(t * 8.5 * mul)) * 0.05 : Math.sin(t * 2) * 0.012;
    const active = emote && Date.now() - emoteAt < EMOTE_MS;
    const riding = anim === 'ride' || anim === 'seat';
    r.pose.rotation.set(0, 0, 0); r.pose.position.set(0, 0, 0);
    if (r.head) r.head.rotation.set(0, 0, 0);
    if (r.legL) r.legL.rotation.set(swing, 0, 0);
    if (r.legR) r.legR.rotation.set(-swing, 0, 0);
    if (r.armL) r.armL.rotation.set(-swing * 0.8, 0, 0.12);
    if (r.armR) r.armR.rotation.set(swing * 0.8, 0, -0.12);
    if (r.extraL) r.extraL.rotation.set(human ? 0 : swing * 0.5, 0, 0);
    if (r.extraR) r.extraR.rotation.set(human ? 0 : -swing * 0.5, 0, 0);
    if (riding) {
      const pedal = anim === 'ride' ? t * 9 : 0;
      bodyY = 0;
      r.pose.rotation.x = 0.14;
      if (r.legL) r.legL.rotation.set(-1.05 + Math.sin(pedal) * 0.5, 0, 0.08);
      if (r.legR) r.legR.rotation.set(-1.05 - Math.sin(pedal) * 0.5, 0, -0.08);
      if (r.armL) r.armL.rotation.set(-1.0, 0, 0.25);
      if (r.armR) r.armR.rotation.set(-1.0, 0, -0.25);
    }
    if (active) {
      const e = emote;
      if (e === 'wave') { if (r.armR) r.armR.rotation.set(-2.7, 0, -0.45 + Math.sin(t * 14) * 0.4); }
      else if (e === 'dance') { r.pose.rotation.y = Math.sin(t * 9) * 0.45; bodyY = Math.abs(Math.sin(t * 9)) * 0.1; if (r.armL) r.armL.rotation.set(-2.4 + Math.sin(t * 9) * 0.5, 0, 0.5); if (r.armR) r.armR.rotation.set(-2.4 - Math.sin(t * 9) * 0.5, 0, -0.5); }
      else if (e === 'sit') { bodyY = -0.42; if (r.legL) r.legL.rotation.set(-1.45, 0, 0.1); if (r.legR) r.legR.rotation.set(-1.45, 0, -0.1); if (r.armL) r.armL.rotation.set(-0.6, 0, 0.1); if (r.armR) r.armR.rotation.set(-0.6, 0, -0.1); }
      else if (e === 'laugh') { if (r.head) r.head.rotation.x = -0.2 + Math.sin(t * 16) * 0.12; bodyY = Math.abs(Math.sin(t * 16)) * 0.03; }
      else if (e === 'heart' || e === 'cheer') { bodyY = Math.abs(Math.sin(t * 8)) * 0.28; if (r.armL) r.armL.rotation.set(-2.9, 0, 0.4); if (r.armR) r.armR.rotation.set(-2.9, 0, -0.4); }
      else if (e === 'sleep') { r.pose.rotation.x = -Math.PI / 2; r.pose.position.set(0, 0.25, -0.2); }
      else if (e === 'think') { if (r.armR) r.armR.rotation.set(-2.1, 0, 0.9); if (r.head) r.head.rotation.set(0.15, 0, 0.18); }
    }
    r.pose.position.y += bodyY;
  });

  const set = (key: keyof Rig) => (el: THREE.Group | null) => { rig.current[key] = el; };

  if (!human) return <AnimalModel character={character} set={set} scale={scale} />;

  const c = character;
  const lowerLegColor = c.bottomStyle === 'shorts' || c.bottomStyle === 'skirt' ? c.skin : c.bottom;
  const upperLegColor = c.bottomStyle === 'skirt' ? c.skin : c.bottom;
  const showHair = !c.hijab && c.hair !== 'bald';
  return (
    <group scale={scale}>
      <group ref={set('pose')}>
        {/* legs */}
        {[-1, 1].map((side) => (
          <group key={side} ref={set(side < 0 ? 'legL' : 'legR')} position={[side * 0.11, 0.8, 0]}>
            <mesh position={[0, -0.18, 0]} castShadow><cylinderGeometry args={[0.095, 0.085, 0.36, 10]} /><meshStandardMaterial color={upperLegColor} /></mesh>
            <mesh position={[0, -0.52, 0]} castShadow><cylinderGeometry args={[0.08, 0.07, 0.34, 10]} /><meshStandardMaterial color={lowerLegColor} /></mesh>
            <mesh position={[0, -0.74, 0.03]} castShadow><boxGeometry args={[0.17, 0.1, 0.27]} /><meshStandardMaterial color="#2b2b2b" /></mesh>
          </group>
        ))}
        {/* body */}
        <group ref={set('body')} position={[0, 0.8, 0]}>
          <mesh position={[0, 0.27, 0]} castShadow><boxGeometry args={[0.46, 0.54, 0.27]} /><meshStandardMaterial color={c.top} /></mesh>
          {c.bottomStyle === 'skirt' && <mesh position={[0, -0.16, 0]} castShadow><coneGeometry args={[0.34, 0.42, 14, 1, true]} /><meshStandardMaterial color={c.bottom} side={THREE.DoubleSide} /></mesh>}
          {c.bottomStyle !== 'skirt' && <mesh position={[0, -0.02, 0]}><boxGeometry args={[0.44, 0.14, 0.26]} /><meshStandardMaterial color={c.bottom} /></mesh>}
          <mesh position={[0, 0.58, 0]}><cylinderGeometry args={[0.07, 0.08, 0.12, 10]} /><meshStandardMaterial color={c.skin} /></mesh>
        </group>
        {/* arms */}
        {[-1, 1].map((side) => (
          <group key={side} ref={set(side < 0 ? 'armL' : 'armR')} position={[side * 0.3, 1.3, 0]}>
            <mesh position={[0, -0.15, 0]} castShadow><cylinderGeometry args={[0.075, 0.07, 0.3, 10]} /><meshStandardMaterial color={c.top} /></mesh>
            <mesh position={[0, -0.43, 0]} castShadow><cylinderGeometry args={[0.065, 0.06, 0.28, 10]} /><meshStandardMaterial color={c.skin} /></mesh>
            <mesh position={[0, -0.6, 0]}><sphereGeometry args={[0.07, 10, 8]} /><meshStandardMaterial color={c.skin} /></mesh>
          </group>
        ))}
        {/* head */}
        <group ref={set('head')} position={[0, 1.54, 0]}>
          <mesh castShadow><sphereGeometry args={[0.215, 20, 16]} /><meshStandardMaterial color={c.skin} /></mesh>
          {[-1, 1].map((s) => <mesh key={s} position={[s * 0.075, 0.03, 0.19]}><sphereGeometry args={[0.028, 8, 6]} /><meshStandardMaterial color="#1b1b1b" /></mesh>)}
          <mesh position={[0, -0.07, 0.2]} rotation={[0.2, 0, 0]}><boxGeometry args={[0.07, 0.02, 0.02]} /><meshStandardMaterial color="#8d4b3f" /></mesh>
          {showHair && c.hair !== 'buzz' && c.hair !== 'curly' && (
            <mesh position={[0, 0.03, -0.01]}><sphereGeometry args={[0.235, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.52]} /><meshStandardMaterial color={c.hairColor} /></mesh>
          )}
          {showHair && c.hair === 'buzz' && <mesh position={[0, 0.03, -0.01]}><sphereGeometry args={[0.222, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5]} /><meshStandardMaterial color={c.hairColor} /></mesh>}
          {showHair && c.hair === 'curly' && <mesh position={[0, 0.07, -0.02]} scale={[1, 0.85, 1]}><dodecahedronGeometry args={[0.27, 1]} /><meshStandardMaterial color={c.hairColor} flatShading /></mesh>}
          {showHair && c.hair === 'long' && <mesh position={[0, -0.14, -0.13]}><boxGeometry args={[0.4, 0.46, 0.16]} /><meshStandardMaterial color={c.hairColor} /></mesh>}
          {showHair && c.hair === 'ponytail' && (<>
            <mesh position={[0, 0.06, -0.26]}><sphereGeometry args={[0.09, 10, 8]} /><meshStandardMaterial color={c.hairColor} /></mesh>
            <mesh position={[0, -0.12, -0.3]} rotation={[0.3, 0, 0]}><cylinderGeometry args={[0.05, 0.035, 0.32, 8]} /><meshStandardMaterial color={c.hairColor} /></mesh>
          </>)}
          {showHair && c.hair === 'bun' && <mesh position={[0, 0.28, -0.06]}><sphereGeometry args={[0.1, 10, 8]} /><meshStandardMaterial color={c.hairColor} /></mesh>}
          {showHair && c.hair === 'quiff' && <mesh position={[0, 0.25, 0.1]} rotation={[-0.5, 0, 0]}><boxGeometry args={[0.22, 0.12, 0.16]} /><meshStandardMaterial color={c.hairColor} /></mesh>}
          {c.hijab && (<>
            <mesh position={[0, 0.0, 0]}><sphereGeometry args={[0.25, 24, 16, Math.PI * 0.8, Math.PI * 1.4, 0, Math.PI * 0.82]} /><meshStandardMaterial color={c.hijabColor} side={THREE.DoubleSide} /></mesh>
            <mesh position={[0, -0.3, -0.02]}><coneGeometry args={[0.33, 0.4, 16, 1, true]} /><meshStandardMaterial color={c.hijabColor} side={THREE.DoubleSide} /></mesh>
          </>)}
          {c.beard && <mesh position={[0, -0.03, 0.03]}><sphereGeometry args={[0.2, 16, 12, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.3]} /><meshStandardMaterial color={c.hairColor} /></mesh>}
          {c.glasses && (<>
            {[-1, 1].map((s) => <mesh key={s} position={[s * 0.078, 0.03, 0.2]}><torusGeometry args={[0.055, 0.011, 6, 16]} /><meshStandardMaterial color="#222" /></mesh>)}
            <mesh position={[0, 0.03, 0.2]}><boxGeometry args={[0.05, 0.012, 0.012]} /><meshStandardMaterial color="#222" /></mesh>
          </>)}
        </group>
      </group>
    </group>
  );
}

function AnimalModel({ character, set, scale }: { character: CharacterSpec; set: (k: keyof Rig) => (el: THREE.Group | null) => void; scale: number }) {
  const fur = character.hairColor;
  const accent = character.clothesColor;
  const animal = ANIMALS.find((a) => a.id === character.animal)!;
  const id = character.animal;
  return (
    <group scale={scale}>
      <group ref={set('pose')}>
        {id === 'cat' && (<>
          <mesh position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><capsuleGeometry args={[0.13, 0.32, 6, 12]} /><meshStandardMaterial color={fur} /></mesh>
          <group ref={set('head')} position={[0, 0.38, 0.26]}>
            <mesh castShadow><sphereGeometry args={[0.13, 14, 12]} /><meshStandardMaterial color={fur} /></mesh>
            {[-1, 1].map((s) => <mesh key={s} position={[s * 0.07, 0.12, -0.02]} rotation={[0.2, 0, s * -0.3]}><coneGeometry args={[0.04, 0.09, 6]} /><meshStandardMaterial color={fur} /></mesh>)}
            {[-1, 1].map((s) => <mesh key={s} position={[s * 0.05, 0.02, 0.11]}><sphereGeometry args={[0.02, 8, 6]} /><meshStandardMaterial color="#2a3a2a" /></mesh>)}
            <mesh position={[0, -0.03, 0.13]}><sphereGeometry args={[0.018, 6, 6]} /><meshStandardMaterial color="#e39aa5" /></mesh>
          </group>
          <mesh position={[0, 0.3, 0.17]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.1, 0.02, 6, 16]} /><meshStandardMaterial color={accent} /></mesh>
          {[[-0.07, 0.12], [0.07, 0.12], [-0.07, -0.12], [0.07, -0.12]].map(([x, z], i) => (
            <group key={i} ref={set(i === 0 ? 'legL' : i === 1 ? 'legR' : i === 2 ? 'extraL' : 'extraR')} position={[x, 0.2, z]}>
              <mesh position={[0, -0.1, 0]}><cylinderGeometry args={[0.03, 0.03, 0.2, 6]} /><meshStandardMaterial color={fur} /></mesh>
            </group>
          ))}
          <mesh position={[0, 0.32, -0.3]} rotation={[0.9, 0, 0]}><cylinderGeometry args={[0.02, 0.028, 0.34, 6]} /><meshStandardMaterial color={fur} /></mesh>
        </>)}
        {id === 'heron' && (<>
          {[-1, 1].map((s) => <group key={s} ref={set(s < 0 ? 'legL' : 'legR')} position={[s * 0.06, 0.6, 0]}><mesh position={[0, -0.3, 0]}><cylinderGeometry args={[0.015, 0.015, 0.6, 6]} /><meshStandardMaterial color="#c9a356" /></mesh></group>)}
          <mesh position={[0, 0.7, 0]} scale={[1, 0.8, 1.5]} castShadow><sphereGeometry args={[0.17, 14, 12]} /><meshStandardMaterial color={fur} /></mesh>
          <mesh position={[0, 0.9, 0.18]} rotation={[0.5, 0, 0]}><cylinderGeometry args={[0.04, 0.05, 0.4, 8]} /><meshStandardMaterial color="#e8e8e8" /></mesh>
          <group ref={set('head')} position={[0, 1.1, 0.28]}>
            <mesh castShadow><sphereGeometry args={[0.08, 12, 10]} /><meshStandardMaterial color="#e8e8e8" /></mesh>
            <mesh position={[0, -0.01, 0.14]} rotation={[Math.PI / 2, 0, 0]}><coneGeometry args={[0.025, 0.2, 6]} /><meshStandardMaterial color="#e2b23a" /></mesh>
            {[-1, 1].map((s) => <mesh key={s} position={[s * 0.045, 0.02, 0.06]}><sphereGeometry args={[0.015, 6, 6]} /><meshStandardMaterial color="#111" /></mesh>)}
          </group>
          <mesh position={[0, 0.92, 0.12]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.06, 0.015, 6, 12]} /><meshStandardMaterial color={accent} /></mesh>
        </>)}
        {id === 'crab' && (<>
          <mesh position={[0, 0.14, 0]} scale={[1.4, 0.55, 1]} castShadow><sphereGeometry args={[0.18, 14, 10]} /><meshStandardMaterial color={fur} /></mesh>
          {[-1, 1].map((s) => <mesh key={s} position={[s * 0.3, 0.16, 0.12]} castShadow><sphereGeometry args={[0.08, 10, 8]} /><meshStandardMaterial color={fur} /></mesh>)}
          {[-1, 1].map((s) => <mesh key={s} position={[s * 0.06, 0.28, 0.12]}><sphereGeometry args={[0.025, 6, 6]} /><meshStandardMaterial color="#111" /></mesh>)}
          {[-0.12, 0, 0.12].flatMap((z) => [-1, 1].map((s) => <mesh key={`${z}${s}`} position={[s * 0.26, 0.08, z]} rotation={[0, 0, s * 0.9]}><cylinderGeometry args={[0.015, 0.015, 0.22, 5]} /><meshStandardMaterial color={fur} /></mesh>))}
          <mesh position={[0, 0.24, 0]}><boxGeometry args={[0.2, 0.02, 0.08]} /><meshStandardMaterial color={accent} /></mesh>
          <group ref={set('legL')} /><group ref={set('legR')} />
        </>)}
        {id === 'turtle' && (<>
          <mesh position={[0, 0.16, 0]} scale={[1, 0.55, 1.2]} castShadow><sphereGeometry args={[0.26, 16, 12]} /><meshStandardMaterial color={fur} flatShading /></mesh>
          <group ref={set('head')} position={[0, 0.2, 0.32]}><mesh castShadow><sphereGeometry args={[0.08, 10, 8]} /><meshStandardMaterial color="#7a9a4a" /></mesh>{[-1, 1].map((s) => <mesh key={s} position={[s * 0.04, 0.02, 0.06]}><sphereGeometry args={[0.015, 6, 6]} /><meshStandardMaterial color="#111" /></mesh>)}</group>
          {[[-0.22, 0.15], [0.22, 0.15], [-0.22, -0.15], [0.22, -0.15]].map(([x, z], i) => <group key={i} ref={set(i === 0 ? 'legL' : i === 1 ? 'legR' : i === 2 ? 'extraL' : 'extraR')} position={[x, 0.08, z]}><mesh rotation={[0, x > 0 ? -0.5 : 0.5, 0]}><boxGeometry args={[0.18, 0.04, 0.1]} /><meshStandardMaterial color="#7a9a4a" /></mesh></group>)}
          <mesh position={[0, 0.3, 0]}><sphereGeometry args={[0.07, 8, 6]} /><meshStandardMaterial color={accent} /></mesh>
        </>)}
        {id === 'goat' && (<>
          <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[0.28, 0.3, 0.55]} /><meshStandardMaterial color={fur} /></mesh>
          <group ref={set('head')} position={[0, 0.72, 0.32]}>
            <mesh castShadow><boxGeometry args={[0.18, 0.2, 0.26]} /><meshStandardMaterial color={fur} /></mesh>
            {[-1, 1].map((s) => <mesh key={s} position={[s * 0.06, 0.16, -0.05]} rotation={[-0.4, 0, s * 0.3]}><coneGeometry args={[0.025, 0.14, 6]} /><meshStandardMaterial color="#6b5a46" /></mesh>)}
            <mesh position={[0, -0.14, 0.08]}><coneGeometry args={[0.03, 0.1, 6]} /><meshStandardMaterial color="#d9d2c4" /></mesh>
            {[-1, 1].map((s) => <mesh key={s} position={[s * 0.06, 0.03, 0.13]}><sphereGeometry args={[0.02, 6, 6]} /><meshStandardMaterial color="#111" /></mesh>)}
          </group>
          {[[-0.09, 0.2], [0.09, 0.2], [-0.09, -0.2], [0.09, -0.2]].map(([x, z], i) => <group key={i} ref={set(i === 0 ? 'legL' : i === 1 ? 'legR' : i === 2 ? 'extraL' : 'extraR')} position={[x, 0.36, z]}><mesh position={[0, -0.18, 0]}><cylinderGeometry args={[0.035, 0.03, 0.36, 6]} /><meshStandardMaterial color={fur} /></mesh></group>)}
          <mesh position={[0, 0.62, 0.2]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.12, 0.02, 6, 14]} /><meshStandardMaterial color={accent} /></mesh>
        </>)}
        {id === 'fruitbat' && (<>
          <mesh position={[0, 0.7, 0]} scale={[1, 1.3, 1]} castShadow><sphereGeometry args={[0.14, 12, 10]} /><meshStandardMaterial color={fur} /></mesh>
          <group ref={set('head')} position={[0, 0.95, 0.03]}>
            <mesh castShadow><sphereGeometry args={[0.1, 12, 10]} /><meshStandardMaterial color="#8a5a3a" /></mesh>
            {[-1, 1].map((s) => <mesh key={s} position={[s * 0.06, 0.1, 0]} rotation={[0, 0, s * -0.3]}><coneGeometry args={[0.03, 0.08, 6]} /><meshStandardMaterial color="#8a5a3a" /></mesh>)}
            {[-1, 1].map((s) => <mesh key={s} position={[s * 0.04, 0.02, 0.09]}><sphereGeometry args={[0.018, 6, 6]} /><meshStandardMaterial color="#111" /></mesh>)}
          </group>
          {[-1, 1].map((s) => <group key={s} ref={set(s < 0 ? 'armL' : 'armR')} position={[s * 0.12, 0.78, 0]}><mesh position={[s * 0.22, 0, 0]} rotation={[0, 0, s * 0.2]}><boxGeometry args={[0.44, 0.02, 0.26]} /><meshStandardMaterial color="#3d2b22" side={THREE.DoubleSide} /></mesh></group>)}
          {[-1, 1].map((s) => <group key={s} ref={set(s < 0 ? 'legL' : 'legR')} position={[s * 0.05, 0.55, 0]}><mesh position={[0, -0.08, 0]}><cylinderGeometry args={[0.015, 0.015, 0.16, 5]} /><meshStandardMaterial color="#3d2b22" /></mesh></group>)}
          <mesh position={[0, 0.84, 0.05]}><boxGeometry args={[0.2, 0.05, 0.1]} /><meshStandardMaterial color={accent} /></mesh>
        </>)}
        <group visible={false}><meshStandardMaterial color={animal.accent} /></group>
      </group>
    </group>
  );
}
