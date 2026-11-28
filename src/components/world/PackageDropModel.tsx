import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { dropHeight, type PackageDrop } from '../../game/world/packageDrop';

const WOOD = '#8a5a32';
const STRAP = '#2b2f36';
const CHUTE = ['#ff8a1f', '#f2efe6'];

/**
 * A supply crate under a striped parachute. It drifts down, the chute folds
 * away on landing, and an orange smoke column marks the spot from far away.
 */
export function PackageDropModel({ drop, clockRef, onClick }: { drop: PackageDrop; clockRef: MutableRefObject<number>; onClick: () => void }) {
  const crate = useRef<THREE.Group>(null);
  const chute = useRef<THREE.Group>(null);
  const smoke = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = clockRef.current;
    const y = dropHeight(drop, t);
    const g = crate.current;
    if (g) {
      g.position.y = y;
      const air = t < drop.landsAt;
      g.rotation.z = air ? Math.sin(t * 1.3) * 0.08 : 0;
      g.rotation.x = air ? Math.cos(t * 1.1) * 0.06 : 0;
    }
    const c = chute.current;
    if (c) {
      // folds down over two seconds after landing
      const k = Math.min(1, Math.max(0, (t - drop.landsAt) / 2));
      c.visible = k < 1;
      c.scale.set(1 - k * 0.6, 1 - k * 0.95, 1 - k * 0.6);
    }
    const s = smoke.current;
    if (s) (s.material as THREE.MeshBasicMaterial).opacity = 0.26 + Math.sin(t * 2.4) * 0.05;
  });
  const hit = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onClick();
  };
  return (
    <group position={[drop.x, 0, drop.z]}>
      <group ref={crate}>
        <group onClick={hit}>
          <mesh position-y={0.45} castShadow receiveShadow>
            <boxGeometry args={[1.1, 0.9, 0.8]} />
            <meshStandardMaterial color={WOOD} roughness={0.85} />
          </mesh>
          {/* planks, straps and the gold seal */}
          {[-0.35, 0, 0.35].map((x) => (
            <mesh key={x} position={[x, 0.45, 0.405]}>
              <boxGeometry args={[0.04, 0.9, 0.01]} />
              <meshStandardMaterial color="#6b4428" />
            </mesh>
          ))}
          {[-0.3, 0.3].map((x) => (
            <mesh key={x} position={[x, 0.45, 0]}>
              <boxGeometry args={[0.08, 0.92, 0.82]} />
              <meshStandardMaterial color={STRAP} roughness={0.6} />
            </mesh>
          ))}
          <mesh position={[0, 0.5, 0.42]}>
            <cylinderGeometry args={[0.12, 0.12, 0.02, 20]} />
            <meshStandardMaterial color="#ffc93c" metalness={1} roughness={0.25} emissive="#5a3a00" />
          </mesh>
          {/* bigger invisible click target */}
          <mesh position-y={0.7} visible={false}>
            <boxGeometry args={[2, 1.6, 2]} />
          </mesh>
        </group>
        <group ref={chute} position-y={0.9}>
          {/* cords */}
          {[[-0.5, -0.35], [0.5, -0.35], [-0.5, 0.35], [0.5, 0.35]].map(([x, z]) => {
            const top = new THREE.Vector3(x! * 3.4, 5, z! * 3.4);
            const len = top.length();
            const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().normalize());
            return (
              <mesh key={`${x}${z}`} position={top.clone().multiplyScalar(0.5)} quaternion={q} raycast={() => null}>
                <cylinderGeometry args={[0.012, 0.012, len, 4]} />
                <meshBasicMaterial color="#d8d2c4" />
              </mesh>
            );
          })}
          {/* the canopy: eight coloured gores */}
          {Array.from({ length: 8 }, (_, i) => (
            <mesh key={i} position-y={5} rotation-y={(i * Math.PI) / 4} raycast={() => null}>
              <sphereGeometry args={[2.6, 6, 8, 0, Math.PI / 4, 0, Math.PI / 2.6]} />
              <meshStandardMaterial color={CHUTE[i % 2]} side={THREE.DoubleSide} roughness={0.8} />
            </mesh>
          ))}
        </group>
      </group>
      {/* orange smoke column, visible across town */}
      <mesh ref={smoke} position-y={drop.y + 33} raycast={() => null}>
        <cylinderGeometry args={[1.1, 0.25, 60, 14, 1, true]} />
        <meshBasicMaterial color="#ff7a1a" transparent opacity={0.32} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position-y={drop.y + 0.06} rotation-x={-Math.PI / 2} raycast={() => null}>
        <ringGeometry args={[1.2, 1.6, 32]} />
        <meshBasicMaterial color="#ffb43c" transparent opacity={0.8} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}
