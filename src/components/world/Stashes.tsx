import { useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PlacedStash } from '../../game/quests/stashes';
import type { WorldXZ } from '../../game/world/projection';
import { Box } from './interiors/kit';
import { Humanoid, type HumanBones, type Outfit } from './humanoid/Humanoid';
import { poseLocomotion, resetPose } from './humanoid/animate';

const SEE = 34;

function StashModel({ s }: { s: PlacedStash }) {
  switch (s.id) {
    case 'pressu':
      return <Box p={[0, 0.25, 0]} s={[0.9, 0.5, 0.7]} color="#3f5a2e" rough={0.9} />;
    case 'geo':
      return <Box p={[0, 0.12, 0]} s={[0.35, 0.22, 0.25]} color="#2e9e5b" rough={0.4} />;
    case 'kivi':
      return (
        <mesh position-y={0.35} scale={[1, 0.6, 0.8]}>
          <dodecahedronGeometry args={[0.7, 0]} />
          <meshStandardMaterial color="#7a7f86" roughness={0.95} />
        </mesh>
      );
    case 'kanto':
      return (
        <mesh position-y={0.3}>
          <cylinderGeometry args={[0.4, 0.5, 0.6, 9]} />
          <meshStandardMaterial color="#5a3f28" roughness={0.95} />
        </mesh>
      );
    default:
      return <Box p={[0, 0.18, 0]} s={[0.6, 0.36, 0.38]} color="#6b6f76" metal={0.5} rough={0.6} />;
  }
}

/** Stashes are only visible when you're close; a faint glint gives them away. */
export function Stashes({ stashes, taken, playerRef, groundAt, onClick }: {
  stashes: PlacedStash[];
  taken: Set<string>;
  playerRef: MutableRefObject<THREE.Vector3>;
  groundAt: (x: number, z: number) => number;
  onClick: (s: PlacedStash) => void;
}) {
  const [near, setNear] = useState<string[]>([]);
  const last = useRef(0);
  useFrame(({ clock }) => {
    if (clock.elapsedTime - last.current < 0.8) return;
    last.current = clock.elapsedTime;
    const p = playerRef.current;
    const ids = stashes.filter((s) => !taken.has(s.id) && Math.hypot(s.at[0] - p.x, s.at[1] - p.z) < SEE).map((s) => s.id);
    setNear((prev) => (prev.join() === ids.join() ? prev : ids));
  });
  return (
    <group>
      {stashes
        .filter((s) => near.includes(s.id))
        .map((s) => (
          <group
            key={s.id}
            position={[s.at[0], groundAt(s.at[0], s.at[1]), s.at[1]]}
            onClick={(e) => {
              e.stopPropagation();
              onClick(s);
            }}
          >
            <StashModel s={s} />
            <Glint />
          </group>
        ))}
    </group>
  );
}

function Glint() {
  const m = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!m.current) return;
    const k = Math.max(0, Math.sin(clock.elapsedTime * 1.7)) ** 8;
    m.current.scale.setScalar(0.2 + k * 0.6);
    (m.current.material as THREE.MeshBasicMaterial).opacity = k;
  });
  return (
    <mesh ref={m} position-y={0.6} raycast={() => null}>
      <octahedronGeometry args={[0.25, 0]} />
      <meshBasicMaterial color="#fff6c8" transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

const COP: Outfit = { top: '#1f2a44', legs: '#1b2233', shoes: '#111', hair: '#3a2a1e', hairStyle: 'buzz', hat: 'cap', hatColor: '#1f2a44', accent: '#c8d0e0', style: 'jacket' };
const THUG: Outfit = { top: '#1f1f24', legs: '#2a2a2a', shoes: '#f2f2f2', hair: '#1a1410', hairStyle: 'buzz', facialHair: 'stubble', hat: 'beanie', hatColor: '#14171f', accent: '#c8312b', style: 'hoodie', build: 1.12 };
const HIKER: Outfit = { top: '#f28c28', legs: '#3c4a63', shoes: '#5a3a22', hair: '#a8794a', hairStyle: 'ponytail', hat: 'cap', hatColor: '#2e9e5b', accent: '#ffd23f', style: 'jacket', backpack: true, glasses: true };

function Runner({ from, offset, outfit, playerRef, t0, clockRef, groundAt }: {
  from: WorldXZ;
  offset: number;
  outfit: Outfit;
  playerRef: MutableRefObject<THREE.Vector3>;
  t0: number;
  clockRef: MutableRefObject<number>;
  groundAt: (x: number, z: number) => number;
}) {
  const g = useRef<THREE.Group>(null);
  const bones = useRef<HumanBones | null>(null);
  const phase = useRef(0);
  useFrame((_, dt) => {
    const m = g.current;
    if (!m) return;
    const pl = playerRef.current;
    const k = Math.min(1, (clockRef.current - t0) / 4);
    const dx = pl.x - from[0], dz = pl.z - from[1];
    const d = Math.hypot(dx, dz) || 1;
    const stop = 1 - 2.2 / d;
    const kk = Math.min(k, stop);
    const sx = -dz / d * offset, sz = dx / d * offset;
    const x = from[0] + dx * kk + sx, z = from[1] + dz * kk + sz;
    m.position.set(x, groundAt(x, z), z);
    m.rotation.y = Math.atan2(pl.x - x, pl.z - z);
    const running = k < stop;
    phase.current += dt * 13 * (running ? 1 : 0);
    if (bones.current) {
      resetPose(bones.current);
      poseLocomotion(bones.current, phase.current, running ? 1 : 0, clockRef.current);
    }
  });
  return (
    <group ref={g}>
      <Humanoid outfit={outfit} bonesRef={bones} />
    </group>
  );
}

/** The stash owners coming for you. */
export function Pursuers({ owner, from, t0, playerRef, clockRef, groundAt }: {
  owner: PlacedStash['owner'];
  from: WorldXZ;
  t0: number;
  playerRef: MutableRefObject<THREE.Vector3>;
  clockRef: MutableRefObject<number>;
  groundAt: (x: number, z: number) => number;
}) {
  const crew = useMemo(() => (owner === 'police' ? [COP, { ...COP, hairStyle: 'short' as const }] : owner === 'criminals' ? [THUG, { ...THUG, top: '#3c4a63', hat: 'cap' as const }] : [HIKER]), [owner]);
  return (
    <group>
      {crew.map((o, i) => (
        <Runner key={i} from={from} offset={(i - (crew.length - 1) / 2) * 1.4} outfit={o} playerRef={playerRef} t0={t0} clockRef={clockRef} groundAt={groundAt} />
      ))}
    </group>
  );
}
