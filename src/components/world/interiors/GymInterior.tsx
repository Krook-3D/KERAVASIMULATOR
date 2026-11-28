import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GYM_HALL, GYM_PLATE_TREE, GYM_STATIONS, INTERIORS, type GymStation } from '../../../game/interiors/interiors';
import type { LiftId } from '../../../game/gym/lifting';
import { Humanoid, type HumanBones, type Outfit } from '../humanoid/Humanoid';
import { poseBench, poseDeadlift, poseLocomotion, posePhone, poseSquat, resetPose } from '../humanoid/animate';
import { Box, Cutaway, InstancedBoxes, TextPanel, WallFromRect, useTileTexture, type V3 } from './kit';

const WALL_H = 4.2;

/** Plate look by weight: radius, thickness, colour (calibrated-plate colours). */
export const PLATE_LOOK: Record<number, { r: number; t: number; c: string }> = {
  25: { r: 0.225, t: 0.055, c: '#c8312b' },
  20: { r: 0.225, t: 0.047, c: '#2f5fa8' },
  15: { r: 0.225, t: 0.038, c: '#e2b81f' },
  10: { r: 0.225, t: 0.03, c: '#2e9e5b' },
  5: { r: 0.16, t: 0.028, c: '#efefe8' },
  2.5: { r: 0.12, t: 0.022, c: '#1c1c22' },
  1.25: { r: 0.1, t: 0.017, c: '#b8bcc4' },
};

function Plate({ kg, x, y = 0, z = 0, axis = 'x' }: { kg: number; x: number; y?: number; z?: number; axis?: 'x' | 'z' }) {
  const L = PLATE_LOOK[kg] ?? PLATE_LOOK[10]!;
  return (
    <mesh position={[x, y, z]} rotation-z={axis === 'x' ? Math.PI / 2 : 0} rotation-x={axis === 'z' ? Math.PI / 2 : 0} castShadow>
      <cylinderGeometry args={[L.r, L.r, L.t, 28]} />
      <meshStandardMaterial color={L.c} roughness={0.55} metalness={0.1} />
    </mesh>
  );
}

/** Barbell along local x with plate pairs, innermost first. */
export function Barbell({ pairs }: { pairs: readonly number[] }) {
  const placed = useMemo(() => {
    const out: { kg: number; x: number }[] = [];
    let at = 0.72;
    for (const kg of pairs) {
      const t = (PLATE_LOOK[kg] ?? PLATE_LOOK[10]!).t;
      out.push({ kg, x: at + t / 2 });
      at += t + 0.004;
    }
    return out;
  }, [pairs]);
  return (
    <group>
      <mesh rotation-z={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.014, 0.014, 2.2, 10]} />
        <meshStandardMaterial color="#c9ccd2" metalness={0.9} roughness={0.25} />
      </mesh>
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <mesh position-x={sd * 0.9} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.025, 0.025, 0.4, 12]} />
            <meshStandardMaterial color="#d5d8de" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position-x={sd * 0.705} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.04, 0.04, 0.03, 14]} />
            <meshStandardMaterial color="#8a8d93" metalness={0.8} roughness={0.3} />
          </mesh>
          {placed.map((p, i) => (
            <Plate key={i} kg={p.kg} x={sd * p.x} />
          ))}
        </group>
      ))}
    </group>
  );
}

const SET_REP = 1.7;
export const SET_REPS = 5;
/** Length of a set in seconds (a failed rep is shorter). */
export const setDuration = (success: boolean) => (success ? SET_REPS * SET_REP + 0.6 : 3.6);

/**
 * Animation value over a set. Bench: 1 = arms locked out. Squat/deadlift:
 * 1 = bottom position. Failed sets grind and sink back.
 */
function liftValue(lift: LiftId, success: boolean, t: number): number {
  const cyc = (u: number) => 0.5 - 0.5 * Math.cos((u / SET_REP) * Math.PI * 2); // 0 → 1 → 0
  if (success) {
    const u = Math.min(t, SET_REPS * SET_REP);
    if (lift === 'bench') return 1 - cyc(u);
    if (lift === 'squat') return cyc(u);
    return t < 0.3 ? 1 : 1 - cyc(Math.min(u, SET_REPS * SET_REP)) ; // starts on the floor
  }
  // failed: go down, grind, give up
  const s = THREE.MathUtils.clamp;
  if (lift === 'bench') return t < 0.9 ? 1 - t / 0.9 : s(0.25 * Math.sin(((t - 0.9) / 2.2) * Math.PI) * (1 + 0.15 * Math.sin(t * 30)), 0, 0.3);
  if (lift === 'squat') return t < 0.9 ? t / 0.9 : 1 - s(0.25 * Math.sin(((t - 0.9) / 2.2) * Math.PI) * (1 + 0.15 * Math.sin(t * 30)), 0, 0.3);
  return 1 - s(0.22 * Math.sin((t / 3) * Math.PI) * (1 + 0.2 * Math.sin(t * 30)), 0, 0.3);
}

export interface GymActive {
  lift: LiftId;
  success: boolean;
  /** Clock time (s) the set began. */
  t0: number;
}

/** The player's double doing the set, with the bar following the hands. */
function Lifter({ station, active, outfit, pairs, clockRef }: { station: GymStation; active: GymActive; outfit: Outfit; pairs: readonly number[]; clockRef: MutableRefObject<number> }) {
  const bones = useRef<HumanBones | null>(null);
  const bar = useRef<THREE.Group>(null);
  const [bx, bz] = station.bar;
  useFrame(() => {
    const b = bones.current;
    if (!b) return;
    const t = Math.max(0, clockRef.current - active.t0);
    const v = liftValue(active.lift, active.success, t);
    resetPose(b);
    const g = bar.current;
    if (active.lift === 'bench') {
      poseBench(b, v);
      g?.position.set(bx, 0.84 + 0.4 * v, bz + 0.12);
    } else if (active.lift === 'squat') {
      poseSquat(b, v);
      const drop = 0.83 * (1 - Math.cos(1.2 * v));
      g?.position.set(bx, 1.43 - drop - 0.06 * v, bz - 0.08 + 0.28 * v);
    } else {
      poseDeadlift(b, v);
      g?.position.set(bx, 0.225 + 0.56 * (1 - v), bz + 0.12 + 0.05 * v);
    }
  });
  const body =
    active.lift === 'bench'
      ? { p: [bx, 0.61, bz + 1.42] as V3, r: [-Math.PI / 2, 0, 0] as V3 }
      : { p: [bx, 0, active.lift === 'deadlift' ? bz : bz - 0.02] as V3, r: [0, 0, 0] as V3 };
  return (
    <group>
      <group position={body.p} rotation={body.r}>
        <Humanoid outfit={outfit} bonesRef={bones} />
      </group>
      <group ref={bar}>
        <Barbell pairs={pairs} />
      </group>
    </group>
  );
}

function Bench({ station, pairs, racked }: { station: GymStation; pairs: readonly number[]; racked: boolean }) {
  const [x, z] = station.bar;
  return (
    <group>
      <Box p={[x, 0.42, z + 0.75]} s={[0.32, 0.1, 1.25]} color="#1c1c22" rough={0.5} />
      <Box p={[x, 0.2, z + 0.75]} s={[0.12, 0.4, 1.0]} color="#3a3d44" metal={0.6} rough={0.4} />
      {[-0.55, 0.55].map((dx) => (
        <group key={dx}>
          <Box p={[x + dx, 0.6, z - 0.15]} s={[0.07, 1.2, 0.07]} color="#3a3d44" metal={0.7} rough={0.35} />
          <Box p={[x + dx, 1.03, z - 0.08]} s={[0.07, 0.05, 0.14]} color="#c8312b" />
        </group>
      ))}
      <Box p={[x, 0.03, z - 0.15]} s={[1.4, 0.06, 0.5]} color="#3a3d44" metal={0.7} />
      {racked && (
        <group position={[x, 1.07, z]}>
          <Barbell pairs={pairs} />
        </group>
      )}
    </group>
  );
}

function SquatRack({ station, pairs, racked }: { station: GymStation; pairs: readonly number[]; racked: boolean }) {
  const [x, z] = station.bar;
  return (
    <group>
      {[-1.45, 1.45].flatMap((dx) =>
        [-0.85, 0.5].map((dz) => <Box key={`${dx}${dz}`} p={[x + dx, 1.25, z + dz]} s={[0.08, 2.5, 0.08]} color="#26282d" metal={0.7} rough={0.35} />),
      )}
      {[-1.45, 1.45].map((dx) => (
        <group key={dx}>
          <Box p={[x + dx, 2.46, z - 0.17]} s={[0.08, 0.08, 1.43]} color="#26282d" metal={0.7} />
          <Box p={[x + dx * 0.9, 1.4, z + 0.06]} s={[0.14, 0.05, 0.16]} color="#c8312b" />
          <Box p={[x + dx, 0.75, z - 0.17]} s={[0.12, 0.05, 1.4]} color="#c8312b" metal={0.4} />
        </group>
      ))}
      <Box p={[x, 2.46, z - 0.85]} s={[2.98, 0.08, 0.08]} color="#26282d" metal={0.7} />
      <Box p={[x, 0.015, z - 0.15]} s={[3.2, 0.03, 1.7]} color="#2a2420" rough={0.9} />
      {racked && (
        <group position={[x, 1.45, z]}>
          <Barbell pairs={pairs} />
        </group>
      )}
    </group>
  );
}

function Platform({ station, pairs, racked }: { station: GymStation; pairs: readonly number[]; racked: boolean }) {
  const [x, z] = station.bar;
  return (
    <group>
      <Box p={[x, 0.025, z]} s={[2.6, 0.05, 2.4]} color="#6b4a2e" rough={0.7} />
      {[-1, 1].map((sd) => (
        <Box key={sd} p={[x + sd * 0.95, 0.028, z]} s={[0.7, 0.056, 2.4]} color="#1c1c22" rough={0.95} />
      ))}
      {racked && (
        <group position={[x, 0.225 + 0.05, z + 0.12]}>
          <Barbell pairs={pairs} />
        </group>
      )}
    </group>
  );
}

function PlateTree() {
  const [x, z] = GYM_PLATE_TREE;
  const pegs: { kg: number; side: number; y: number }[] = [
    { kg: 25, side: -1, y: 0.35 }, { kg: 20, side: 1, y: 0.35 },
    { kg: 15, side: -1, y: 0.85 }, { kg: 10, side: 1, y: 0.85 },
    { kg: 5, side: -1, y: 1.3 }, { kg: 2.5, side: 1, y: 1.3 }, { kg: 1.25, side: 1, y: 1.6 },
  ];
  return (
    <group>
      <Box p={[x, 0.85, z]} s={[0.1, 1.7, 0.1]} color="#26282d" metal={0.7} />
      <Box p={[x, 0.03, z]} s={[0.9, 0.06, 0.9]} color="#26282d" metal={0.7} />
      {pegs.map((pg) => (
        <group key={pg.kg}>
          <Box p={[x, pg.y, z + pg.side * 0.15]} s={[0.04, 0.04, 0.3]} color="#8a8d93" metal={0.8} />
          {[0, 1, 2].map((i) => (
            <Plate key={i} kg={pg.kg} x={x} y={pg.y} z={z + pg.side * (0.1 + i * ((PLATE_LOOK[pg.kg]?.t ?? 0.03) + 0.006))} axis="z" />
          ))}
        </group>
      ))}
      <TextPanel p={[x, 2.0, z + 0.01]} w={0.9} h={0.28} text="LEVYT" bg="#14171f" fg="#ffd23f" />
    </group>
  );
}

const DUMBBELLS = (() => {
  const out: { p: V3; s: V3; c: string }[] = [];
  for (let i = 0; i < 10; i++) {
    const z = -5.4 + i * 1.05;
    const r = 0.09 + i * 0.012;
    for (const y of [0.55, 1.0])
      for (const dz of [-0.17, 0.17]) out.push({ p: [-10.4, y, z + dz], s: [0.2 + i * 0.01, r * 2, 0.07], c: '#22242a' });
  }
  return out;
})();

function GymGoer({ p, yaw, outfit, mode }: { p: [number, number]; yaw: number; outfit: Outfit; mode: 'curl' | 'phone' | 'run' }) {
  const bones = useRef<HumanBones | null>(null);
  useFrame(({ clock }) => {
    const b = bones.current;
    if (!b) return;
    const t = clock.elapsedTime + p[0];
    resetPose(b);
    if (mode === 'run') {
      poseLocomotion(b, t * 10, 1, t);
      return;
    }
    poseLocomotion(b, 0, 0, t);
    if (mode === 'phone') posePhone(b, t);
    else {
      const k = 0.5 - 0.5 * Math.cos(t * 2.4);
      b.forearmR.rotation.x = -0.2 - 2.0 * k;
      b.forearmL.rotation.x = -0.2 - 2.0 * (1 - k);
    }
  });
  return (
    <group position={[p[0], 0, p[1]]} rotation-y={yaw}>
      <Humanoid bonesRef={bones} outfit={outfit} />
    </group>
  );
}

export function GymInterior({ pairs, active, outfit, clockRef }: { pairs: Record<LiftId, readonly number[]>; active: GymActive | null; outfit: Outfit; clockRef: MutableRefObject<number> }) {
  const floor = useTileTexture('#2a2c30', '#24262a', 8, [6, 4], '#00000055');
  const def = INTERIORS.gym;
  const st = (l: LiftId) => GYM_STATIONS.find((s) => s.lift === l)!;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.004} receiveShadow>
        <planeGeometry args={[GYM_HALL.maxX - GYM_HALL.minX, GYM_HALL.maxZ - GYM_HALL.minZ]} />
        <meshStandardMaterial map={floor} roughness={0.95} />
      </mesh>
      {def.solids.slice(0, 5).map((r, i) => (
        <WallFromRect key={i} r={r} h={WALL_H} color={i === 0 ? '#3a3f47' : '#d8d4cc'} room={[0, 0]} />
      ))}
      {/* mirrors + slogan on the back wall */}
      <Cutaway axis="z" at={-8} outward={-1}>
        <Box p={[0, 1.6, -7.97]} s={[20, 1.9, 0.03]} color="#cfe0ea" metal={0.9} rough={0.05} cast={false} />
        <TextPanel p={[0, 3.3, -7.95]} w={9} h={0.9} text="KUNTOSALI RAUTA" bg="#14171f" fg="#ffd23f" font="900 52px Rubik, Arial Black, sans-serif" />
        {[-8, 8].map((x) => (
          <Box key={x} p={[x, WALL_H - 0.15, -7.9]} s={[3, 0.08, 0.15]} color="#eef6ff" emissive="#dfefff" cast={false} />
        ))}
      </Cutaway>
      <Cutaway axis="x" at={-11} outward={-1}>
        <TextPanel p={[-10.95, 2.6, 2]} rotY={Math.PI / 2} w={3.2} h={1.6} text={'EI PUDOTELLA\nPAINOJA.\nPALAUTA LEVYT!'} bg="#c8312b" />
      </Cutaway>
      <Cutaway axis="x" at={11} outward={1}>
        <TextPanel p={[10.95, 2.6, -2]} rotY={-Math.PI / 2} w={3.4} h={1.4} text={'VOIMA KASVAA\nTOISTO KERRALLAAN'} bg="#2f5fa8" />
      </Cutaway>

      <Bench station={st('bench')} pairs={pairs.bench} racked={active?.lift !== 'bench'} />
      <SquatRack station={st('squat')} pairs={pairs.squat} racked={active?.lift !== 'squat'} />
      <Platform station={st('deadlift')} pairs={pairs.deadlift} racked={active?.lift !== 'deadlift'} />
      {active && <Lifter station={st(active.lift)} active={active} outfit={outfit} pairs={pairs[active.lift]} clockRef={clockRef} />}
      <PlateTree />
      {GYM_STATIONS.map((s) => (
        <TextPanel key={s.lift} p={[s.bar[0], 3.0, -7.9]} w={2.6} h={0.42} text={s.lift === 'bench' ? 'PENKKI' : s.lift === 'squat' ? 'KYYKKY' : 'MAASTAVETO'} bg="#14171f" fg="#ffffff" />
      ))}

      {/* dumbbell rack */}
      <Box p={[-10.4, 0.4, -0.5]} s={[0.9, 0.06, 11]} color="#26282d" metal={0.6} />
      <Box p={[-10.4, 0.85, -0.5]} s={[0.9, 0.06, 11]} color="#26282d" metal={0.6} />
      <InstancedBoxes items={DUMBBELLS} />
      {/* treadmills */}
      {[-4.5, -1.5, 1.5].map((z) => (
        <group key={z}>
          <Box p={[10.3, 0.18, z]} s={[1.6, 0.25, 0.8]} color="#1c1c22" />
          <Box p={[10.95, 0.75, z]} s={[0.12, 1.3, 0.7]} color="#3a3d44" metal={0.5} />
          <Box p={[10.85, 1.4, z]} s={[0.25, 0.35, 0.7]} color="#14171f" emissive="#1d3a5a" />
        </group>
      ))}
      {/* reception */}
      <Box p={[-8.3, 0.55, 7.1]} s={[5.4, 1.1, 1.4]} color="#c8312b" />
      <Box p={[-8.3, 1.13, 7.1]} s={[5.5, 0.06, 1.5]} color="#e8e2d6" />
      <Box p={[-9.5, 1.5, 7.1]} s={[0.5, 0.45, 0.4]} color="#2f3138" />
      <Box p={[-6.4, 1.3, 7.1]} s={[0.9, 0.3, 0.6]} color="#ffd23f" />
      <TextPanel p={[-6.4, 1.6, 6.78]} rotY={Math.PI} w={1.2} h={0.25} text="Proteiinipatukat 3 €" bg="#14171f" fg="#ffd23f" font="700 34px Rubik, Arial" />
      <GymGoer p={[-8.6, 7.4]} yaw={Math.PI} outfit={{ top: '#c8312b', legs: '#1f2533', shoes: '#fff', hair: '#2a1a10', hat: 'none', hatColor: '#000', accent: '#fff', build: 1.05 }} mode="phone" />
      <GymGoer p={[-9.3, 2.2]} yaw={Math.PI / 2} outfit={{ top: '#2a2a33', legs: '#3a3a44', shoes: '#ddd', hair: '#1a1410', hat: 'none', hatColor: '#000', accent: '#fff', build: 1.05, muscle: 0.7, skin: '#c58f62' }} mode="curl" />
      <GymGoer p={[10.3, -1.5]} yaw={Math.PI / 2} outfit={{ top: '#ff6fa8', legs: '#14171f', shoes: '#fff', hair: '#d8b070', hat: 'none', hatColor: '#000', accent: '#fff', build: 0.9 }} mode="run" />
    </group>
  );
}
