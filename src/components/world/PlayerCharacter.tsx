import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WorldXZ } from '../../game/world/projection';
import { ARRIVE_EPSILON, WALK_SPEED } from '../../game/world/movement';
import { Humanoid, type HumanBones, type Outfit } from './humanoid/Humanoid';
import { poseFlail, poseLocomotion, resetPose } from './humanoid/animate';

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
  collider: { isBlocked(p: WorldXZ, radius?: number): boolean } | null;
  onArrive: (point: WorldXZ) => void;
  groundHeight: (p: WorldXZ) => number;
  /** Extra no-go areas on top of building walls (e.g. the track bed). */
  extraBlocked?: (p: WorldXZ, from: WorldXZ) => boolean;
  visible: boolean;
  scriptRef: MutableRefObject<ScriptedPose>;
}


/** The player: skinned humanoid with click-to-move, wall sliding and procedural run/idle animation. */
export function PlayerCharacter({ color, positionRef, target, collider, onArrive, groundHeight, extraBlocked, visible, scriptRef }: PlayerCharacterProps) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const bones = useRef<HumanBones | null>(null);
  const run = useRef(0);
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
      const bn = bones.current;
      if (bn) {
        resetPose(bn);
        poseLocomotion(bn, 0, 0, performance.now() / 1000);
        if (script.flail > 0.01) poseFlail(bn, script.flail, performance.now() / 1000);
      }
      return;
    }
    if (body.current) body.current.rotation.x = 0;

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
        const blocked = (x: number, z: number) => !!collider?.isBlocked([x, z]) || !!extraBlocked?.([x, z], [pos.x, pos.z]);
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
    run.current = THREE.MathUtils.lerp(run.current, moving ? 1 : 0, Math.min(1, dt * (moving ? 10 : 7)));
    walkPhase.current += dt * 11 * run.current;
    if (bones.current) poseLocomotion(bones.current, walkPhase.current, run.current, performance.now() / 1000);
  });

  const outfit = playerOutfit(color);

  return (
    <group ref={root} visible={visible}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}>
        <circleGeometry args={[0.6, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <group ref={body}>
        <Humanoid outfit={outfit} bonesRef={bones} />
      </group>
    </group>
  );
}

/** The player's look (the character editor will extend this). */
export function playerOutfit(color: string): Outfit {
  return {
    top: color,
    legs: '#2e3b55',
    shoes: '#f4f4f0',
    hair: '#4a3222',
    hat: 'beanie',
    hatColor: '#3a7bd5',
    accent: '#ffd23f',
    backpack: true,
  };
}
