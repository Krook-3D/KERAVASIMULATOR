import type { WorldXZ } from './projection';
import { BuildingCollider, pointInPolygon } from './collision';
import { createRng } from './random';
import { RoadIndex } from './vegetation';
import { ROAD_WIDTH, inBounds, worldBounds, type Area, type WorldData } from './worldData';
import type { Terrain } from './terrain';
import { RARITY_WEIGHT, WORLD_LOOT } from '../../data/items';
import type { Rarity } from '../../types/game';

/** A pickup lying on the ground somewhere in town. */
export interface LootSpot {
  id: string;
  itemId: string;
  x: number;
  y: number;
  z: number;
}

const COUNT = { forest: 70, park: 30, street: 50 };
/** Rare finds are more likely off the beaten path. */
const FOREST_BOOST: Partial<Record<Rarity, number>> = { rare: 1.8, epic: 2.4, legendary: 3 };

function pickItem(rng: () => number, boost: Partial<Record<Rarity, number>>): string {
  const weights = WORLD_LOOT.map((i) => RARITY_WEIGHT[i.rarity] * (boost[i.rarity] ?? 1));
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < WORLD_LOOT.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return WORLD_LOOT[i]!.id;
  }
  return WORLD_LOOT[0]!.id;
}

function bbox(a: Area) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of a.outline) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  return { minX, maxX, minZ, maxZ, area: (maxX - minX) * (maxZ - minZ) };
}

/**
 * Deterministically scatters loot over the map: mostly in forests (where the
 * rarer stuff hides), some in parks and some by the kerbs. Ids are stable
 * between reloads so picked-up spots stay picked.
 */
export function placeLoot(world: WorldData, collider: BuildingCollider, exclude?: (p: WorldXZ) => boolean, terrain?: Terrain | null): LootSpot[] {
  const rng = createRng(4040);
  const roads = new RoadIndex(world.roads);
  const bounds = worldBounds(world);
  const out: LootSpot[] = [];
  const ok = (x: number, z: number, roadMargin: number) => {
    if (!inBounds(bounds, [x, z]) || roads.near([x, z], roadMargin) || collider.isBlocked([x, z], 1.5) || exclude?.([x, z])) return false;
    if (terrain && terrain.heightAt(x, z) < terrain.surfaceAt(x, z) - 0.25) return false; // water
    return true;
  };
  const add = (kind: string, x: number, z: number, boost: Partial<Record<Rarity, number>>) =>
    out.push({ id: `${kind}${out.length}`, itemId: pickItem(rng, boost), x, z, y: terrain ? terrain.heightAt(x, z) : 0 });

  const scatter = (areas: Area[], n: number, kind: string, boost: Partial<Record<Rarity, number>>) => {
    const boxes = areas.map(bbox);
    const total = boxes.reduce((a, b) => a + b.area, 0);
    if (!total) return;
    for (let k = 0, tries = 0; k < n && tries < n * 40; tries++) {
      // pick an area weighted by size
      let r = rng() * total, i = 0;
      while (i < boxes.length - 1 && (r -= boxes[i]!.area) > 0) i++;
      const b = boxes[i]!;
      const x = b.minX + rng() * (b.maxX - b.minX), z = b.minZ + rng() * (b.maxZ - b.minZ);
      if (!pointInPolygon([x, z], areas[i]!.outline) || !ok(x, z, 2)) continue;
      add(kind, x, z, boost);
      k++;
    }
  };
  scatter(world.forests ?? [], COUNT.forest, 'f', FOREST_BOOST);
  scatter(world.parks, COUNT.park, 'p', {});

  // kerbside junk: a few metres off a random street point
  const streets = world.roads.filter((r) => r.kind === 'street' || r.kind === 'major' || r.kind === 'path');
  for (let k = 0, tries = 0; k < COUNT.street && streets.length && tries < COUNT.street * 40; tries++) {
    const road = streets[Math.floor(rng() * streets.length)]!;
    const i = Math.floor(rng() * (road.points.length - 1));
    const a = road.points[i], b = road.points[i + 1];
    if (!a || !b) continue;
    const t = rng(), dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1;
    const half = ROAD_WIDTH[road.kind] / 2 + (road.kind === 'path' ? 0.5 : 2.4);
    const off = (half + 0.8 + rng() * 1.5) * (rng() < 0.5 ? -1 : 1);
    const x = a[0] + dx * t - (dz / len) * off, z = a[1] + dz * t + (dx / len) * off;
    if (!ok(x, z, 0.2)) continue;
    add('s', x, z, { rare: 0.5, epic: 0.3, legendary: 0.2 });
    k++;
  }
  return out;
}
