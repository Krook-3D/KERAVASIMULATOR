import type { WorldXZ } from './projection';
import type { BuildingCollider } from './collision';
import { createRng } from './random';
import { ROAD_WIDTH, inBounds, worldBounds, type WorldData } from './worldData';
import type { Terrain } from './terrain';

export interface PlacedProp {
  x: number;
  z: number;
  y?: number;
  /** Heading around Y (radians). */
  rotation: number;
  variant: number; // 0–1
}

const MAX_CARS = 260;
const MAX_LAMPS = 600;

/**
 * Street furniture along OSM roads: lamp posts on one side of each street and
 * parked cars along residential streets.
 */
export function placeStreetProps(world: WorldData, collider: BuildingCollider, exclude: (p: WorldXZ) => boolean, terrain?: Terrain | null) {
  const rng = createRng(2401);
  const lamps: PlacedProp[] = [];
  const cars: PlacedProp[] = [];
  const bounds = worldBounds(world);
  const ok = (x: number, z: number, clearance: number) =>
    inBounds(bounds, [x, z]) && !collider.isBlocked([x, z], clearance) && !exclude([x, z]);
  const y = (x: number, z: number) => (terrain ? terrain.surfaceAt(x, z) : 0);

  for (const road of world.roads) {
    if (road.kind !== 'street' && road.kind !== 'major') continue;
    const half = ROAD_WIDTH[road.kind] / 2;
    let lampCarry = rng() * 30;
    for (let i = 0; i < road.points.length - 1; i++) {
      const [ax, az] = road.points[i]!, [bx, bz] = road.points[i + 1]!;
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 2) continue;
      const ux = (bx - ax) / len, uz = (bz - az) / len;
      const px = -uz, pz = ux;
      const heading = Math.atan2(ux, uz);

      for (let t = lampCarry; t < len; t += 32) {
        const x = ax + ux * t + px * (half + 1.4), z = az + uz * t + pz * (half + 1.4);
        if (lamps.length < MAX_LAMPS && ok(x, z, 0.6)) lamps.push({ x, z, y: y(x, z), rotation: heading + Math.PI / 2, variant: 0 });
      }
      lampCarry = ((lampCarry - len) % 32 + 32) % 32;

      if (road.kind !== 'street') continue;
      for (let t = 6; t < len - 4; t += 7 + rng() * 14) {
        if (rng() > 0.3 || cars.length >= MAX_CARS) continue;
        const side = rng() < 0.5 ? 1 : -1;
        const x = ax + ux * t + px * side * (half - 1.3), z = az + uz * t + pz * side * (half - 1.3);
        if (ok(x, z, 1.2)) cars.push({ x, z, y: y(x, z), rotation: heading + (side < 0 ? Math.PI : 0), variant: rng() });
      }
    }
  }
  return { lamps, cars };
}

export interface Cloud {
  x: number;
  y: number;
  z: number;
  scale: number;
  puffs: [number, number, number, number][]; // local x, y, z, radius
}

export function placeClouds(): Cloud[] {
  const rng = createRng(77);
  return Array.from({ length: 28 }, () => {
    const a = rng() * Math.PI * 2;
    const d = 300 + rng() * 2200;
    const puffs: Cloud['puffs'] = Array.from({ length: 4 + Math.floor(rng() * 4) }, (_, i) => [
      (i - 2) * 22 + rng() * 10,
      rng() * 8,
      (rng() - 0.5) * 24,
      16 + rng() * 14,
    ]);
    return { x: Math.cos(a) * d, y: 260 + rng() * 160, z: Math.sin(a) * d, scale: 0.8 + rng() * 0.9, puffs };
  });
}
