import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { WorldXZ } from '../../../game/world/projection';
import { Humanoid, type HumanBones } from '../humanoid/Humanoid';
import { poseLocomotion, resetPose } from '../humanoid/animate';
import { Hotspot } from '../interiors/kit';

/** Jonne: hangs around the tunnel entrance with a suspicious bag. Quest giver. */
export function Jonne({ at, y, yaw, onClick, showMarker }: { at: WorldXZ; y: number; yaw: number; onClick: () => void; showMarker: boolean }) {
  const bones = useRef<HumanBones | null>(null);
  useFrame(({ clock }) => {
    const b = bones.current;
    if (!b) return;
    const t = clock.elapsedTime;
    resetPose(b);
    poseLocomotion(b, 0, 0, t);
    // restless: shifting weight, looking around
    b.head.rotation.y = Math.sin(t * 1.3) * 0.7;
    b.hips.position.y += Math.abs(Math.sin(t * 2.2)) * 0.015;
    b.upperArmR.rotation.set(-0.15, 0, -0.1);
    b.forearmR.rotation.x = -0.4;
  });
  return (
    <group>
      <group position={[at[0], y, at[1]]} rotation-y={yaw} onClick={(e) => (e.stopPropagation(), onClick())}>
        <Humanoid
          bonesRef={bones}
          outfit={{ top: '#1e1e24', legs: '#3b3f4a', shoes: '#f4f4f0', hair: '#d8b070', hat: 'cap', hatColor: '#c0392b', accent: '#ffffff', build: 0.95 }}
        />
        {/* the bag */}
        <mesh position={[-0.3, 0.75, 0.05]} castShadow>
          <boxGeometry args={[0.22, 0.28, 0.14]} />
          <meshStandardMaterial color="#e9e4d6" roughness={0.9} />
        </mesh>
      </group>
      {showMarker && <Hotspot at={at} y={y} label="❗ Jonne" onClick={onClick} />}
    </group>
  );
}
