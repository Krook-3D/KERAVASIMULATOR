import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WorldXZ } from '../../game/world/projection';
import { ARRIVE_EPSILON, WALK_SPEED } from '../../game/world/movement';
import type { BuildingCollider } from '../../game/world/collision';

interface PlayerCharacterProps {
  color: string;
  /** Shared live position; the camera rig reads it every frame. */
  positionRef: MutableRefObject<THREE.Vector3>;
  target: WorldXZ | null;
  collider: BuildingCollider | null;
  onArrive: (point: WorldXZ) => void;
}

const SKIN = '#f3c9a0';
const DARK = '#2b3245';

/** Low-poly original character built from primitives. */
export function PlayerCharacter({ color, positionRef, target, collider, onArrive }: PlayerCharacterProps) {
  const root = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const walkPhase = useRef(0);
  const arrivedFor = useRef<WorldXZ | null>(null);

  useFrame((_, dt) => {
    const g = root.current;
    if (!g) return;
    const pos = positionRef.current;
    let moving = false;

    if (target && arrivedFor.current !== target) {
      const dx = target[0] - pos.x;
      const dz = target[1] - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= ARRIVE_EPSILON) {
        arrivedFor.current = target;
        onArrive(target);
      } else {
        const step = Math.min(dist, WALK_SPEED * dt);
        const sx = (dx / dist) * step;
        const sz = (dz / dist) * step;
        const blocked = (x: number, z: number) => !!collider?.isBlocked([x, z]);
        if (!blocked(pos.x + sx, pos.z + sz)) {
          pos.x += sx;
          pos.z += sz;
        } else if (Math.abs(sx) > 1e-4 && !blocked(pos.x + sx, pos.z)) {
          pos.x += sx; // slide along a wall
        } else if (Math.abs(sz) > 1e-4 && !blocked(pos.x, pos.z + sz)) {
          pos.z += sz;
        } else {
          // Fully blocked: stop where we are.
          arrivedFor.current = target;
          onArrive([pos.x, pos.z]);
          return;
        }
        // Face the walking direction, turning smoothly.
        const want = Math.atan2(dx, dz);
        let diff = want - g.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        g.rotation.y += diff * Math.min(1, dt * 12);
        moving = true;
      }
    }

    g.position.copy(pos);
    walkPhase.current = moving ? walkPhase.current + dt * 10 : walkPhase.current * 0.85;
    const swing = Math.sin(walkPhase.current) * (moving ? 0.7 : 0);
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.8;
    if (armR.current) armR.current.rotation.x = swing * 0.8;
    g.position.y = moving ? Math.abs(Math.sin(walkPhase.current)) * 0.06 : 0;
  });

  return (
    <group ref={root}>
      {/* legs, pivoting at the hip */}
      <group ref={legL} position={[-0.17, 0.85, 0]}>
        <mesh position={[0, -0.42, 0]} castShadow>
          <boxGeometry args={[0.24, 0.85, 0.26]} />
          <meshStandardMaterial color={DARK} flatShading />
        </mesh>
      </group>
      <group ref={legR} position={[0.17, 0.85, 0]}>
        <mesh position={[0, -0.42, 0]} castShadow>
          <boxGeometry args={[0.24, 0.85, 0.26]} />
          <meshStandardMaterial color={DARK} flatShading />
        </mesh>
      </group>
      {/* torso (hoodie in the player's colour) */}
      <mesh position={[0, 1.22, 0]} castShadow>
        <boxGeometry args={[0.62, 0.78, 0.36]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      {/* arms, pivoting at the shoulder */}
      <group ref={armL} position={[-0.42, 1.55, 0]}>
        <mesh position={[0, -0.34, 0]} castShadow>
          <boxGeometry args={[0.18, 0.7, 0.2]} />
          <meshStandardMaterial color={color} flatShading />
        </mesh>
      </group>
      <group ref={armR} position={[0.42, 1.55, 0]}>
        <mesh position={[0, -0.34, 0]} castShadow>
          <boxGeometry args={[0.18, 0.7, 0.2]} />
          <meshStandardMaterial color={color} flatShading />
        </mesh>
      </group>
      {/* head + beanie */}
      <mesh position={[0, 1.88, 0]} castShadow>
        <icosahedronGeometry args={[0.27, 0]} />
        <meshStandardMaterial color={SKIN} flatShading />
      </mesh>
      <mesh position={[0, 2.05, 0]} castShadow>
        <coneGeometry args={[0.26, 0.28, 6]} />
        <meshStandardMaterial color="#3a7bd5" flatShading />
      </mesh>
      {/* eyes on the +z (forward) side */}
      <mesh position={[-0.09, 1.9, 0.24]}>
        <boxGeometry args={[0.05, 0.05, 0.02]} />
        <meshBasicMaterial color="#14171f" />
      </mesh>
      <mesh position={[0.09, 1.9, 0.24]}>
        <boxGeometry args={[0.05, 0.05, 0.02]} />
        <meshBasicMaterial color="#14171f" />
      </mesh>
    </group>
  );
}
