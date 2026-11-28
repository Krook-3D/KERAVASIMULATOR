import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PLATFORM } from '../../game/world/station';
import { Humanoid, type HumanBones, type Outfit } from './humanoid/Humanoid';
import { poseLocomotion, posePhone, resetPose } from './humanoid/animate';

interface PassengerDef {
  x: number;
  z: number;
  yaw: number;
  outfit: Outfit;
}

/** People waiting on the platform. In station-local coordinates. */
const PASSENGERS: PassengerDef[] = [
  { x: -14, z: 6.5, yaw: 0.4, outfit: { top: '#3d6b4f', legs: '#2a2a33', shoes: '#ffffff', hair: '#1e1612', hat: 'beanie', hatColor: '#222', accent: '#e05555', prop: 'phone' } },
  { x: -15.3, z: 7.1, yaw: -0.9, outfit: { top: '#8a5a9e', legs: '#3b4a6b', shoes: '#333', hair: '#b07a3a', hat: 'none', hatColor: '#c94a5a', accent: '#f2e2c4', skin: '#d9a77f', build: 0.92 } },
  { x: 24, z: 5.2, yaw: Math.PI - 0.3, outfit: { top: '#c0392b', legs: '#1f2533', shoes: '#f4f4f0', hat: 'cap', hatColor: '#14171f', accent: '#ffffff', prop: 'phone' } },
  { x: 44, z: 7.5, yaw: -2.2, outfit: { top: '#e7d8b8', legs: '#5a4a3a', shoes: '#4a3020', hair: '#2a1a10', hat: 'beanie', hatColor: '#6f8fa8', accent: '#ffffff', skin: '#8a5a3c', build: 1.12, backpack: true } },
];

function Passenger({ def, seed }: { def: PassengerDef; seed: number }) {
  const bones = useRef<HumanBones | null>(null);
  useFrame(({ clock }) => {
    const b = bones.current;
    if (!b) return;
    const t = clock.elapsedTime + seed * 7;
    resetPose(b);
    poseLocomotion(b, 0, 0, t);
    if (def.outfit.prop === 'phone') posePhone(b, t);
  });
  return (
    <group position={[def.x, PLATFORM.height, def.z]} rotation-y={def.yaw}>
      <Humanoid outfit={def.outfit} bonesRef={bones} />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.45, 16]} />
        <meshBasicMaterial color="#000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function Passengers() {
  return (
    <>
      {PASSENGERS.map((p, i) => (
        <Passenger key={i} def={p} seed={i} />
      ))}
    </>
  );
}
