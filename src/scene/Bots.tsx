import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, localPos } from '../store';
import { generateBots, botPose, type Bot } from '../world/roadGraph';
import { Character } from './Character';
import { Bicycle, Car, Bus } from './Vehicles';
import { LAND_Y, labelPortal } from './constants';

export function Bots() {
  const world = useStore((s) => s.world);
  const bots = useMemo(() => (world ? generateBots(world) : []), [world]);
  return <>{bots.map((b) => <BotActor key={b.id} bot={b} />)}</>;
}

function BotActor({ bot }: { bot: Bot }) {
  const g = useRef<THREE.Group>(null);
  const [near, setNear] = useState(false);
  useFrame(() => {
    const m = g.current; if (!m) return;
    const t = (Date.now() + useStore.getState().serverOffset) / 1000;
    const p = botPose(bot, t);
    m.position.set(p.x, LAND_Y, p.z);
    m.rotation.y = Math.atan2(p.dx, p.dz);
    const n = Math.hypot(p.x - localPos.x, p.z - localPos.z) < 18;
    if (n !== near) setNear(n);
  });
  const label = bot.kind === 'bus' ? '🚌 Kalaidhoo bus' : bot.kind === 'car' ? `🚗 ${bot.name}` : bot.kind === 'cyclist' ? `🚲 ${bot.name}` : `🚶 ${bot.name}`;
  return (
    <group ref={g}>
      {bot.kind === 'walker' && <Character character={bot.character} anim="walk" />}
      {bot.kind === 'cyclist' && <Bicycle color={bot.color} moving><Character character={bot.character} anim="ride" /></Bicycle>}
      {bot.kind === 'car' && <Car color={bot.color} moving />}
      {bot.kind === 'bus' && <Bus moving />}
      {near && (
        <Html portal={labelPortal} position={[0, bot.kind === 'bus' ? 3.6 : bot.kind === 'car' ? 2.1 : 2.3, 0]} center distanceFactor={14} zIndexRange={[38, 0]} style={{ pointerEvents: 'none' }}>
          <div className="player-indicator bot-tag">{label}<small>Islander · bot</small></div>
        </Html>
      )}
    </group>
  );
}
