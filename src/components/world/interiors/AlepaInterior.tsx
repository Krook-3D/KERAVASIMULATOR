import { useMemo } from 'react';
import { ALEPA_HALL, ALEPA_SHELF_XS, INTERIORS } from '../../../game/interiors/interiors';
import { createRng } from '../../../game/world/random';
import { Box, Cutaway, InstancedBoxes, TextPanel, WallFromRect, useTileTexture, type V3 } from './kit';
import { Shopper } from './PrismaInterior';

const WALL_H = 3.6;
const ORANGE = '#f28c28';
const COLORS = ['#e05555', '#ffd23f', '#3a7bd5', '#2e9e5b', '#f28c28', '#8a5a9e', '#f2f2f2', '#14171f', '#c97b4a', '#6fbfd8'];

/** A small neighbourhood grocery: three aisles, fridges, bread corner, one till. */
export function AlepaInterior() {
  const floor = useTileTexture('#e6e1d6', '#d6d0c2', 8, [5, 4], '#00000022', true);
  const def = INTERIORS.alepa;
  const goods = useMemo(() => {
    const rng = createRng(77);
    const out: { p: V3; s: V3; c: string }[] = [];
    for (const x of ALEPA_SHELF_XS)
      for (const side of [-1, 1])
        for (let lvl = 0; lvl < 4; lvl++)
          for (let z = -4.3; z < 2.3; z += 0.34) {
            if (rng() < 0.12) continue;
            const h = 0.18 + rng() * 0.18;
            out.push({ p: [x + side * 0.3, 0.32 + lvl * 0.42 + h / 2, z], s: [0.26, h, 0.26], c: COLORS[Math.floor(rng() * COLORS.length)]! });
          }
    for (let x = -9.4; x < 9.6; x += 0.32)
      for (let lvl = 0; lvl < 4; lvl++) out.push({ p: [x, 0.35 + lvl * 0.42, -6.35], s: [0.22, 0.28, 0.22], c: lvl === 0 ? '#f2f2f2' : COLORS[Math.floor(rng() * COLORS.length)]! });
    for (let z = -5.6; z < 0.8; z += 0.4)
      for (let lvl = 0; lvl < 3; lvl++) out.push({ p: [9.5, 0.6 + lvl * 0.45, z], s: [0.32, 0.18, 0.34], c: lvl === 2 ? '#c97b4a' : lvl === 1 ? '#e8c070' : '#9fc54a' });
    return out;
  }, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.004} receiveShadow>
        <planeGeometry args={[ALEPA_HALL.maxX - ALEPA_HALL.minX, ALEPA_HALL.maxZ - ALEPA_HALL.minZ]} />
        <meshStandardMaterial map={floor} roughness={0.6} />
      </mesh>
      {def.solids.slice(0, 5).map((r, i) => (
        <WallFromRect key={i} r={r} h={WALL_H} color={i === 0 ? '#f4efe2' : '#efe6d2'} room={[0, 0]} />
      ))}
      <Cutaway axis="z" at={-7} outward={-1}>
        <TextPanel p={[0, 3.0, -6.95]} w={6} h={0.6} text="MAITO · JUUSTO · VALMISRUOKA" bg={ORANGE} />
      </Cutaway>
      {/* aisles */}
      {ALEPA_SHELF_XS.map((x) => (
        <group key={x}>
          <Box p={[x, 0.9, -1]} s={[0.3, 1.8, 7]} color="#d8d4cc" />
          {[0, 1, 2, 3].map((lvl) => (
            <Box key={lvl} p={[x, 0.3 + lvl * 0.42, -1]} s={[1.0, 0.04, 7]} color="#bfbab0" />
          ))}
          <Box p={[x, 0.08, -1]} s={[1.0, 0.16, 7]} color="#5a5f68" />
          <Box p={[x, 1.95, -1]} s={[0.12, 0.3, 7]} color={ORANGE} />
        </group>
      ))}
      {/* fridges */}
      <Box p={[0, 1.0, -6.6]} s={[20, 2.0, 0.9]} color="#e6eef2" metal={0.3} />
      <Box p={[0, 1.0, -6.12]} s={[19.6, 1.8, 0.04]} color="#cfe6f2" opacity={0.35} cast={false} />
      {/* bread + veg corner */}
      <Box p={[9.3, 0.45, -2.5]} s={[1.2, 0.9, 7]} color="#a5713e" />
      <TextPanel p={[8.65, 2.2, -2.5]} rotY={-Math.PI / 2} w={2.6} h={0.5} text="LEIPÄ & HEDELMÄT" bg={ORANGE} />
      <InstancedBoxes items={goods} />
      {/* till */}
      <Box p={[5.6, 0.5, 4.55]} s={[4, 1.0, 1.1]} color="#5a5f68" />
      <Box p={[4.2, 1.15, 4.55]} s={[0.4, 0.3, 0.3]} color="#14171f" />
      <Box p={[6.8, 1.2, 4.2]} s={[1.1, 0.8, 0.5]} color="#c0392b" />
      <TextPanel p={[6.8, 1.75, 3.94]} rotY={Math.PI} w={1.0} h={0.25} text="Tupakka & snus" bg="#14171f" font="700 34px Rubik, Arial" />
      <TextPanel p={[5.6, 2.6, 4.1]} rotY={Math.PI} w={2.2} h={0.4} text="KASSA" bg={ORANGE} />
      <Shopper p={[5.4, 5.6]} yaw={Math.PI} outfit={{ top: ORANGE, legs: '#1f2533', shoes: '#222', hair: '#3a2a1e', hat: 'none', hatColor: '#000', accent: '#fff' }} />
      <Shopper p={[-3.5, 0.5]} yaw={Math.PI / 2} outfit={{ top: '#4a6b8a', legs: '#2a2a33', shoes: '#eee', hat: 'beanie', hatColor: '#2e9e5b', hair: '#a0a0a0', accent: '#fff', build: 1.1 }} phone />
      {/* door mat + baskets */}
      <Box p={[-6.5, 0.01, 5.8]} s={[2.4, 0.02, 1.6]} color="#3a3d42" cast={false} />
      {[0, 1, 2].map((i) => (
        <Box key={i} p={[-8.6, 0.15 + i * 0.12, 5.9]} s={[0.5, 0.12, 0.35]} color={ORANGE} />
      ))}
    </group>
  );
}
