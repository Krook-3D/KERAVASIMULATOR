import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { WorldXZ } from '../../game/world/projection';

/** Pulsing ring on the ground where the player is walking to. */
export function ClickMarker({ point, y = 0 }: { point: WorldXZ; y?: number }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const r = ring.current;
    if (!r) return;
    const t = (clock.elapsedTime * 1.6) % 1;
    r.scale.setScalar(0.6 + t * 0.8);
    (r.material as THREE.MeshBasicMaterial).opacity = 1 - t;
  });
  return (
    <mesh ref={ring} position={[point[0], y + 0.12, point[1]]} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.5, 0.75, 24]} />
      <meshBasicMaterial color="#ffd23f" transparent depthWrite={false} />
    </mesh>
  );
}
