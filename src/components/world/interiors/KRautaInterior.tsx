import { useMemo } from 'react';
import { INTERIORS, KRAUTA_HALL, KRAUTA_RACK_XS } from '../../../game/interiors/interiors';
import { createRng } from '../../../game/world/random';
import { Box, Cutaway, InstancedBoxes, TextPanel, WallFromRect, useTileTexture, type V3 } from './kit';
import { Shopper } from './PrismaInterior';

const WALL_H = 6;
const ORANGE = '#e8731c';
const TIMBER = ['#d9b27a', '#cfa46a', '#c99a5c'];

/**
 * K-Rauta: a builders' merchant. Tall pallet racks with timber, cement and
 * insulation, a roof and window aisle, a paint counter, a garden corner with
 * fence panels and soil, and a sauna display with a stove.
 */
export function KRautaInterior() {
  const floor = useTileTexture('#a9aaa6', '#9d9e9a', 8, [7, 5], '#00000018');
  const def = INTERIORS.krauta;
  const goods = useMemo(() => {
    const rng = createRng(5150);
    const out: { p: V3; s: V3; c: string }[] = [];
    KRAUTA_RACK_XS.forEach((x, ri) => {
      for (const side of [-1, 1])
        for (let lvl = 0; lvl < 3; lvl++)
          for (let z = -7.4; z < 2.2; z += 1.3) {
            if (rng() < 0.12) continue;
            const y = 0.25 + lvl * 1.45;
            if (ri === 0) {
              // timber bundles, cement sacks, insulation packs
              if (lvl === 0) out.push({ p: [x + side * 0.45, y + 0.3, z + 0.6], s: [0.8, 0.55, 1.1], c: '#c9c2b2' });
              else if (lvl === 1) for (let k = 0; k < 5; k++) out.push({ p: [x + side * 0.45, y + 0.08 + k * 0.1, z + 0.6], s: [0.8, 0.09, 1.2], c: TIMBER[k % 3]! });
              else out.push({ p: [x + side * 0.45, y + 0.35, z + 0.6], s: [0.8, 0.65, 1.15], c: '#e8d65a' });
            } else if (ri === 1) {
              // roof sheets, window frames, boxed panels
              if (lvl === 0) for (let k = 0; k < 6; k++) out.push({ p: [x + side * 0.45, y + 0.05 + k * 0.05, z + 0.6], s: [0.85, 0.04, 1.2], c: '#7d8894' });
              else out.push({ p: [x + side * 0.45, y + 0.5, z + 0.6], s: [0.12, 0.95, 1.0], c: lvl === 1 ? '#f2f2f2' : '#1c2a4a' });
            } else {
              // paint buckets
              for (let k = 0; k < 4; k++) out.push({ p: [x + side * 0.45, y + 0.18, z + 0.15 + k * 0.3], s: [0.26, 0.32, 0.26], c: ['#9b2d20', '#e0b545', '#eeeae0', '#5d7c99', '#5f7f55', '#26282c'][Math.floor(rng() * 6)]! });
            }
          }
    });
    // timber on the back wall racks
    for (let x = -14; x < 14; x += 2.2) for (let k = 0; k < 8; k++) out.push({ p: [x + 1, 0.4 + k * 0.32, -10.2], s: [2, 0.2, 0.8], c: TIMBER[(k + Math.floor(x)) % 3 < 0 ? 0 : (k + Math.floor(x)) % 3]! });
    // garden corner: soil sacks and flower trays
    for (let i = 0; i < 12; i++) out.push({ p: [11 + (i % 4) * 0.8, 0.2 + Math.floor(i / 4) * 0.3, -2.2], s: [0.7, 0.28, 0.5], c: '#4a3524' });
    for (let i = 0; i < 16; i++) out.push({ p: [10.6 + (i % 8) * 0.5, 0.95, -6.5 + Math.floor(i / 8) * 0.6], s: [0.16, 0.16, 0.16], c: ['#e23b3b', '#ffd23f', '#f2efe6', '#e87ac0'][i % 4]! });
    return out;
  }, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.004} receiveShadow>
        <planeGeometry args={[KRAUTA_HALL.maxX - KRAUTA_HALL.minX, KRAUTA_HALL.maxZ - KRAUTA_HALL.minZ]} />
        <meshStandardMaterial map={floor} roughness={0.7} />
      </mesh>
      {def.solids.slice(0, 5).map((r, i) => (
        <WallFromRect key={i} r={r} h={WALL_H} color={i === 0 ? '#efece6' : '#e6e2da'} room={[0, 0]} />
      ))}
      <Cutaway axis="z" at={KRAUTA_HALL.minZ} outward={-1}>
        <TextPanel p={[0, 4.8, KRAUTA_HALL.minZ + 0.4]} w={10} h={0.9} text="K-RAUTA · RAKENTAJAN KAUPPA" bg={ORANGE} />
      </Cutaway>
      {/* pallet racks: orange uprights, blue beams */}
      {KRAUTA_RACK_XS.map((x, i) => (
        <group key={x}>
          {[-7.9, -2.7, 2.4].map((z) => [-0.85, 0.85].map((dx) => <Box key={`${z}${dx}`} p={[x + dx, 2.2, z]} s={[0.1, 4.4, 0.1]} color={ORANGE} metal={0.4} />))}
          {[0.22, 1.67, 3.12].map((y) => [-0.85, 0.85].map((dx) => <Box key={`${y}${dx}`} p={[x + dx, y, -2.75]} s={[0.08, 0.12, 10.4]} color="#2a4f9e" metal={0.4} />))}
          <TextPanel p={[x, 4.7, 2.6]} w={1.9} h={0.5} text={['RUNKO', 'KATOT', 'MAALIT'][i]!} bg={ORANGE} />
        </group>
      ))}
      <InstancedBoxes items={goods} />
      {/* garden corner with a fence panel display */}
      <Box p={[12.5, 0.05, -4.5]} s={[5, 0.1, 7]} color="#6b8a4a" />
      {[0, 1, 2].map((i) => (
        <group key={i} position={[10.4 + i * 1.6, 0, -7.6]}>
          {Array.from({ length: 6 }, (_, k) => <Box key={k} p={[-0.6 + k * 0.24, 0.9, 0]} s={[0.1, 1.8, 0.03]} color="#f2efe6" />)}
          <Box p={[0, 1.4, 0.04]} s={[1.5, 0.08, 0.04]} color="#e8e2d4" />
        </group>
      ))}
      <Box p={[12.5, 0.8, -6.5]} s={[4.6, 0.06, 1.4]} color="#8a6a3e" />
      <TextPanel p={[12.5, 3.2, -1.1]} w={3.2} h={0.5} text="PIHA JA PUUTARHA" bg="#2e7d4f" />
      {/* sauna display */}
      <group position={[-12, 0, 5]}>
        <Box p={[0, 1.2, -1]} s={[4.4, 2.4, 0.12]} color="#c99a5c" />
        <Box p={[-1.4, 0.5, -0.4]} s={[1.4, 0.08, 1]} color="#d9b27a" />
        <Box p={[-1.4, 0.9, -0.7]} s={[1.4, 0.08, 0.6]} color="#d9b27a" />
        <Box p={[1.2, 0.45, -0.4]} s={[0.6, 0.9, 0.5]} color="#3b3f46" metal={0.6} />
        <Box p={[1.2, 0.95, -0.4]} s={[0.5, 0.16, 0.4]} color="#6d6a66" />
        <TextPanel p={[0, 2.8, -0.9]} w={2.6} h={0.45} text="SAUNA · KIUKAAT" bg="#5a3a22" fg="#ffd23f" />
      </group>
      {/* checkout */}
      <Box p={[7.5, 0.55, 7.1]} s={[5, 1.1, 1.4]} color="#2a2d33" />
      <Box p={[7.5, 1.12, 7.1]} s={[5.2, 0.05, 1.5]} color="#c9ccd2" />
      <Shopper p={[8.5, 8.4]} yaw={Math.PI} outfit={{ top: ORANGE, legs: '#2b2f36', shoes: '#14171f', hair: '#2a1c12', hairStyle: 'short', facialHair: 'beard', hat: 'none', hatColor: '#000', accent: '#f2f2f2', style: 'jacket' }} />
      <Shopper p={[-5.2, 4.2]} yaw={0.6} sway={2} outfit={{ top: '#5f7f55', legs: '#3c4a63', shoes: '#5a3a22', hair: '#d8b070', hairStyle: 'ponytail', hat: 'none', hatColor: '#000', accent: '#ffd23f', style: 'jacket' }} />
      <Shopper p={[3.4, 3.6]} yaw={-0.8} sway={1} outfit={{ top: '#2b3a55', legs: '#1d2433', shoes: '#14171f', hair: '#9a9a9a', hairStyle: 'short', hat: 'cap', hatColor: ORANGE, accent: '#f2f2f2', style: 'jacket' }} />
      <pointLight position={[0, 5.2, -2]} intensity={18} distance={30} color="#fff6ea" />
      <pointLight position={[10, 5.2, 4]} intensity={8} distance={18} color="#fff6ea" />
    </group>
  );
}
