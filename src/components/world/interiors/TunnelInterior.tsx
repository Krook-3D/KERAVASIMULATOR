import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { INTERIORS, TUNNEL_BRANCH, TUNNEL_MAIN } from '../../../game/interiors/interiors';
import { Humanoid, type HumanBones } from '../humanoid/Humanoid';
import { poseLocomotion, posePhone, resetPose } from '../humanoid/animate';
import { Box, Cutaway, TextPanel, WallFromRect, useTileTexture } from './kit';

const WALL_H = 3.3;

/** Steps rising from (x0) towards (x1) along x, or along z when `alongZ`. */
function Stairs({ from, to, width, centre, rise = 1.8, steps = 9, alongZ = false }: { from: number; to: number; width: number; centre: number; rise?: number; steps?: number; alongZ?: boolean }) {
  const run = (to - from) / steps;
  return (
    <group>
      {Array.from({ length: steps }, (_, i) => {
        const h = ((i + 1) / steps) * rise;
        const c = from + run * (i + 0.5);
        const p: [number, number, number] = alongZ ? [centre, h / 2, c] : [c, h / 2, centre];
        const s: [number, number, number] = alongZ ? [width, h, Math.abs(run)] : [Math.abs(run), h, width];
        return <Box key={i} p={p} s={s} color={i % 2 ? '#8d8a84' : '#999690'} rough={0.9} />;
      })}
      {/* daylight falling down the stairwell */}
      <Box p={alongZ ? [centre, rise + 0.02, to] : [to, rise + 0.02, centre]} s={alongZ ? [width, 0.02, 1.2] : [1.2, 0.02, width]} color="#fff6dc" emissive="#fff3d0" cast={false} />
    </group>
  );
}

function Lights() {
  // fluorescent strips along both walls
  return (
    <group>
      {Array.from({ length: 12 }, (_, i) => -22 + i * 4).map((x) =>
        ([-2.45, 2.45] as const).map((z) => (
          <Cutaway key={`${x}${z}`} axis="z" at={z} outward={z > 0 ? 1 : -1}>
            <Box p={[x, WALL_H - 0.12, z]} s={[2.2, 0.08, 0.1]} color="#eef6ff" emissive="#dfefff" cast={false} />
          </Cutaway>
        )),
      )}
    </group>
  );
}

const POSTERS: { x: number; z: number; text: string; bg: string; fg?: string }[] = [
  { x: -18, z: 2.58, text: 'KERAVAN\nKESÄKONSERTTI\nla 12.7.', bg: '#c94a5a' },
  { x: -6, z: 2.58, text: 'ÄLÄ OIKAISE\nRAITEIDEN YLI', bg: '#ffd23f', fg: '#14171f' },
  { x: 8, z: 2.58, text: 'KERAVA\n— PIENI KAUPUNKI,\nISOT JUTUT —', bg: '#2e6b4f' },
  { x: 18, z: 2.58, text: 'KIRPPIS\nSAVIOLLA\nSU 10–15', bg: '#3a5aa5' },
  { x: 2, z: -2.58, text: 'R / Z / K\nLAITURILLE ⬆', bg: '#1f3f8f' },
  { x: 14, z: -2.58, text: 'KIOSKI\nASEMAHALLISSA', bg: '#8a5a9e' },
];

const TAGS: { x: number; z: number; text: string; color: string; rot: number }[] = [
  { x: -21, z: -2.58, text: 'KRV 04200', color: '#ff5fa2', rot: 0 },
  { x: -1, z: -2.58, text: 'SAVIO 4EVER', color: '#4fd0ff', rot: 0 },
  { x: 12, z: 2.58, text: 'JONNE♥', color: '#7cff6b', rot: Math.PI },
  { x: 21, z: -2.58, text: 'TAG', color: '#ffb43c', rot: 0 },
];

function Busker() {
  const bones = useRef<HumanBones | null>(null);
  useFrame(({ clock }) => {
    const b = bones.current;
    if (!b) return;
    resetPose(b);
    poseLocomotion(b, 0, 0, clock.elapsedTime);
    // strumming
    b.upperArmR.rotation.set(-0.5, 0.3, -0.2);
    b.forearmR.rotation.x = -1.2 + Math.sin(clock.elapsedTime * 9) * 0.25;
    b.upperArmL.rotation.set(-0.7, -0.5, 0.3);
    b.forearmL.rotation.x = -1.5;
    b.head.rotation.z = Math.sin(clock.elapsedTime * 2) * 0.08;
  });
  return (
    <group position={[6, 0, 1.9]} rotation-y={Math.PI}>
      <Humanoid bonesRef={bones} outfit={{ top: '#6b4a2e', legs: '#2a2a33', shoes: '#3a2a1e', hair: '#2a1a10', hat: 'beanie', hatColor: '#9a2f2f', accent: '#e8c070' }} />
      {/* guitar */}
      <group position={[0.02, 1.05, 0.22]} rotation-z={-0.9}>
        <Box p={[0, 0, 0]} s={[0.36, 0.46, 0.09]} color="#a5622d" rough={0.4} />
        <Box p={[0, 0.48, 0]} s={[0.06, 0.55, 0.04]} color="#3a2a1e" />
      </group>
      {/* guitar case with coins */}
      <Box p={[0.6, 0.06, 0.6]} s={[0.4, 0.1, 1.0]} color="#1c1c22" />
      <Box p={[0.6, 0.12, 0.6]} s={[0.3, 0.02, 0.8]} color="#7a1f2a" cast={false} />
    </group>
  );
}

function Commuter({ x, z, yaw, outfit }: { x: number; z: number; yaw: number; outfit: Parameters<typeof Humanoid>[0]['outfit'] }) {
  const bones = useRef<HumanBones | null>(null);
  useFrame(({ clock }) => {
    const b = bones.current;
    if (!b) return;
    resetPose(b);
    poseLocomotion(b, 0, 0, clock.elapsedTime + x);
    if (outfit.prop === 'phone') posePhone(b, clock.elapsedTime);
  });
  return (
    <group position={[x, 0, z]} rotation-y={yaw}>
      <Humanoid bonesRef={bones} outfit={outfit} />
    </group>
  );
}

export function TunnelInterior() {
  const wallTex = useTileTexture('#e9e4d6', '#8fb3c9', 8, [24, 2]);
  const branchTex = useTileTexture('#e9e4d6', '#8fb3c9', 8, [4, 2]);
  const def = INTERIORS.tunnel;
  return (
    <group>
      {def.solids.map((r, i) => {
        const branch = r.minX >= TUNNEL_BRANCH.minX - 0.5 && r.maxX <= TUNNEL_BRANCH.maxX + 0.5 && r.maxZ <= TUNNEL_MAIN.minZ + 0.1;
        return <WallFromRect key={i} r={r} h={WALL_H} color="#ffffff" map={branch ? branchTex : wallTex} room={branch ? [-11.5, -5.8] : [0, 0]} />;
      })}
      {/* blue stripe along the walls */}
      {([-2.58, 2.58] as const).map((z) => (
        <Cutaway key={z} axis="z" at={z} outward={z > 0 ? 1 : -1}>
          <Box p={[0, 1.1, z]} s={[48, 0.18, 0.04]} color="#2f5fa8" cast={false} />
        </Cutaway>
      ))}
      <Stairs from={25.4} to={27.4} width={5.2} centre={0} />
      <Stairs from={-25.4} to={-27.4} width={5.2} centre={0} />
      <Stairs from={-8.4} to={-9.1} width={5} centre={-11.5} alongZ steps={4} rise={0.9} />
      <TextPanel p={[-11.5, 2.7, -8.95]} w={3.2} h={0.6} text="ASEMAHALLI ⬆" bg="#1f3f8f" />
      <Lights />
<Cutaway axis="z" at={2.6} outward={1}>
      {POSTERS.filter((p) => p.z > 0).map((p) => (
        <group key={p.x + ':' + p.z}>
          <Box p={[p.x, 1.75, p.z > 0 ? p.z - 0.02 : p.z + 0.02]} s={[1.6, 2.1, 0.04]} color="#3a3a3a" cast={false} />
          <TextPanel p={[p.x, 1.75, p.z > 0 ? p.z - 0.05 : p.z + 0.05]} rotY={p.z > 0 ? Math.PI : 0} w={1.45} h={1.95} text={p.text} bg={p.bg} fg={p.fg} />
        </group>
      ))}
      {TAGS.filter((t) => t.z > 0).map((t) => (
        <TextPanel key={t.text} p={[t.x, 0.9, t.z > 0 ? t.z - 0.03 : t.z + 0.03]} rotY={t.z > 0 ? Math.PI : 0} w={2.6} h={0.7} text={t.text} bg="#00000000" fg={t.color} font="italic 900 92px Impact, Arial Black, sans-serif" />
      ))}
</Cutaway>
<Cutaway axis="z" at={-2.6} outward={-1}>
      {POSTERS.filter((p) => p.z < 0).map((p) => (
        <group key={p.x + ':' + p.z}>
          <Box p={[p.x, 1.75, p.z > 0 ? p.z - 0.02 : p.z + 0.02]} s={[1.6, 2.1, 0.04]} color="#3a3a3a" cast={false} />
          <TextPanel p={[p.x, 1.75, p.z > 0 ? p.z - 0.05 : p.z + 0.05]} rotY={p.z > 0 ? Math.PI : 0} w={1.45} h={1.95} text={p.text} bg={p.bg} fg={p.fg} />
        </group>
      ))}
      {TAGS.filter((t) => t.z < 0).map((t) => (
        <TextPanel key={t.text} p={[t.x, 0.9, t.z > 0 ? t.z - 0.03 : t.z + 0.03]} rotY={t.z > 0 ? Math.PI : 0} w={2.6} h={0.7} text={t.text} bg="#00000000" fg={t.color} font="italic 900 92px Impact, Arial Black, sans-serif" />
      ))}
</Cutaway>
      <TextPanel p={[-23.9, 2.8, 0]} rotY={Math.PI / 2} w={3.6} h={0.55} text="⬆ KESKUSTA · ASEMA-AUKIO" bg="#1f3f8f" />
      <TextPanel p={[23.9, 2.8, 0]} rotY={-Math.PI / 2} w={3.6} h={0.55} text="⬆ SAVIO · RADAN ITÄPUOLI" bg="#1f3f8f" />
      {/* drain line and litter */}
      <Box p={[0, 0.01, 0]} s={[48, 0.01, 0.25]} color="#3a3d42" cast={false} />
      <Box p={[-9, 0.05, 1.8]} s={[0.12, 0.1, 0.12]} color="#c0392b" />
      <Box p={[15, 0.04, -1.6]} s={[0.3, 0.02, 0.2]} color="#e8e2c8" />
      <Busker />
      <Commuter x={-16} z={-1.2} yaw={0.6} outfit={{ top: '#2f3a55', legs: '#1f2533', shoes: '#ddd', hat: 'none', hair: '#c89a5a', hatColor: '#000', accent: '#fff', prop: 'phone', build: 0.94 }} />
      <Commuter x={17} z={0.8} yaw={-2.4} outfit={{ top: '#a84d2a', legs: '#3b4a6b', shoes: '#222', hat: 'cap', hatColor: '#14171f', accent: '#ffd23f', backpack: true }} />
    </group>
  );
}
