import { useMemo } from 'react';
import type { PrismaSite } from '../../game/world/prisma';
import type { WorldXZ } from '../../game/world/projection';
import { Box, TextPanel } from './interiors/kit';

/** Entrance canopy, glass doors and the big sign for Prisma. */
export function PrismaExterior({ site, ground }: { site: PrismaSite; ground: number }) {
  const yaw = Math.atan2(site.outward[0], site.outward[1]);
  const wall: WorldXZ = [site.door[0] - site.outward[0] * 1.6, site.door[1] - site.outward[1] * 1.6];
  return (
    <group position={[wall[0], ground, wall[1]]} rotation-y={yaw}>
      {/* glass entrance */}
      <Box p={[0, 1.6, 0.06]} s={[6.5, 3.2, 0.1]} color="#bcd8ea" rough={0.15} metal={0.4} opacity={0.6} />
      <Box p={[0, 1.6, 0.1]} s={[0.08, 3.2, 0.06]} color="#3a3f47" />
      {/* canopy */}
      <Box p={[0, 3.6, 2.2]} s={[9, 0.3, 4.6]} color="#3a3f47" />
      {[-4.2, 4.2].map((x) => (
        <Box key={x} p={[x, 1.75, 4.3]} s={[0.2, 3.5, 0.2]} color="#3a3f47" />
      ))}
      <TextPanel p={[0, 3.6, 4.52]} w={8.6} h={0.28} text="TERVETULOA" bg="#2e9e5b" />
      {/* big sign on the facade */}
      <TextPanel p={[0, site.height - 1.6, 0.12]} w={12} h={2.6} text="Prisma" bg="#2e9e5b" font="800 150px Rubik, Arial, sans-serif" glow />
      {/* trolley shelter and flower boxes */}
      <Box p={[7.5, 1.1, 2.5]} s={[4, 2.2, 1.6]} color="#c8ccd2" metal={0.6} rough={0.4} opacity={0.5} />
      {[-6.5, -8.5].map((x) => (
        <Box key={x} p={[x, 0.35, 1.2]} s={[1.6, 0.7, 0.8]} color="#7a5a3a" />
      ))}
    </group>
  );
}

/** Keravan vankila: low concrete block, fence and a sign. */
export function PrisonExterior({ at, yaw, ground }: { at: WorldXZ; yaw: number; ground: number }) {
  const posts = useMemo(() => {
    const out: [number, number][] = [];
    for (let x = -30; x <= 30; x += 4) out.push([x, -22], [x, 22]);
    for (let z = -18; z <= 18; z += 4) out.push([-30, z], [30, z]);
    return out.filter(([x, z]) => !(z === 22 && Math.abs(x) < 5));
  }, []);
  return (
    <group position={[at[0], ground, at[1]]} rotation-y={yaw}>
      <Box p={[0, 3.5, -4]} s={[36, 7, 18]} color="#a9a49b" />
      <Box p={[0, 7.1, -4]} s={[36.4, 0.3, 18.4]} color="#6b6f76" />
      {Array.from({ length: 9 }, (_, i) => -16 + i * 4).map((x) => (
        <Box key={x} p={[x, 4.6, 5.02]} s={[1.0, 0.45, 0.06]} color="#2d4256" metal={0.5} rough={0.2} cast={false} />
      ))}
      <Box p={[0, 1.3, 5.05]} s={[2, 2.6, 0.1]} color="#6b7480" metal={0.6} />
      <TextPanel p={[0, 3.2, 5.1]} w={6} h={0.8} text="KERAVAN VANKILA" bg="#3a3f47" />
      {posts.map(([x, z]) => (
        <Box key={`${x},${z}`} p={[x, 1.6, z]} s={[0.12, 3.2, 0.12]} color="#8a8f96" metal={0.7} />
      ))}
      {[-22, 22].map((z) => (
        <group key={z}>
          <Box p={[z < 0 ? 0 : -17.5, 1.6, z]} s={[z < 0 ? 60 : 25, 3, 0.03]} color="#c8ccd2" metal={0.6} opacity={0.35} cast={false} />
          {z > 0 && <Box p={[17.5, 1.6, z]} s={[25, 3, 0.03]} color="#c8ccd2" metal={0.6} opacity={0.35} cast={false} />}
          <Box p={[0, 3.3, z]} s={[60, 0.15, 0.15]} color="#8a8f96" metal={0.7} />
        </group>
      ))}
      {[-30, 30].map((x) => (
        <Box key={x} p={[x, 1.6, 0]} s={[0.03, 3, 44]} color="#c8ccd2" metal={0.6} opacity={0.35} cast={false} />
      ))}
    </group>
  );
}

/** Glass entrance, canopy and a facade sign for a landmark block (gym, swimming hall…). */
export function BlockExterior({ site, ground, sign, color, sub }: { site: PrismaSite; ground: number; sign: string; color: string; sub?: string }) {
  const yaw = Math.atan2(site.outward[0], site.outward[1]);
  const wall: WorldXZ = [site.door[0] - site.outward[0] * 1.6, site.door[1] - site.outward[1] * 1.6];
  return (
    <group position={[wall[0], ground, wall[1]]} rotation-y={yaw}>
      <Box p={[0, 1.4, 0.06]} s={[3.6, 2.8, 0.1]} color="#bcd8ea" rough={0.15} metal={0.4} opacity={0.6} />
      <Box p={[0, 3.05, 1.3]} s={[5, 0.2, 2.6]} color="#3a3f47" />
      {[-2.3, 2.3].map((x) => (
        <Box key={x} p={[x, 1.5, 2.5]} s={[0.14, 3, 0.14]} color="#3a3f47" />
      ))}
      <TextPanel p={[0, site.height - 1.3, 0.12]} w={Math.min(14, 1.1 * sign.length + 2)} h={1.6} text={sign} bg={color} font="900 96px Rubik, Arial Black, sans-serif" glow />
      {sub && <TextPanel p={[0, 3.05, 2.62]} w={4.8} h={0.2} text={sub} bg="#14171f" font="700 40px Rubik, Arial" />}
    </group>
  );
}
