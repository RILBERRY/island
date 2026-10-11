import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore, localPos } from '../store';
import { input } from '../input';

const NIGHT_SKY = new THREE.Color('#0b1b36');
const GOLDEN_SKY = new THREE.Color('#ffb36b');
const DAY_SKY = new THREE.Color('#8fd1ff');
const tmp = new THREE.Color();

export function Lighting() {
  const sun = useRef<THREE.DirectionalLight>(null);
  const moon = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const target = useRef<THREE.Object3D>(new THREE.Object3D());
  const { scene, gl } = useThree();
  const quality = useStore((s) => s.settings.quality);
  const lastBounds = useRef(0);

  useFrame(() => {
    const d = useStore.getState().daylight;
    const dist = input.orbit.distance;
    tmp.copy(NIGHT_SKY).lerp(DAY_SKY, d.daylight);
    tmp.lerp(GOLDEN_SKY, d.golden * 0.75);
    if (!(scene.background instanceof THREE.Color)) scene.background = new THREE.Color();
    (scene.background as THREE.Color).copy(tmp);
    if (!scene.fog) scene.fog = new THREE.Fog(tmp.clone(), 400, 2600);
    const fog = scene.fog as THREE.Fog;
    fog.color.copy(tmp);
    fog.near = 700 + dist * 2; fog.far = 6000 + dist * 6;
    gl.toneMappingExposure = 0.9 + d.daylight * 0.3;
    if (sun.current) {
      const s = sun.current;
      const dir = new THREE.Vector3(d.sun.x, Math.max(0.05, d.sun.y), d.sun.z).normalize();
      const reach = Math.min(1100, Math.max(120, dist * 1.35));
      s.position.set(localPos.x + dir.x * (reach + 260), dir.y * (reach + 260), localPos.z + dir.z * (reach + 260));
      target.current.position.set(localPos.x, 0, localPos.z);
      s.target = target.current; s.target.updateMatrixWorld();
      s.intensity = d.daylight * 2.4;
      s.color.set('#fff6e0').lerp(new THREE.Color('#ff9a4a'), d.golden);
      if (Math.abs(reach - lastBounds.current) > 10) {
        lastBounds.current = reach;
        const c = s.shadow.camera; c.left = -reach; c.right = reach; c.top = reach; c.bottom = -reach; c.near = 10; c.far = reach * 2 + 900; c.updateProjectionMatrix();
        s.shadow.bias = -0.0004 - reach * 0.0000012;
      }
    }
    if (moon.current) {
      moon.current.position.set(localPos.x - 120, 200, localPos.z + 80);
      moon.current.intensity = d.night * 0.6;
      moon.current.target = target.current;
    }
    if (hemi.current) {
      hemi.current.intensity = 0.4 + d.daylight * 0.9;
      hemi.current.color.copy(tmp).lerp(new THREE.Color('#ffffff'), 0.4);
      hemi.current.groundColor.set(d.night > 0.5 ? '#1a2630' : '#c9b893');
    }
  });

  const mapSize = quality === 'high' ? 4096 : 2048;
  return (
    <group>
      <hemisphereLight ref={hemi} args={['#bfe3ff', '#c9b893', 1]} />
      <directionalLight ref={sun} castShadow={quality !== 'low'} shadow-mapSize={[mapSize, mapSize]} shadow-camera-left={-120} shadow-camera-right={120} shadow-camera-top={120} shadow-camera-bottom={-120} shadow-camera-near={10} shadow-camera-far={900} shadow-bias={-0.0005} shadow-normalBias={0.04} shadow-radius={3} />
      <directionalLight ref={moon} color="#8fb7ff" intensity={0} />
      <ambientLight intensity={0.2} />
    </group>
  );
}
