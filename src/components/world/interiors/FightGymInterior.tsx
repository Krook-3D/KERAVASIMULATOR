import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FIGHT_BAG_XS, FIGHT_BAG_Z, FIGHT_HALL, FIGHT_MAT, FIGHT_RING, FIGHT_SPOTS, INTERIORS } from '../../../game/interiors/interiors';
import { Humanoid, type HumanBones, type Outfit } from '../humanoid/Humanoid';
import { poseGrapple, poseGuard, poseLocomotion, resetPose } from '../humanoid/animate';
import { Box, Cutaway, TextPanel, WallFromRect, useTileTexture } from './kit';

const WALL_H = 5;
export type FightDrill = 'bag' | 'wrestle' | 'spar';
export interface FightActive {
  drill: FightDrill;
  t0: number;
}
/** How long one round lasts (seconds). */
export const DRILL_TIME = 6;

const COACH: Outfit = { top: '#c8312b', legs: '#14171f', shoes: '#f2f2f2', hair: '#2a2a2a', hairStyle: 'buzz', facialHair: 'goatee', hat: 'none', hatColor: '#000', accent: '#f2f2f2', style: 'hoodie', build: 1.14 };
const SPARRER: Outfit = { top: '#3a7bd5', legs: '#1d2433', shoes: '#14171f', hair: '#a8794a', hairStyle: 'short', hat: 'none', hatColor: '#000', accent: '#ffd23f', style: 'hoodie', build: 1.05 };

/** A heavy bag on a chain; swings while `hit` says it's being punched. */
function Bag({ x, hitRef }: { x: number; hitRef?: MutableRefObject<number> }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const h = hitRef?.current ?? 0;
    g.current.rotation.x = Math.sin(clock.elapsedTime * 3.1 + x) * (0.03 + h * 0.18);
  });
  return (
    <group position={[x, 4.2, FIGHT_BAG_Z]}>
      <Box p={[0, 0.2, 0]} s={[0.04, 0.4, 0.04]} color="#9aa0a8" metal={0.8} />
      <group ref={g}>
        <mesh position-y={-1.75} castShadow>
          <cylinderGeometry args={[0.3, 0.3, 1.6, 16]} />
          <meshStandardMaterial color="#14171f" roughness={0.6} />
        </mesh>
        <mesh position-y={-1.2}>
          <cylinderGeometry args={[0.305, 0.305, 0.12, 16]} />
          <meshStandardMaterial color="#c8312b" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

/** Someone training: guard, punches, grappling. `mode` picks the motion. */
function Fighter({ p, yaw, outfit, mode, clockRef, phase = 0 }: { p: [number, number]; yaw: number; outfit: Outfit; mode: 'bag' | 'grapple' | 'spar' | 'idle'; clockRef?: MutableRefObject<number>; phase?: number }) {
  const bones = useRef<HumanBones | null>(null);
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const b = bones.current;
    if (!b) return;
    const t = (clockRef?.current ?? clock.elapsedTime) + phase;
    resetPose(b);
    if (mode === 'idle') {
      poseLocomotion(b, 0, 0, t);
      b.upperArmL.rotation.set(-0.3, 0, 0.5);
      b.upperArmR.rotation.set(-0.3, 0, -0.5);
      b.forearmL.rotation.x = -1.6;
      b.forearmR.rotation.x = -1.6;
      return;
    }
    if (mode === 'grapple') {
      poseGrapple(b, Math.sin(t * 1.6));
      if (g.current) g.current.position.x = p[0] + Math.sin(t * 1.6) * 0.15;
      return;
    }
    const cyc = (t * (mode === 'bag' ? 2.6 : 1.8)) % 2;
    const k = Math.max(0, Math.sin((cyc % 1) * Math.PI)) ** 2;
    poseGuard(b, t, cyc < 1 ? k : -k);
    if (mode === 'spar' && g.current) {
      g.current.position.x = p[0] + Math.sin(t * 0.9) * 0.6;
      g.current.position.z = p[1] + Math.cos(t * 0.7) * 0.3;
    }
  });
  return (
    <group ref={g} position={[p[0], 0, p[1]]} rotation-y={yaw}>
      <Humanoid bonesRef={bones} outfit={outfit} />
    </group>
  );
}

/** Combat gym: ring, heavy bags, wrestling mats, a coach and regulars. */
export function FightGymInterior({ active, outfit, clockRef }: { active: FightActive | null; outfit: Outfit; clockRef: MutableRefObject<number> }) {
  const floor = useTileTexture('#3a3d44', '#33363c', 6, [6, 5], '#00000022');
  const def = INTERIORS.fightgym;
  const hit = useRef(0);
  useFrame(() => {
    hit.current = active?.drill === 'bag' ? 1 : 0;
  });
  const r = FIGHT_RING, rw = r.maxX - r.minX, rd = r.maxZ - r.minZ, rc: [number, number] = [(r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2];
  const m = FIGHT_MAT;
  const bagX = FIGHT_BAG_XS[1]!;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.004} receiveShadow>
        <planeGeometry args={[FIGHT_HALL.maxX - FIGHT_HALL.minX, FIGHT_HALL.maxZ - FIGHT_HALL.minZ]} />
        <meshStandardMaterial map={floor} roughness={0.8} />
      </mesh>
      {def.solids.slice(0, 5).map((w, i) => (
        <WallFromRect key={i} r={w} h={WALL_H} color={i === 0 ? '#2a2d33' : '#3a3d44'} room={[0, 0]} />
      ))}
      <Cutaway axis="z" at={FIGHT_HALL.minZ} outward={-1}>
        <TextPanel p={[0, 3.9, FIGHT_HALL.minZ + 0.3]} w={9} h={0.9} text="AHJO TRAINING CENTER" bg="#14171f" fg="#ffd23f" />
      </Cutaway>
      {/* ring: platform, corner posts, three ropes */}
      <Box p={[rc[0], 0.35, rc[1]]} s={[rw, 0.7, rd]} color="#2b3a55" />
      <Box p={[rc[0], 0.71, rc[1]]} s={[rw - 0.3, 0.02, rd - 0.3]} color="#e8e4da" rough={0.9} />
      {[[r.minX, r.minZ], [r.maxX, r.minZ], [r.minX, r.maxZ], [r.maxX, r.maxZ]].map(([x, z], i) => (
        <Box key={i} p={[x! + (x === r.minX ? 0.15 : -0.15), 1.35, z! + (z === r.minZ ? 0.15 : -0.15)]} s={[0.18, 1.3, 0.18]} color={i % 3 === 0 ? '#c8312b' : '#3a7bd5'} />
      ))}
      {[1.05, 1.4, 1.75].map((y) => (
        <group key={y}>
          <Box p={[rc[0], y, r.minZ + 0.15]} s={[rw - 0.3, 0.04, 0.04]} color="#f2f2f2" cast={false} />
          <Box p={[rc[0], y, r.maxZ - 0.15]} s={[rw - 0.3, 0.04, 0.04]} color="#f2f2f2" cast={false} />
          <Box p={[r.minX + 0.15, y, rc[1]]} s={[0.04, 0.04, rd - 0.3]} color="#f2f2f2" cast={false} />
          <Box p={[r.maxX - 0.15, y, rc[1]]} s={[0.04, 0.04, rd - 0.3]} color="#f2f2f2" cast={false} />
        </group>
      ))}
      {/* heavy bags */}
      {FIGHT_BAG_XS.map((x) => (
        <Bag key={x} x={x} hitRef={x === bagX ? hit : undefined} />
      ))}
      <Box p={[6.5, 4.4, FIGHT_BAG_Z]} s={[8, 0.12, 0.12]} color="#5a5f66" metal={0.6} />
      {/* wrestling mats */}
      <Box p={[(m.minX + m.maxX) / 2, 0.04, (m.minZ + m.maxZ) / 2]} s={[m.maxX - m.minX, 0.08, m.maxZ - m.minZ]} color="#c8312b" rough={0.7} cast={false} />
      <mesh rotation-x={-Math.PI / 2} position={[(m.minX + m.maxX) / 2, 0.085, (m.minZ + m.maxZ) / 2]}>
        <ringGeometry args={[2.2, 2.4, 40]} />
        <meshStandardMaterial color="#f2f2f2" />
      </mesh>
      {/* reception, lockers */}
      <Box p={[-9.25, 0.55, 7.8]} s={[5.5, 1.1, 1.4]} color="#14171f" />
      <TextPanel p={[-9.25, 1.6, 7.08]} w={3} h={0.8} text={'TREENI\nVAPAA PÄÄSY'} bg="#14171f" fg="#ffd23f" />
      <Box p={[-11.4, 1, -1.5]} s={[1.0, 2, 11]} color="#5a5f66" metal={0.4} />
      <TextPanel p={[11.55, 2.6, 0]} rotY={-Math.PI / 2} w={5} h={1.2} text={'SÄKKI · PAINI · SPARRI\nKURINALLA, EI KADULLA'} bg="#c8312b" />
      {/* people */}
      {active?.drill === 'bag' ? (
        <Fighter p={[bagX, FIGHT_BAG_Z + 0.95]} yaw={Math.PI} outfit={outfit} mode="bag" clockRef={clockRef} />
      ) : (
        <Fighter p={[FIGHT_BAG_XS[0]!, FIGHT_BAG_Z + 0.95]} yaw={Math.PI} outfit={SPARRER} mode="bag" phase={1.3} />
      )}
      {active?.drill === 'wrestle' ? (
        <>
          <Fighter p={[FIGHT_SPOTS.wrestle[0] + 1.5, 1.2]} yaw={-Math.PI / 2} outfit={outfit} mode="grapple" clockRef={clockRef} />
          <Fighter p={[FIGHT_SPOTS.wrestle[0] + 2.4, 1.2]} yaw={Math.PI / 2} outfit={COACH} mode="grapple" clockRef={clockRef} phase={Math.PI} />
        </>
      ) : (
        <Fighter p={[FIGHT_SPOTS.wrestle[0] + 2, 2.2]} yaw={-0.6} outfit={COACH} mode="idle" />
      )}
      {active?.drill === 'spar' && (
        <>
          <Fighter p={[rc[0] - 1, rc[1]]} yaw={Math.PI / 2} outfit={outfit} mode="spar" clockRef={clockRef} />
          <Fighter p={[rc[0] + 1, rc[1]]} yaw={-Math.PI / 2} outfit={SPARRER} mode="spar" clockRef={clockRef} phase={0.8} />
        </>
      )}
      <pointLight position={[0, 4.2, -1]} intensity={16} distance={28} color="#fff2dc" />
    </group>
  );
}
