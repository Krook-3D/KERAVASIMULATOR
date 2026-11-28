import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BusStop } from '../../game/world/transit';
import { Box, TextPanel } from './interiors/kit';

const LEN = 12;
export const BUS_ARRIVE = 5;
export const BUS_LEAVE = 5;
const APPROACH = 70;

/** Bus shelter with a sign and the stop's name. */
export function BusStopModel({ stop, ground }: { stop: BusStop; ground: number }) {
  const yaw = Math.atan2(stop.side[0], stop.side[1]); // local +z points away from the road
  return (
    <group position={[stop.at[0] + stop.side[0] * 1.2, ground, stop.at[1] + stop.side[1] * 1.2]} rotation-y={yaw}>
      {/* shelter: back wall + roof + side panes */}
      <Box p={[0, 1.2, 0.7]} s={[3.6, 2.2, 0.06]} color="#cfe6f2" opacity={0.45} cast={false} />
      <Box p={[0, 2.4, 0.1]} s={[3.9, 0.12, 1.6]} color="#2b3038" />
      {[-1.85, 1.85].map((x) => (
        <group key={x}>
          <Box p={[x, 1.2, 0.7]} s={[0.08, 2.4, 0.08]} color="#2b3038" metal={0.6} />
          <Box p={[x, 1.2, 0.2]} s={[0.04, 2.0, 1.0]} color="#cfe6f2" opacity={0.4} cast={false} />
        </group>
      ))}
      <Box p={[0, 0.48, 0.45]} s={[2.4, 0.07, 0.4]} color="#8a5a32" />
      {/* advert panel */}
      <TextPanel p={[1.1, 1.3, 0.66]} rotY={Math.PI} w={1.2} h={1.7} text={'KERAVAN\nKESÄ-\nKONSERTTI'} bg="#c94a5a" />
      {/* sign pole */}
      <Box p={[-2.3, 1.5, -0.6]} s={[0.08, 3, 0.08]} color="#8a8f96" metal={0.7} />
      <TextPanel p={[-2.3, 2.75, -0.55]} w={0.7} h={0.7} text="🚌" bg="#ffd23f" fg="#14171f" />
      <TextPanel p={[-2.3, 2.75, -0.65]} rotY={Math.PI} w={0.7} h={0.7} text="🚌" bg="#ffd23f" fg="#14171f" />
      <TextPanel p={[0, 2.62, -0.71]} rotY={Math.PI} w={3.4} h={0.32} text={stop.name.toUpperCase()} bg="#1f3f8f" />
    </group>
  );
}

function BusBody({ dest }: { dest: string }) {
  const wheels = useMemo(() => [-3.8, 3.8].flatMap((z) => [-1.22, 1.22].map((x) => [x, z] as const)), []);
  return (
    <group>
      <Box p={[0, 1.65, 0]} s={[2.55, 2.5, LEN]} color="#2f8fbf" rough={0.45} metal={0.2} />
      <Box p={[0, 2.98, 0]} s={[2.4, 0.16, LEN - 0.6]} color="#f2f2f2" />
      <Box p={[0, 0.55, 0]} s={[2.6, 0.35, LEN + 0.05]} color="#1c2a36" />
      {/* windows */}
      {[-1.285, 1.285].map((x) => (
        <Box key={x} p={[x, 2.1, -0.3]} s={[0.03, 1.05, LEN - 2.2]} color="#1d2c3a" rough={0.1} metal={0.6} cast={false} />
      ))}
      <Box p={[0, 1.95, LEN / 2 + 0.01]} s={[2.3, 1.5, 0.04]} color="#1d2c3a" rough={0.1} metal={0.6} cast={false} />
      <Box p={[0, 2.15, -LEN / 2 - 0.01]} s={[2.1, 0.9, 0.04]} color="#1d2c3a" rough={0.1} metal={0.6} cast={false} />
      {/* door (right side, front) */}
      <Box p={[1.29, 1.45, 4.3]} s={[0.04, 2.1, 1.3]} color="#253645" metal={0.4} cast={false} />
      {/* destination display */}
      <TextPanel p={[0, 2.78, LEN / 2 + 0.035]} w={2.1} h={0.32} text={dest} bg="#0d1118" fg="#ffb43c" glow font="700 44px 'Courier New', monospace" />
      {/* lights */}
      {[-0.95, 0.95].map((x) => (
        <Box key={x} p={[x, 0.85, LEN / 2 + 0.02]} s={[0.35, 0.18, 0.04]} color="#fff6dc" emissive="#fff3d0" cast={false} />
      ))}
      {wheels.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.5, z]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.5, 0.5, 0.32, 16]} />
          <meshStandardMaterial color="#16181c" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export interface BusRun {
  stop: BusStop;
  /** 'in': drives in and stops; 'wait': stands at the stop; 'out': drives away. */
  mode: 'in' | 'wait' | 'out';
  t0: number;
  dest: string;
}

/** The bus pulling in to (or away from) a stop, eased along the road. */
export function BusVehicle({ run, clockRef, groundAt }: { run: BusRun; clockRef: MutableRefObject<number>; groundAt: (x: number, z: number) => number }) {
  const g = useRef<THREE.Group>(null);
  const { stop } = run;
  const yaw = Math.atan2(stop.dir[0], stop.dir[1]);
  useFrame(() => {
    const m = g.current;
    if (!m) return;
    const t = clockRef.current - run.t0;
    let off = 0;
    if (run.mode === 'in') {
      const k = Math.min(1, t / BUS_ARRIVE);
      off = -APPROACH * (1 - k) * (1 - k); // decelerating
    } else if (run.mode === 'out') {
      const k = Math.min(1, t / BUS_LEAVE);
      off = APPROACH * 1.5 * k * k; // accelerating
    }
    const x = stop.road[0] + stop.dir[0] * (off - 2), z = stop.road[1] + stop.dir[1] * (off - 2);
    m.position.set(x, groundAt(x, z), z);
    m.visible = !(run.mode === 'out' && t > BUS_LEAVE);
  });
  return (
    <group ref={g} rotation-y={yaw}>
      <BusBody dest={run.dest} />
    </group>
  );
}
