import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BARBER_ROOM, INTERIORS } from '../../../game/interiors/interiors';
import { Humanoid, type HumanBones } from '../humanoid/Humanoid';
import { poseLocomotion, resetPose } from '../humanoid/animate';
import { Box, Cutaway, TextPanel, WallFromRect, useTileTexture } from './kit';

const WALL_H = 3.2;

function Chair({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <Box p={[0, 0.25, 0]} s={[0.16, 0.5, 0.16]} color="#c9ccd2" metal={0.9} rough={0.2} />
      <Box p={[0, 0.03, 0]} s={[0.6, 0.06, 0.6]} color="#c9ccd2" metal={0.9} rough={0.2} />
      <Box p={[0, 0.55, 0]} s={[0.62, 0.14, 0.6]} color="#7a1f2a" rough={0.4} />
      <Box p={[0, 0.95, -0.27]} s={[0.6, 0.75, 0.1]} color="#7a1f2a" rough={0.4} />
      {[-0.32, 0.32].map((dx) => (
        <Box key={dx} p={[dx, 0.75, 0.02]} s={[0.07, 0.07, 0.5]} color="#14171f" />
      ))}
    </group>
  );
}

function Barber() {
  const bones = useRef<HumanBones | null>(null);
  useFrame(({ clock }) => {
    const b = bones.current;
    if (!b) return;
    resetPose(b);
    poseLocomotion(b, 0, 0, clock.elapsedTime);
    const t = clock.elapsedTime;
    b.upperArmR.rotation.set(-1.0, 0.2, -0.2);
    b.forearmR.rotation.x = -0.9 + Math.sin(t * 8) * 0.12; // snip snip
    b.upperArmL.rotation.set(-0.8, -0.2, 0.2);
    b.forearmL.rotation.x = -1.1;
    b.head.rotation.x = 0.25;
  });
  return (
    <group position={[2.2, 0, -2.1]} rotation-y={-Math.PI / 2 - 0.3}>
      <Humanoid bonesRef={bones} outfit={{ top: '#14171f', legs: '#14171f', shoes: '#222', hair: '#1a1410', hairStyle: 'sidepart', facialHair: 'moustache', hat: 'none', hatColor: '#000', accent: '#c8c0aa', style: 'jacket' }} />
    </group>
  );
}

export function BarberInterior() {
  const floor = useTileTexture('#f2f2ee', '#14171f', 8, [3, 2.5], '#00000022', true);
  const def = INTERIORS.barber;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.004} receiveShadow>
        <planeGeometry args={[BARBER_ROOM.maxX - BARBER_ROOM.minX, BARBER_ROOM.maxZ - BARBER_ROOM.minZ]} />
        <meshStandardMaterial map={floor} roughness={0.5} />
      </mesh>
      {def.solids.slice(0, 5).map((r, i) => (
        <WallFromRect key={i} r={r} h={WALL_H} color={i === 0 ? '#e8d9c4' : '#d9c3a5'} room={[0, 0]} />
      ))}
      <Cutaway axis="z" at={-5} outward={-1}>
        <Box p={[0, 1.7, -4.97]} s={[9, 1.3, 0.03]} color="#d8ecf6" metal={0.95} rough={0.04} cast={false} />
        <TextPanel p={[0, 2.75, -4.95]} w={6} h={0.55} text="PARTURI-KAMPAAMO SAKSET" bg="#14171f" fg="#e8c070" />
      </Cutaway>
      <Box p={[0, 0.45, -4.7]} s={[11, 0.9, 0.6]} color="#5a3a22" />
      {[-3, -1.5, 0, 1.5, 3].map((x, i) => (
        <Box key={x} p={[x, 1.0, -4.7]} s={[0.12, 0.2 + (i % 3) * 0.08, 0.12]} color={['#3a7bd5', '#e05555', '#2e9e5b', '#ffd23f', '#f2f2ee'][i]!} />
      ))}
      <Chair x={-1.5} z={-2.8} />
      <Chair x={1.5} z={-2.8} />
      <Barber />
      {/* waiting bench + magazines */}
      <Box p={[-5.3, 0.45, 3]} s={[0.9, 0.1, 3.8]} color="#8a5a32" />
      <Box p={[-5.3, 0.22, 3]} s={[0.8, 0.44, 0.1]} color="#3a2a1e" />
      <Box p={[-4.4, 0.5, 0.2]} s={[0.6, 0.06, 0.4]} color="#e05555" />
      {/* till */}
      <Box p={[5.1, 0.55, 1.5]} s={[1.6, 1.1, 2]} color="#5a3a22" />
      <TextPanel p={[4.28, 1.6, 1.5]} rotY={-Math.PI / 2} w={1.8} h={1.0} text={'HIUSTENLEIKKUU\n15 €\nPARRAN SIISTI\n15 €'} bg="#14171f" fg="#e8c070" />
      {/* barber pole by the door */}
      <group position={[2.0, 0, 4.7]}>
        <mesh position-y={1.4}>
          <cylinderGeometry args={[0.1, 0.1, 1.2, 16]} />
          <meshStandardMaterial color="#f2f2ee" emissive="#c94a5a" emissiveIntensity={0.25} />
        </mesh>
      </group>
    </group>
  );
}
