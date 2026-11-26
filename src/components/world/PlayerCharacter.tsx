import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WorldXZ } from '../../game/world/projection';
import { ARRIVE_EPSILON, WALK_SPEED } from '../../game/world/movement';
import type { BuildingCollider } from '../../game/world/collision';
import { HumanModel, type Outfit } from './HumanModel';

/** Scripted control used by cutscenes: when active, normal movement is paused. */
export interface ScriptedPose {
  active: boolean;
  /** Body tilt around local x (radians), e.g. tumbling when thrown. */
  tilt: number;
  yaw: number;
  /** Arms raised 0–1 (flailing). */
  flail: number;
}

interface PlayerCharacterProps {
  color: string;
  /** Shared live position; the camera rig reads it every frame. */
  positionRef: MutableRefObject<THREE.Vector3>;
  target: WorldXZ | null;
  collider: BuildingCollider | null;
  onArrive: (point: WorldXZ) => void;
  groundHeight: (p: WorldXZ) => number;
  visible: boolean;
  scriptRef: MutableRefObject<ScriptedPose>;
}


/** Low-poly original character built from primitives. */
export function PlayerCharacter({ color, positionRef, target, collider, onArrive, groundHeight, visible, scriptRef }: PlayerCharacterProps) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
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
    const script = scriptRef.current;

    if (script.active) {
      g.position.copy(pos);
      g.rotation.y = script.yaw;
      if (body.current) body.current.rotation.x = script.tilt;
      const f = script.flail;
      const t = performance.now() / 90;
      if (armL.current) armL.current.rotation.set(-2.6 * f + Math.sin(t) * 0.4 * f, 0, -0.4 * f);
      if (armR.current) armR.current.rotation.set(-2.6 * f + Math.cos(t) * 0.4 * f, 0, 0.4 * f);
      if (legL.current) legL.current.rotation.x = Math.sin(t) * 0.6 * f;
      if (legR.current) legR.current.rotation.x = -Math.sin(t) * 0.6 * f;
      return;
    }
    if (body.current) body.current.rotation.x = 0;
    if (armL.current) armL.current.rotation.z = 0;
    if (armR.current) armR.current.rotation.z = 0;

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

    pos.y = THREE.MathUtils.lerp(pos.y, groundHeight([pos.x, pos.z]), Math.min(1, dt * 14));
    g.position.copy(pos);
    walkPhase.current = moving ? walkPhase.current + dt * 10 : walkPhase.current * 0.85;
    const swing = Math.sin(walkPhase.current) * (moving ? 0.7 : 0);
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.8;
    if (armR.current) armR.current.rotation.x = swing * 0.8;
    if (body.current) body.current.position.y = moving ? Math.abs(Math.sin(walkPhase.current)) * 0.07 : 0;
    if (head.current) head.current.rotation.z = moving ? Math.sin(walkPhase.current) * 0.04 : 0;
  });

  const outfit: Outfit = {
    top: color,
    legs: '#2e3b55',
    shoes: '#f4f4f0',
    hat: 'beanie',
    hatColor: '#3a7bd5',
    accent: '#ffd23f',
    backpack: true,
  };

  return (
    <group ref={root} visible={visible}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.6, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <group ref={body}>
        <HumanModel outfit={outfit} rig={{ legL, legR, armL, armR, head }} />
      </group>
    </group>
  );
}
