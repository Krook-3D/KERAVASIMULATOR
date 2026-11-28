import { useMemo } from 'react';
import { INTERIORS, MOTONET_HALL, MOTONET_SHELF_XS } from '../../../game/interiors/interiors';
import { createRng } from '../../../game/world/random';
import { SPRAY_COLORS } from '../../../data/items';
import { Box, Cutaway, InstancedBoxes, TextPanel, WallFromRect, useTileTexture, type V3 } from './kit';
import { Shopper } from './PrismaInterior';

const WALL_H = 5;
const RED = '#d4202a';
const PAINTS = Object.values(SPRAY_COLORS);

/** Car-parts and hardware store: spray paint aisle, tools, oils and a tyre wall. */
export function MotonetInterior() {
  const floor = useTileTexture('#b9bcc2', '#a8acb3', 10, [6, 4], '#00000022');
  const def = INTERIORS.motonet;
  const goods = useMemo(() => {
    const rng = createRng(909);
    const out: { p: V3; s: V3; c: string }[] = [];
    MOTONET_SHELF_XS.forEach((x, si) => {
      for (const side of [-1, 1])
        for (let lvl = 0; lvl < 5; lvl++)
          for (let z = -6.7; z < 2.7; z += si === 0 ? 0.12 : 0.36) {
            if (si === 0) {
              // spray cans in colour blocks
              const c = PAINTS[Math.floor(((z + 7) / 9.4) * PAINTS.length) % PAINTS.length]!;
              out.push({ p: [x + side * 0.42, 0.3 + lvl * 0.42 + 0.1, z], s: [0.08, 0.2, 0.08], c });
            } else {
              if (rng() < 0.15) continue;
              const h = 0.14 + rng() * 0.24;
              out.push({ p: [x + side * 0.4, 0.3 + lvl * 0.42 + h / 2, z], s: [0.34, h, 0.3], c: si === 1 ? ['#2a2d33', '#d4202a', '#ffd23f', '#3a7bd5'][Math.floor(rng() * 4)]! : ['#14171f', '#f28c28', '#2e9e5b', '#c8ccd2'][Math.floor(rng() * 4)]! });
            }
          }
    });
    // oil cans along the back
    for (let x = -13.4; x < 13.4; x += 0.4) for (let lvl = 0; lvl < 3; lvl++) out.push({ p: [x, 0.5 + lvl * 0.6, -9.3], s: [0.26, 0.36, 0.2], c: ['#14171f', '#ffd23f', '#2e9e5b', '#d4202a'][Math.floor(rng() * 4)]! });
    return out;
  }, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.004} receiveShadow>
        <planeGeometry args={[MOTONET_HALL.maxX - MOTONET_HALL.minX, MOTONET_HALL.maxZ - MOTONET_HALL.minZ]} />
        <meshStandardMaterial map={floor} roughness={0.55} />
      </mesh>
      {def.solids.slice(0, 5).map((r, i) => (
        <WallFromRect key={i} r={r} h={WALL_H} color={i === 0 ? '#ececec' : '#e2e2e2'} room={[0, 0]} />
      ))}
      <Cutaway axis="z" at={MOTONET_HALL.minZ} outward={-1}>
        <TextPanel p={[0, 4.0, MOTONET_HALL.minZ + 0.3]} w={8} h={0.8} text="ÖLJYT · RENKAAT · AKUT" bg={RED} />
      </Cutaway>
      {MOTONET_SHELF_XS.map((x, i) => (
        <group key={x}>
          <Box p={[x, 1.1, -2]} s={[0.3, 2.2, 10]} color="#7a7f86" metal={0.4} />
          {[0, 1, 2, 3, 4].map((lvl) => (
            <Box key={lvl} p={[x, 0.28 + lvl * 0.42, -2]} s={[1.2, 0.04, 10]} color="#9aa0a8" metal={0.5} />
          ))}
          <TextPanel p={[x, 2.75, 3.06]} w={1.4} h={0.45} text={['MAALIT', 'AUTO', 'TYÖKALUT'][i]!} bg={RED} />
        </group>
      ))}
      {/* tyre wall */}
      {Array.from({ length: 18 }, (_, i) => (
        <mesh key={i} position={[-12 + (i % 9) * 1.2, 0.6 + Math.floor(i / 9) * 1.2, -9.4]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.42, 0.18, 8, 18]} />
          <meshStandardMaterial color="#16181c" roughness={0.9} />
        </mesh>
      ))}
      {/* tool wall: pegboard with tools */}
      <Box p={[13.6, 2, -4]} s={[0.1, 3.6, 8]} color="#c9a46a" />
      {Array.from({ length: 24 }, (_, i) => (
        <Box key={i} p={[13.5, 0.8 + (i % 4) * 0.8, -7.4 + Math.floor(i / 4) * 1.2]} s={[0.06, 0.5, 0.12]} color={['#d4202a', '#2a2d33', '#ffd23f', '#9aa0a8'][i % 4]!} metal={0.5} />
      ))}
      <Box p={[11.8, 0.45, -4]} s={[1.8, 0.9, 7.6]} color="#5a5f66" metal={0.4} />
      <InstancedBoxes items={goods} />
      {/* building materials: boards, cement sacks, roof sheets, windows */}
      <Box p={[-13, 0.08, -2]} s={[1.9, 0.16, 9.6]} color="#8a6a3e" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Box key={`l${i}`} p={[-13.2, 0.24 + i * 0.1, -5.2]} s={[1.2, 0.09, 3.6]} color={i % 2 ? '#d9b27a' : '#cfa46a'} />
      ))}
      {[0, 1, 2].map((i) => [0, 1].map((j) => <Box key={`s${i}${j}`} p={[-13.4 + j * 0.62, 0.36 + i * 0.3, -2.2]} s={[0.58, 0.28, 0.9]} color="#c9c2b2" />))}
      {[0, 1, 2, 3].map((i) => (
        <Box key={`k${i}`} p={[-13.3, 0.5 + i * 0.05, 0.2]} s={[1.3, 0.04, 2.2]} color="#7d8894" metal={0.7} />
      ))}
      {[0, 1, 2].map((i) => (
        <group key={`w${i}`}>
          <Box p={[-13.75, 0.9, 1.6 + i * 0.35]} s={[0.1, 1.4, 0.08]} color="#f2f2f2" />
          <Box p={[-13.75, 0.9, 1.6 + i * 0.35]} s={[0.06, 1.2, 0.9]} color="#a9d4ea" opacity={0.5} cast={false} />
        </group>
      ))}
      <TextPanel p={[-12.2, 2.6, -2]} rotY={Math.PI / 2} w={2.6} h={0.5} text="RAKENNUSTARVIKKEET" bg={RED} />
      {/* checkout */}
      <Box p={[6.5, 0.55, 6.3]} s={[5, 1.1, 1.4]} color="#2a2d33" />
      <Box p={[6.5, 1.12, 6.3]} s={[5.2, 0.05, 1.5]} color="#c9ccd2" />
      <Shopper p={[7.5, 7.6]} yaw={Math.PI} outfit={{ top: RED, legs: '#1d2433', shoes: '#14171f', hair: '#6b4a2b', hairStyle: 'ponytail', hat: 'none', hatColor: '#000', accent: '#f2f2f2', style: 'jacket' }} />
      <Shopper p={[-4, 3.6]} yaw={0.4} sway={2} outfit={{ top: '#2b3a55', legs: '#3c4a63', shoes: '#5a3a22', hair: '#bfbfbf', hairStyle: 'short', facialHair: 'beard', hat: 'cap', hatColor: '#2e9e5b', accent: '#ffd23f', style: 'jacket' }} />
      <pointLight position={[0, 4.2, -2]} intensity={14} distance={26} color="#f4f8ff" />
    </group>
  );
}
