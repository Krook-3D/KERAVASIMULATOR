import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WorldXZ } from '../../game/world/projection';
import { ARRIVE_EPSILON, WALK_SPEED } from '../../game/world/movement';

import { Humanoid, type HumanBones, type Outfit } from './humanoid/Humanoid';
import { poseFlail, poseLocomotion, resetPose } from './humanoid/animate';
import { defaultAppearance, type Appearance } from '../../game/player/appearance';
import { ITEMS } from '../../data/items';
import { buildItemModel, disposeItemModel } from './items/itemModels';
import { moveDir, type ControlState } from './controls';

/** Longest single move between collision checks, in metres (thinnest wall + padding is 0.84 m). */
const MAX_SUBSTEP = 0.2;

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
  appearance?: Appearance;
  /** Body fat / muscle 0–1. */
  shape?: { fat: number; muscle: number };
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
  /** Item ids held in the left / right hand (a 2-handed item sits in both). */
  held?: { handL?: string; handR?: string };
  /** Arrow keys / WASD steer the player relative to the camera. */
  controlRef?: MutableRefObject<ControlState>;
  /** Keyboard steering is allowed (no dialogue, cutscene, training…). */
  canSteer?: boolean;
  /** Keyboard steering started: drop any click-to-walk route. */
  onSteerStart?: () => void;
  /** Keyboard steering ended at this point. */
  onSteerEnd?: (point: WorldXZ) => void;
}


/** The player: skinned humanoid with click-to-move, wall sliding and procedural run/idle animation. */
export function PlayerCharacter({ color, appearance, shape, positionRef, target, collider, onArrive, groundHeight, extraBlocked, visible, scriptRef, held, controlRef, canSteer, onSteerStart, onSteerEnd }: PlayerCharacterProps) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const bones = useRef<HumanBones | null>(null);
  const run = useRef(0);
  const walkPhase = useRef(0);
  const arrivedFor = useRef<WorldXZ | null>(null);
  const steering = useRef(false);

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

    const blocked = (x: number, z: number) => !!collider?.isBlocked([x, z]) || !!extraBlocked?.([x, z], [pos.x, pos.z]);
    const [kx, kz] = canSteer && controlRef ? moveDir(controlRef.current) : [0, 0];
    if (kx || kz) {
      if (!steering.current) {
        steering.current = true;
        onSteerStart?.();
      }
      const step = WALK_SPEED * dt;
      const subs = Math.max(1, Math.ceil(step / MAX_SUBSTEP));
      const sx = (kx * step) / subs, sz = (kz * step) / subs;
      for (let i = 0; i < subs; i++) {
        if (!blocked(pos.x + sx, pos.z + sz)) {
          pos.x += sx;
          pos.z += sz;
        } else if (!blocked(pos.x + sx, pos.z)) pos.x += sx;
        else if (!blocked(pos.x, pos.z + sz)) pos.z += sz;
        else break;
      }
      const wantYaw = Math.atan2(kx, kz);
      let diff = wantYaw - g.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      g.rotation.y += diff * Math.min(1, dt * 14);
      moving = true;
    } else if (steering.current) {
      steering.current = false;
      onSteerEnd?.([pos.x, pos.z]);
    } else if (target && arrivedFor.current !== target) {
      const dx = target[0] - pos.x;
      const dz = target[1] - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= ARRIVE_EPSILON) {
        arrivedFor.current = target;
        onArrive(target);
      } else {
        const step = Math.min(dist, WALK_SPEED * dt);
        // Move in short sub-steps so a slow frame (long dt) can't carry the
        // player through a thin wall, such as the holding cell dividers.
        const subs = Math.max(1, Math.ceil(step / MAX_SUBSTEP));
        const sx = ((dx / dist) * step) / subs;
        const sz = ((dz / dist) * step) / subs;
        for (let i = 0; i < subs; i++) {
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

  const outfit = useMemo(() => playerOutfit(color, appearance, shape), [color, appearance, shape?.fat, shape?.muscle]);
  const heldL = held?.handL, heldR = held?.handR;
  useEffect(() => {
    const bn = bones.current;
    if (!bn) return;
    const models: THREE.Group[] = [];
    const twoHanded = !!heldR && heldR === heldL && ITEMS[heldR]?.hands === 2;
    for (const [id, bone, side] of [[heldL, bn.handL, -1], [heldR, bn.handR, 1]] as const) {
      if (!id || (twoHanded && side === -1)) continue;
      const m = buildItemModel(id);
      // grip in the palm, tool pointing forward-down like it's being carried
      m.position.set(side * 0.004, -0.09, 0.02);
      m.rotation.set(twoHanded ? -0.5 : -0.25, 0, 0);
      bone.add(m);
      models.push(m);
    }
    return () => {
      for (const m of models) {
        m.removeFromParent();
        disposeItemModel(m);
      }
    };
  }, [heldL, heldR, outfit]);

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

/** The player's look as a humanoid outfit. */
/** The player's model outfit; `shape` (fat / muscle 0–1) comes from bodyShape(). */
export function playerOutfit(color: string, a?: Appearance, shape?: { fat: number; muscle: number }): Outfit {
  const ap = a ?? defaultAppearance(color);
  return {
    top: ap.top,
    legs: ap.legs,
    shoes: ap.shoes,
    skin: ap.skin,
    hair: ap.hair,
    hairStyle: ap.hairStyle,
    facialHair: ap.facialHair,
    eyes: ap.eyes,
    glasses: ap.glasses,
    hat: ap.hat,
    hatColor: ap.hatColor,
    accent: ap.accent,
    backpack: ap.backpack,
    style: ap.topStyle,
    build: ap.build,
    height: ap.height,
    fat: shape?.fat,
    muscle: shape?.muscle,
  };
}
