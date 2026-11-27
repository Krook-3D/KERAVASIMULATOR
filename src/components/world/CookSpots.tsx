import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CookSpot } from '../../game/world/grills';
import { Box } from './interiors/kit';

function Flames({ y = 0.6, big = false }: { y?: number; big?: boolean }) {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  const l = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (a.current) a.current.scale.set(1, 1 + Math.sin(t * 9) * 0.18, 1);
    if (b.current) b.current.scale.set(1, 1 + Math.sin(t * 11 + 1) * 0.22, 1);
    if (l.current) l.current.intensity = (big ? 14 : 8) + Math.sin(t * 13) * 2;
  });
  const s = big ? 1.4 : 1;
  return (
    <group position-y={y} raycast={() => null}>
      <mesh ref={a} position-y={0.22 * s}>
        <coneGeometry args={[0.22 * s, 0.6 * s, 7]} />
        <meshBasicMaterial color="#ff8a2a" toneMapped={false} transparent opacity={0.9} />
      </mesh>
      <mesh ref={b} position-y={0.16 * s}>
        <coneGeometry args={[0.13 * s, 0.42 * s, 6]} />
        <meshBasicMaterial color="#ffe08a" toneMapped={false} />
      </mesh>
      <pointLight ref={l} position-y={0.6} distance={big ? 14 : 9} color="#ff9a4a" />
    </group>
  );
}

/** Grill shelters and campfires. */
export function CookSpots({ spots, groundAt }: { spots: CookSpot[]; groundAt: (x: number, z: number) => number }) {
  return (
    <group>
      {spots.map((s) => (
        <group key={s.id} position={[s.at[0], groundAt(s.at[0], s.at[1]), s.at[1]]}>
          {s.kind === 'grill' ? (
            <group position={[0, 0, -1.6]}>
              {/* kota-style shelter: posts + pitched roof, grill in the middle */}
              {[-1.6, 1.6].flatMap((x) => [-1.4, 1.4].map((z) => <Box key={`${x}${z}`} p={[x, 1.2, z]} s={[0.18, 2.4, 0.18]} color="#6b4a2b" />))}
              <Box p={[-0.95, 2.75, 0]} s={[2.1, 0.12, 3.4]} color="#3a2a1e" rotY={0} />
              <group position={[0, 2.85, 0]}>
                <mesh rotation-z={0.5} position-x={-0.9}>
                  <boxGeometry args={[2.1, 0.1, 3.4]} />
                  <meshStandardMaterial color="#4a3426" roughness={0.9} />
                </mesh>
                <mesh rotation-z={-0.5} position-x={0.9}>
                  <boxGeometry args={[2.1, 0.1, 3.4]} />
                  <meshStandardMaterial color="#4a3426" roughness={0.9} />
                </mesh>
              </group>
              <Box p={[0, 0.45, 0]} s={[1.0, 0.9, 0.7]} color="#2a2d33" metal={0.6} rough={0.5} />
              <Box p={[0, 0.92, 0]} s={[0.9, 0.04, 0.6]} color="#8a8f96" metal={0.9} rough={0.3} />
              <Flames y={0.8} />
              {[-1.1, 1.1].map((z) => (
                <Box key={z} p={[0, 0.42, z + (z > 0 ? 0.2 : -0.2)]} s={[2.4, 0.08, 0.4]} color="#8a5a32" />
              ))}
            </group>
          ) : (
            <group position={[0, 0, -1.4]}>
              {Array.from({ length: 9 }, (_, i) => {
                const a = (i / 9) * Math.PI * 2;
                return <Box key={i} p={[Math.sin(a) * 0.65, 0.1, Math.cos(a) * 0.65]} s={[0.3, 0.2, 0.25]} color="#7a7f86" rotY={a} />;
              })}
              {[0, 1.1, 2.2].map((r) => (
                <mesh key={r} position-y={0.12} rotation={[0, r, Math.PI / 2]}>
                  <cylinderGeometry args={[0.06, 0.06, 0.9, 6]} />
                  <meshStandardMaterial color="#3a2a1e" />
                </mesh>
              ))}
              <Flames y={0.05} big />
              {[[-1.7, 0], [1.7, 0.4]].map(([x, r]) => (
                <mesh key={x} position={[x!, 0.25, 0]} rotation={[Math.PI / 2, 0, r!]}>
                  <cylinderGeometry args={[0.2, 0.2, 1.8, 8]} />
                  <meshStandardMaterial color="#6b4a2b" roughness={0.9} />
                </mesh>
              ))}
            </group>
          )}
        </group>
      ))}
    </group>
  );
}
