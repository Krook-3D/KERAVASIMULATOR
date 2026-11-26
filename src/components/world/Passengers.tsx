import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { PLATFORM } from '../../game/world/station';
import { HumanModel, type Outfit } from './HumanModel';

interface PassengerDef {
  x: number;
  z: number;
  yaw: number;
  outfit: Outfit;
  phone?: boolean;
}

/** People waiting on the platform. In station-local coordinates. */
const PASSENGERS: PassengerDef[] = [
  { x: -14, z: 6.5, yaw: 0.4, phone: true, outfit: { top: '#3d6b4f', legs: '#2a2a33', shoes: '#ffffff', hat: 'beanie', hatColor: '#222', accent: '#e05555' } },
  { x: -15.3, z: 7.1, yaw: -0.9, outfit: { top: '#8a5a9e', legs: '#3b4a6b', shoes: '#333', hat: 'beanie', hatColor: '#c94a5a', accent: '#f2e2c4', skin: '#d9a77f' } },
  { x: 24, z: 5.2, yaw: Math.PI - 0.3, phone: true, outfit: { top: '#c0392b', legs: '#1f2533', shoes: '#f4f4f0', hat: 'cap', hatColor: '#14171f', accent: '#ffffff' } },
  { x: 44, z: 7.5, yaw: -2.2, outfit: { top: '#e7d8b8', legs: '#5a4a3a', shoes: '#4a3020', hat: 'beanie', hatColor: '#6f8fa8', accent: '#ffffff', skin: '#b98060' } },
];

function Passenger({ def, seed }: { def: PassengerDef; seed: number }) {
  const rig = {
    legL: useRef<THREE.Group>(null),
    legR: useRef<THREE.Group>(null),
    armL: useRef<THREE.Group>(null),
    armR: useRef<THREE.Group>(null),
    head: useRef<THREE.Group>(null),
  };
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime + seed * 7;
    if (body.current) body.current.position.y = Math.sin(t * 1.8) * 0.01;
    if (rig.head.current) {
      rig.head.current.rotation.y = def.phone ? 0 : Math.sin(t * 0.4) * 0.5;
      rig.head.current.rotation.x = def.phone ? 0.35 : 0;
    }
    if (def.phone && rig.armR.current) rig.armR.current.rotation.set(-1.25, 0, 0.35);
    if (def.phone && rig.armL.current) rig.armL.current.rotation.set(-0.9, 0, -0.2);
  });
  return (
    <group position={[def.x, PLATFORM.height, def.z]} rotation-y={def.yaw}>
      <group ref={body}>
        <HumanModel outfit={def.outfit} rig={rig} />
        {def.phone && (
          <mesh position={[0.06, 1.12, 0.48]} rotation-x={-0.6}>
            <boxGeometry args={[0.09, 0.16, 0.015]} />
            <meshStandardMaterial color="#111" emissive="#4a7bd0" emissiveIntensity={0.4} />
          </mesh>
        )}
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.5, 16]} />
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
