import { lngLatToWorld, type WorldXZ } from './projection';
import { pointInPolygon } from './collision';
import type { Building, WorldData } from './worldData';

/**
 * Prisma in Kerava city centre (Kauppakaari 2). With real OSM data the store
 * is found by name; otherwise it is placed at this approximate spot.
 */
export const PRISMA_FALLBACK_LNGLAT: [number, number] = [25.1006, 60.4036];
const FALLBACK_SIZE = { w: 74, d: 52, h: 11 };

export interface PrismaSite {
  footprint: WorldXZ[];
  centre: WorldXZ;
  /** Point just outside the entrance (where the player walks to). */
  door: WorldXZ;
  /** Unit vector pointing out of the building at the entrance. */
  outward: WorldXZ;
  height: number;
}

const centroid = (pts: WorldXZ[]): WorldXZ => {
  const s = pts.reduce<WorldXZ>((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
  return [s[0] / pts.length, s[1] / pts.length];
};

export function prismaRect(centre: WorldXZ, w = FALLBACK_SIZE.w, d = FALLBACK_SIZE.d): WorldXZ[] {
  const [x, z] = centre;
  return [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ];
}

/**
 * Finds (or creates) the Prisma building and returns the world with it
 * tagged `kind: 'prisma'`, plus where its entrance is. The entrance goes on the
 * wall facing the nearest street.
 */
export function placePrisma(world: WorldData): { buildings: Building[]; site: PrismaSite } {
  const landmark = world.landmarks?.find((l) => /prisma/i.test(l.name));
  let buildings = world.buildings;
  let building: Building | undefined;
  if (landmark) {
    const p: WorldXZ = [landmark.x, landmark.z];
    building =
      buildings.find((b) => pointInPolygon(p, b.footprint)) ??
      buildings
        .map((b) => ({ b, d: Math.hypot(centroid(b.footprint)[0] - p[0], centroid(b.footprint)[1] - p[1]) }))
        .filter((e) => e.d < 60 && e.b.footprint.length >= 4)
        .sort((a, b) => a.d - b.d)[0]?.b;
  }
  if (!building) building = buildings.find((b) => b.kind === 'prisma');
  if (!building) {
    const c = lngLatToWorld(PRISMA_FALLBACK_LNGLAT);
    const fp = prismaRect(c);
    // clear whatever stands there
    buildings = buildings.filter((b) => !b.footprint.some((q) => pointInPolygon(q, prismaRect(c, FALLBACK_SIZE.w + 16, FALLBACK_SIZE.d + 16))) && !pointInPolygon(centroid(b.footprint), fp));
    building = { footprint: fp, height: FALLBACK_SIZE.h, kind: 'prisma' };
    buildings = [...buildings, building];
  } else {
    const found = building;
    building = { ...found, kind: 'prisma', height: Math.max(found.height, 9) };
    buildings = buildings.map((b) => (b === found ? building! : b));
  }

  const site = findEntrance(building.footprint, world.roads, building.height);
  return { buildings, site };
}

/** Entrance on the longest-ish wall closest to a street. */
export function findEntrance(fp: WorldXZ[], roads: WorldData['roads'], height: number): PrismaSite {
  const centre = centroid(fp);
  const streetPts: WorldXZ[] = [];
  for (const r of roads) if (r.kind === 'street' || r.kind === 'major' || r.kind === 'path') streetPts.push(...r.points);
  let best = { score: Infinity, door: centre, outward: [0, 1] as WorldXZ };
  for (let i = 0; i < fp.length; i++) {
    const a = fp[i]!, b = fp[(i + 1) % fp.length]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 8) continue;
    const mid: WorldXZ = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let n: WorldXZ = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
    if ((mid[0] - centre[0]) * n[0] + (mid[1] - centre[1]) * n[1] < 0) n = [-n[0], -n[1]];
    let near = 400;
    for (const p of streetPts) near = Math.min(near, Math.hypot(p[0] - mid[0], p[1] - mid[1]));
    const score = near - len * 0.15;
    if (score < best.score) best = { score, door: [mid[0] + n[0] * 1.6, mid[1] + n[1] * 1.6], outward: n };
  }
  return { footprint: fp, centre, door: best.door, outward: best.outward, height };
}

/**
 * Puts a rectangular landmark building (gym, swimming hall, police station…)
 * at a spot, clearing whatever stood there, and finds its entrance.
 */
export function placeBlock(buildings: Building[], roads: WorldData['roads'], lngLat: [number, number], w: number, d: number, h: number, kind: string): { buildings: Building[]; site: PrismaSite } {
  const c = lngLatToWorld(lngLat);
  const fp = prismaRect(c, w, d);
  const clear = prismaRect(c, w + 14, d + 14);
  const kept = buildings.filter((b) => !b.footprint.some((q) => pointInPolygon(q, clear)) && !pointInPolygon(centroid(b.footprint), fp));
  const building: Building = { footprint: fp, height: h, kind };
  return { buildings: [...kept, building], site: findEntrance(fp, roads, h) };
}
