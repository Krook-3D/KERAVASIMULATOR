import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { INTERIORS, PRISMA_CHECKOUT_XS, PRISMA_HALL, PRISMA_SHELF_XS, PRISMA_SHELF_Z } from '../../../game/interiors/interiors';
import { createRng } from '../../../game/world/random';
import { Humanoid, type HumanBones, type Outfit } from '../humanoid/Humanoid';
import { poseLocomotion, posePhone, resetPose } from '../humanoid/animate';
import { Box, Cutaway, InstancedBoxes, TextPanel, WallFromRect, type V3 } from './kit';

const WALL_H = 6;
const PRODUCT_COLORS = ['#e05555', '#ffd23f', '#3a7bd5', '#2e9e5b', '#f28c28', '#8a5a9e', '#f2f2f2', '#14171f', '#c97b4a', '#6fbfd8', '#d94f8a', '#9fc54a'];

function Spheres({ items }: { items: { p: V3; r: number; c: string; sy?: number }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.SphereGeometry(1, 10, 8), []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mat = new THREE.Matrix4();
    const col = new THREE.Color();
    items.forEach((it, i) => {
      mat.compose(new THREE.Vector3(...it.p), new THREE.Quaternion(), new THREE.Vector3(it.r, it.r * (it.sy ?? 1), it.r));
      m.setMatrixAt(i, mat);
      m.setColorAt(i, col.set(it.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [items]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <instancedMesh ref={ref} args={[geo, undefined, items.length]} castShadow>
      <meshStandardMaterial roughness={0.45} />
    </instancedMesh>
  );
}

export function Shopper({ p, yaw, outfit, phone, sway = 0 }: { p: [number, number]; yaw: number; outfit: Outfit; phone?: boolean; sway?: number }) {
  const bones = useRef<HumanBones | null>(null);
  useFrame(({ clock }) => {
    const b = bones.current;
    if (!b) return;
    resetPose(b);
    poseLocomotion(b, 0, 0, clock.elapsedTime + p[0] * 0.3);
    if (phone) posePhone(b, clock.elapsedTime);
    if (sway) b.head.rotation.y = Math.sin(clock.elapsedTime * 0.7 + sway) * 0.6;
  });
  return (
    <group position={[p[0], 0, p[1]]} rotation-y={yaw}>
      <Humanoid bonesRef={bones} outfit={outfit} />
    </group>
  );
}

function Cart({ x, z, rotY = 0 }: { x: number; z: number; rotY?: number }) {
  return (
    <group position={[x, 0, z]} rotation-y={rotY}>
      <Box p={[0, 0.7, 0]} s={[0.55, 0.45, 0.9]} color="#b9bcc2" metal={0.8} rough={0.3} opacity={0.75} />
      <Box p={[0, 1.05, -0.48]} s={[0.55, 0.05, 0.05]} color="#2e9e5b" />
      {[-0.22, 0.22].flatMap((dx) => [-0.35, 0.35].map((dz) => <Box key={`${dx}${dz}`} p={[dx, 0.08, dz]} s={[0.06, 0.12, 0.12]} color="#222" />))}
      <Box p={[0, 0.3, 0]} s={[0.5, 0.03, 0.8]} color="#9a9da3" metal={0.7} />
    </group>
  );
}

export function PrismaInterior() {
  const def = INTERIORS.prisma;
  const { products, fruit } = useMemo(() => {
    const rng = createRng(4004);
    const products: { p: V3; s: V3; c: string }[] = [];
    for (const x of PRISMA_SHELF_XS) {
      for (const side of [-1, 1]) {
        for (let lvl = 0; lvl < 5; lvl++) {
          const y = 0.25 + lvl * 0.42;
          let palette = PRODUCT_COLORS[Math.floor(rng() * PRODUCT_COLORS.length)]!;
          for (let z = PRISMA_SHELF_Z.minZ + 0.3; z < PRISMA_SHELF_Z.maxZ - 0.2; ) {
            const w = 0.18 + rng() * 0.22;
            const h = 0.16 + rng() * 0.2;
            if (rng() < 0.18) palette = PRODUCT_COLORS[Math.floor(rng() * PRODUCT_COLORS.length)]!;
            if (rng() > 0.06) products.push({ p: [x + side * 0.42, y + h / 2, z + w / 2], s: [0.4, h, w * 0.92], c: palette });
            z += w;
          }
        }
      }
    }
    // fridge goods along the back wall
    for (let lvl = 0; lvl < 4; lvl++)
      for (let x = -31.5; x < 31.5; x += 0.3) {
        const c = lvl === 0 ? '#f2f2f2' : PRODUCT_COLORS[Math.floor(rng() * PRODUCT_COLORS.length)]!;
        if (rng() > 0.1) products.push({ p: [x, 0.35 + lvl * 0.45, -21.15], s: [0.22, 0.26 + rng() * 0.1, 0.22], c });
      }
    // bread on the bakery counter
    for (let i = 0; i < 40; i++) products.push({ p: [-30.9 + rng() * 0.6, 1.08, -19.5 + rng() * 13], s: [0.25, 0.12, 0.4], c: rng() < 0.5 ? '#c98a4a' : '#8a5a32' });

    const fruit: { p: V3; r: number; c: string; sy?: number }[] = [];
    const tables: [number, number, string[]][] = [
      [-25, -0.5, ['#c0392b', '#d94f3a']],
      [-18, -0.5, ['#f28c28', '#ffa53a']],
      [-25, 5.5, ['#7cb342', '#9fc54a']],
      [-18, 5.5, ['#ffd23f', '#f5e04a']],
    ];
    for (const [tx, tz, cols] of tables)
      for (let i = 0; i < 140; i++)
        fruit.push({ p: [tx - 1.8 + rng() * 3.6, 0.98 + rng() * 0.12, tz - 1.3 + rng() * 2.6], r: 0.07 + rng() * 0.02, c: cols[i % 2]!, sy: cols[0] === '#ffd23f' ? 0.55 : 1 });
    return { products, fruit };
  }, []);

  return (
    <group>
      {/* walls: grey with a green band */}
      {def.solids.slice(0, 5).map((r, i) => (
        <group key={i}>
          <WallFromRect r={r} h={WALL_H} color="#d9d9d4" room={[0, 0]} />
          <group position-y={3.4}>
            <WallFromRect r={{ ...r, minZ: r.minZ - 0.02, maxZ: r.maxZ + 0.02, minX: r.minX - 0.02, maxX: r.maxX + 0.02 }} h={0.5} color="#2e9e5b" room={[0, 0]} hideLow />
          </group>
        </group>
      ))}
      {/* entrance: glass doors and windows on the south wall */}
      <Cutaway axis="z" at={PRISMA_HALL.maxZ} outward={1}>
        <Box p={[-20, 3.1, PRISMA_HALL.maxZ + 0.3]} s={[6.4, 0.25, 0.6]} color="#3a3f47" />
        {[-28, -6, 6, 18].map((x) => (
          <Box key={x} p={[x, 1.9, PRISMA_HALL.maxZ + 0.02]} s={[7, 2.6, 0.06]} color="#bcd8ea" emissive="#a9cde6" cast={false} />
        ))}
      </Cutaway>
      {[-24, -23, -22].map((x, i) => (
        <Cart key={x} x={x} z={19.5 + i * 0.25} rotY={0} />
      ))}
      <Box p={[-11.7, 0.5, 15.5]} s={[0.5, 1, 13]} color="#7a7f88" metal={0.6} rough={0.4} />

      {/* aisles */}
      {PRISMA_SHELF_XS.map((x) => (
        <group key={x}>
          <Box p={[x, 1.15, (PRISMA_SHELF_Z.minZ + PRISMA_SHELF_Z.maxZ) / 2]} s={[0.25, 2.3, PRISMA_SHELF_Z.maxZ - PRISMA_SHELF_Z.minZ]} color="#e8e8e4" />
          {[0, 1, 2, 3, 4].map((l) => (
            <Box key={l} p={[x, 0.22 + l * 0.42, (PRISMA_SHELF_Z.minZ + PRISMA_SHELF_Z.maxZ) / 2]} s={[1.3, 0.04, PRISMA_SHELF_Z.maxZ - PRISMA_SHELF_Z.minZ]} color="#cfd2d6" metal={0.4} cast={false} />
          ))}
          <Box p={[x, 0.08, (PRISMA_SHELF_Z.minZ + PRISMA_SHELF_Z.maxZ) / 2]} s={[1.4, 0.16, PRISMA_SHELF_Z.maxZ - PRISMA_SHELF_Z.minZ]} color="#2e9e5b" />
        </group>
      ))}
      <InstancedBoxes items={products} />
      {/* hanging aisle signs */}
      {['MAITO & JUUSTO', 'LEIPÄ & AAMIAINEN', 'PASTA & RIISI', 'JUOMAT', 'HERKUT', 'KOTI & PESU', 'LEMMIKIT'].map((t, i) => (
        <group key={t} position={[PRISMA_SHELF_XS[i]! + 2.75, 4.4, -5]}>
          <TextPanel p={[0, 0, 0]} rotY={Math.PI / 2} w={3.4} h={0.55} text={t} bg="#2e9e5b" />
          <TextPanel p={[0, 0, 0]} rotY={-Math.PI / 2} w={3.4} h={0.55} text={t} bg="#2e9e5b" />
        </group>
      ))}

      {/* fridges */}
      <Box p={[0, 1.1, -21.3]} s={[64, 2.2, 1.4]} color="#e9eef2" />
      <Box p={[0, 1.1, -20.58]} s={[63.6, 2.0, 0.04]} color="#dff2ff" emissive="#cfe9ff" opacity={0.35} cast={false} />
      <TextPanel p={[0, 3.0, -20.55]} w={12} h={0.8} text="MAITOTUOTTEET · LIHA · KALA" bg="#3a7bd5" />

      {/* bakery */}
      <Box p={[-31.2, 0.5, -13]} s={[1.6, 1.0, 14]} color="#8a5a32" />
      <Box p={[-31.2, 1.02, -13]} s={[1.7, 0.04, 14.1]} color="#e8d8b8" />
      <TextPanel p={[-31.9, 3.0, -13]} rotY={Math.PI / 2} w={6} h={0.8} text="LEIPOMO" bg="#c97b4a" />

      {/* fruit & vegetables */}
      {[[-25, -0.5], [-18, -0.5], [-25, 5.5], [-18, 5.5]].map(([x, z]) => (
        <group key={`${x}${z}`}>
          <Box p={[x!, 0.45, z!]} s={[4, 0.9, 3]} color="#7a5a3a" />
          <Box p={[x!, 0.92, z!]} s={[3.9, 0.04, 2.9]} color="#5a3a22" />
        </group>
      ))}
      <Spheres items={fruit} />
      <TextPanel p={[-21.5, 4.0, 2.5]} w={6} h={0.7} text="HEDELMÄT & VIHANNEKSET" bg="#7cb342" />

      {/* checkouts */}
      {PRISMA_CHECKOUT_XS.map((x, i) => (
        <group key={x}>
          <Box p={[x, 0.45, 12]} s={[1, 0.9, 4]} color="#3a3f47" />
          <Box p={[x - 0.15, 0.92, 11.4]} s={[0.6, 0.04, 2.6]} color="#14171f" rough={0.3} />
          <Box p={[x + 0.25, 1.15, 13.3]} s={[0.4, 0.4, 0.4]} color="#d9d9d4" />
          <Box p={[x + 0.25, 1.5, 13.3]} s={[0.35, 0.25, 0.04]} color="#6fbfff" emissive="#6fbfff" cast={false} />
          <Box p={[x, 2.4, 14]} s={[0.08, 4.8, 0.08]} color="#9a9da3" metal={0.6} />
          <TextPanel p={[x, 4.6, 14]} w={0.9} h={0.6} text={`${i + 1}`} bg="#2e9e5b" />
        </group>
      ))}
      {PRISMA_CHECKOUT_XS.slice(0, 4).map((x, i) => (
        <Shopper key={x} p={[x + 1.05, 13.2]} yaw={-Math.PI / 2} outfit={{ top: '#2e9e5b', legs: '#1f2533', shoes: '#222', hair: ['#d8b070', '#3b2a1e', '#a0a0a0', '#b07a3a'][i]!, hat: 'none', hatColor: '#000', accent: '#fff', build: i % 2 ? 0.92 : 1.02 }} />
      ))}
      <TextPanel p={[11.75, 5.2, 9]} w={10} h={0.9} text="KASSAT" bg="#2e9e5b" />

      {/* shoppers */}
      <Shopper p={[2.3, -6]} yaw={Math.PI / 2} outfit={{ top: '#8a5a9e', legs: '#3b4a6b', shoes: '#333', hair: '#b07a3a', hat: 'none', hatColor: '#000', accent: '#fff', skin: '#d9a77f', build: 0.92 }} sway={1} />
      <Shopper p={[13, -2]} yaw={-Math.PI / 2} outfit={{ top: '#3d6b4f', legs: '#2a2a33', shoes: '#fff', hair: '#1e1612', hat: 'beanie', hatColor: '#222', accent: '#e05555', prop: 'phone' }} phone />
      <Shopper p={[-21.5, 2.4]} yaw={0.4} outfit={{ top: '#e7d8b8', legs: '#5a4a3a', shoes: '#4a3020', hair: '#cfcfcf', hat: 'cap', hatColor: '#6f8fa8', accent: '#fff', build: 1.1 }} sway={2} />
      <Shopper p={[18.7, -18.6]} yaw={Math.PI} outfit={{ top: '#c0392b', legs: '#1f2533', shoes: '#f4f4f0', hat: 'none', hair: '#4a3222', hatColor: '#000', accent: '#fff' }} sway={3} />
      <Cart x={19.5} z={-17.8} rotY={0.3} />
    </group>
  );
}
