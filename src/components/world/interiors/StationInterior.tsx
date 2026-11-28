import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { INTERIORS } from '../../../game/interiors/interiors';
import { Humanoid, type HumanBones, type Outfit } from '../humanoid/Humanoid';
import { poseLocomotion, posePhone, resetPose } from '../humanoid/animate';
import { Box, Cutaway, InstancedBoxes, TextPanel, WallFromRect, type V3 } from './kit';

const WALL_H = 5.2;
const PANEL = '#b07a3a';
const PLASTER = '#efe6d2';

function Bench({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  return (
    <group position={[x, 0, z]} rotation-y={rotY}>
      <Box p={[0, 0.45, 0]} s={[2.8, 0.08, 0.5]} color="#8a5a32" rough={0.6} />
      <Box p={[0, 0.85, -0.24]} s={[2.8, 0.5, 0.06]} color="#8a5a32" rough={0.6} />
      {[-1.2, 1.2].map((dx) => (
        <Box key={dx} p={[dx, 0.22, 0]} s={[0.08, 0.44, 0.45]} color="#2b2b2b" metal={0.6} rough={0.4} />
      ))}
    </group>
  );
}

function Person({ p, yaw, outfit, phone }: { p: [number, number]; yaw: number; outfit: Outfit; phone?: boolean }) {
  const bones = useRef<HumanBones | null>(null);
  useFrame(({ clock }) => {
    const b = bones.current;
    if (!b) return;
    resetPose(b);
    poseLocomotion(b, 0, 0, clock.elapsedTime + p[0]);
    if (phone) posePhone(b, clock.elapsedTime);
  });
  return (
    <group position={[p[0], 0, p[1]]} rotation-y={yaw}>
      <Humanoid bonesRef={bones} outfit={outfit} />
    </group>
  );
}

/** Kiosk goods: snacks, drinks, papers. */
const KIOSK_GOODS = (() => {
  const items: { p: V3; s: V3; c: string }[] = [];
  const palette = ['#e05555', '#ffd23f', '#3a7bd5', '#2e9e5b', '#f28c28', '#8a5a9e', '#f2f2f2'];
  let k = 0;
  for (let lvl = 0; lvl < 4; lvl++)
    for (let i = 0; i < 9; i++) {
      const c = palette[(k++ * 7 + lvl) % palette.length]!;
      items.push({ p: [11.75, 0.55 + lvl * 0.45, -2.3 + i * 0.48], s: [0.3, 0.3, 0.36], c });
    }
  for (let i = 0; i < 8; i++) items.push({ p: [9.2 + (i % 4) * 0.9, 1.12, -3.9 + Math.floor(i / 4) * 0.5], s: [0.5, 0.06, 0.35], c: i % 2 ? '#e9e4d6' : '#ffd23f' });
  return items;
})();

export function StationInterior() {
  const def = INTERIORS.station;
  return (
    <group>
      {def.solids.slice(0, 6).map((r, i) => (
        <group key={i}>
          <WallFromRect r={r} h={1.4} color={PANEL} room={[0, 0]} />
          <group position-y={1.4}>
            <WallFromRect r={r} h={WALL_H - 1.4} color={PLASTER} room={[0, 0]} hideLow />
          </group>
        </group>
      ))}
      {/* tall arched windows on both long walls */}
      {[-10, -5, 5, 10].flatMap((x) =>
        ([-4.47, 4.47] as const).map((z) => (
          <Cutaway key={`${x}${z}`} axis="z" at={z} outward={z > 0 ? 1 : -1}>
            <Box p={[x, 3.1, z]} s={[1.7, 2.8, 0.1]} color="#f3efe4" cast={false} />
            <Box p={[x, 3.1, z + (z > 0 ? -0.04 : 0.04)]} s={[1.4, 2.5, 0.04]} color="#bcd8ea" emissive="#a9cde6" cast={false} />
          </Cutaway>
        )),
      )}
      {/* doors */}
      {([-4.45, 4.45] as const).map((z) => (
        <Cutaway key={z} axis="z" at={z} outward={z > 0 ? 1 : -1}>
          <Box p={[-1.3, 1.5, z]} s={[0.25, 3, 0.4]} color="#5a3a22" />
          <Box p={[1.3, 1.5, z]} s={[0.25, 3, 0.4]} color="#5a3a22" />
          <Box p={[0, 3.1, z]} s={[2.85, 0.3, 0.4]} color="#5a3a22" />
          <TextPanel p={[0, 3.7, z > 0 ? 4.18 : -4.18]} rotY={z > 0 ? Math.PI : 0} w={2.6} h={0.45} text={z > 0 ? 'ASEMA-AUKIO' : 'LAITURIT 1–4'} bg="#1f3f8f" />
        </Cutaway>
      ))}

      {/* ticket counter (closed) */}
      <Box p={[-10.75, 0.55, 3.7]} s={[4.5, 1.1, 1.6]} color="#7a4a2a" rough={0.5} />
      <Box p={[-10.75, 1.8, 3.15]} s={[4.5, 1.3, 0.05]} color="#cfe6f2" opacity={0.35} cast={false} />
      <TextPanel p={[-10.75, 2.75, 3.1]} rotY={Math.PI} w={4.2} h={0.5} text="LIPUNMYYNTI · SULJETTU" bg="#14171f" fg="#ffb43c" />
      <TextPanel p={[-10.75, 1.3, 2.88]} rotY={Math.PI} w={2.6} h={0.35} text="Osta lippu sovelluksesta tai automaatista" bg="#f3efe4" fg="#14171f" font="600 30px Rubik, Arial" />

      {/* ticket machine */}
      <group position={[6.5, 0, 4.05]} rotation-y={Math.PI}>
        <Box p={[0, 0.85, 0]} s={[0.75, 1.7, 0.45]} color="#2f5fa8" metal={0.3} rough={0.4} />
        <Box p={[0, 1.25, 0.23]} s={[0.5, 0.36, 0.02]} color="#8fd0ff" emissive="#6fbfff" cast={false} />
        <TextPanel p={[0, 1.6, 0.235]} w={0.6} h={0.12} text="LIPPUAUTOMAATTI" bg="#2f5fa8" font="800 44px Rubik, Arial" />
      </group>

      {/* kiosk */}
      <Box p={[10.8, 0.55, -3.5]} s={[4.4, 1.1, 1.8]} color="#c0392b" rough={0.5} />
      <Box p={[10.8, 1.14, -3.5]} s={[4.5, 0.06, 1.9]} color="#f3efe4" />
      <Box p={[12.2, 1.4, -0.3]} s={[1.6, 2.8, 4.6]} color="#5a5f68" />
      <InstancedBoxes items={KIOSK_GOODS} />
      <Box p={[12.3, 1.2, 1.4]} s={[1.1, 2.3, 0.9]} color="#d8e6ee" emissive="#cfe6ff" />
      <TextPanel p={[10.8, 3.4, -2.55]} w={3.6} h={0.7} text="KIOSKI" bg="#c0392b" />
      <Person p={[10.6, -4.1]} yaw={0} outfit={{ top: '#c0392b', legs: '#1f2533', shoes: '#222', hair: '#d8b070', hat: 'none', hatColor: '#000', accent: '#fff', build: 0.92 }} />

      {/* benches */}
      <Bench x={-2.7} z={0} />
      <Bench x={2.7} z={0} />
      <Bench x={-2.7} z={2.75} rotY={Math.PI} />

      {/* departures board + clock */}
      <Box p={[0, 4.3, -4.0]} s={[4.4, 1.2, 0.2]} color="#0d1118" />
      <TextPanel
        p={[0, 4.3, -3.88]}
        w={4.2}
        h={1.05}
        glow
        text={'R  HELSINKI      2 min  L1\nZ  LAHTI        11 min  L4\nK  HELSINKI     14 min  L2'}
        bg="#0d1118"
        fg="#ffb43c"
        font="600 34px 'Courier New', monospace"
      />
      <group position={[-6.5, 4.2, -4.0]}>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.45, 0.45, 0.1, 24]} />
          <meshStandardMaterial color="#f8f5ec" />
        </mesh>
        <Box p={[0, 0.12, 0.06]} s={[0.04, 0.3, 0.02]} color="#14171f" />
        <Box p={[0.1, 0, 0.06]} s={[0.24, 0.035, 0.02]} color="#14171f" />
      </group>

      {/* stairs down to the tunnel: railing + steps descending into darkness */}
      <group>
        {Array.from({ length: 6 }, (_, i) => (
          <Box key={i} p={[-10.3, 0.012, -4.2 + i * 0.45]} s={[5.2, 0.012, 0.42]} color={i % 2 ? '#5a5650' : '#46433e'} cast={false} />
        ))}
        <Box p={[-10.3, 0.004, -3.0]} s={[5.4, 0.008, 2.9]} color="#1d1c1a" cast={false} />
        <Box p={[-10.3, 0.95, -1.62]} s={[5.4, 0.06, 0.06]} color="#c8c8c8" metal={0.8} rough={0.3} />
        <Box p={[-7.62, 0.95, -3.05]} s={[0.06, 0.06, 2.9]} color="#c8c8c8" metal={0.8} rough={0.3} />
        {[-12.8, -10.3, -7.8].map((x) => (
          <Box key={x} p={[x, 0.48, -1.62]} s={[0.05, 0.95, 0.05]} color="#c8c8c8" metal={0.8} />
        ))}
        <TextPanel p={[-7.62, 2.3, -3.05]} rotY={Math.PI / 2} w={2.4} h={0.5} text="⬇ TUNNELI" bg="#1f3f8f" />
      </group>

      <Person p={[-3.5, 0]} yaw={0} outfit={{ top: '#4a6b8a', legs: '#2a2a33', shoes: '#eee', hat: 'none', hair: '#a0a0a0', hatColor: '#000', accent: '#fff', build: 1.08 }} phone />
      <Person p={[4.5, 2.2]} yaw={2.6} outfit={{ top: '#e7d8b8', legs: '#5a4a3a', shoes: '#4a3020', hat: 'beanie', hatColor: '#3a7bd5', accent: '#ffd23f', skin: '#8a5a3c', backpack: true }} />
    </group>
  );
}
