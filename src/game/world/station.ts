import type { WorldXZ } from './projection';
import type { Building, WorldData } from './worldData';

/**
 * Kerava station layout. Everything is defined in a local frame:
 *   local +x = along the track, local +z = towards the platform, origin on the
 *   track centre line nearest to the world origin.
 * The frame is derived from the rail geometry, so the station lines up with
 * real OSM tracks as well as with the placeholder town.
 */
export const PLATFORM = { minX: -75, maxX: 75, minZ: 1.9, maxZ: 9, height: 0.55 };
export const STATION_BUILDING = { minX: -14, maxX: 14, minZ: 13, maxZ: 23 };
/** Area cleared of OSM buildings and trees. */
const CLEAR_ZONE = { minX: -85, maxX: 85, minZ: -2.5, maxZ: 30 };

/** Train stop: door positions along local x on the platform side. */
export const TRAIN = { carLength: 26, carGap: 0.8, cars: 3 };
export const DOOR_XS = [-35.5, -18.5, -9, 9, 18.5, 35.5];
export const INTRO_DOOR_X = 9;

export interface StationLayout {
  /** World position of the local origin. */
  origin: WorldXZ;
  /** Unit vector of local +x in world space. */
  dirX: WorldXZ;
  /** Unit vector of local +z in world space. */
  dirZ: WorldXZ;
  /** Y rotation for a three.js group so local axes match. */
  rotationY: number;
}

export function toWorld(layout: StationLayout, [lx, lz]: WorldXZ): WorldXZ {
  const { origin, dirX, dirZ } = layout;
  return [origin[0] + dirX[0] * lx + dirZ[0] * lz, origin[1] + dirX[1] * lx + dirZ[1] * lz];
}

export function toLocal(layout: StationLayout, [x, z]: WorldXZ): WorldXZ {
  const dx = x - layout.origin[0], dz = z - layout.origin[1];
  return [dx * layout.dirX[0] + dz * layout.dirX[1], dx * layout.dirZ[0] + dz * layout.dirZ[1]];
}

const inside = (r: { minX: number; maxX: number; minZ: number; maxZ: number }, [x, z]: WorldXZ) =>
  x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

function nearestRailSegment(world: WorldData): { p: WorldXZ; dir: WorldXZ } {
  let best = Infinity;
  let p: WorldXZ = [0, 0];
  let dir: WorldXZ = [0, 1];
  for (const r of world.roads) {
    if (r.kind !== 'rail') continue;
    for (let i = 0; i < r.points.length - 1; i++) {
      const [ax, az] = r.points[i]!, [bx, bz] = r.points[i + 1]!;
      const dx = bx - ax, dz = bz - az;
      const l2 = dx * dx + dz * dz;
      if (l2 < 1) continue;
      const t = Math.max(0, Math.min(1, -(ax * dx + az * dz) / l2));
      const cx = ax + dx * t, cz = az + dz * t;
      const d = Math.hypot(cx, cz);
      if (d < best) {
        best = d;
        p = [cx, cz];
        const len = Math.sqrt(l2);
        dir = [dx / len, dz / len];
      }
    }
  }
  return { p, dir };
}

/** Counts other rail points on a side of the track, to put the platform on the free side. */
function railsOnSide(world: WorldData, origin: WorldXZ, dirX: WorldXZ, dirZ: WorldXZ): number {
  let n = 0;
  for (const r of world.roads) {
    if (r.kind !== 'rail') continue;
    for (const [x, z] of r.points) {
      const dx = x - origin[0], dz = z - origin[1];
      const lx = dx * dirX[0] + dz * dirX[1];
      const lz = dx * dirZ[0] + dz * dirZ[1];
      if (Math.abs(lx) < 120 && lz > 2 && lz < 25) n++;
    }
  }
  return n;
}

export function computeStationLayout(world: WorldData): StationLayout {
  const { p, dir } = nearestRailSegment(world);
  let dirX = dir;
  let dirZ: WorldXZ = [-dir[1], dir[0]];
  if (railsOnSide(world, p, dirX, dirZ) > railsOnSide(world, p, [-dirX[0], -dirX[1]], [dir[1], -dir[0]])) {
    dirX = [-dirX[0], -dirX[1]];
    dirZ = [-dirZ[0], -dirZ[1]];
  }
  // three.js: rotation θ maps local +x to (cosθ, -sinθ) and local +z to (sinθ, cosθ).
  const rotationY = Math.atan2(-dirX[1], dirX[0]);
  return { origin: p, dirX, dirZ, rotationY };
}

/** Drops OSM buildings that would overlap our hand-built station. */
export function clearStationArea(layout: StationLayout, buildings: Building[]): Building[] {
  return buildings.filter((b) => {
    const c = b.footprint.reduce<WorldXZ>((a, q) => [a[0] + q[0], a[1] + q[1]], [0, 0]);
    const centroid: WorldXZ = [c[0] / b.footprint.length, c[1] / b.footprint.length];
    return !inside(CLEAR_ZONE, toLocal(layout, centroid));
  });
}

export function isInStationClearZone(layout: StationLayout, p: WorldXZ): boolean {
  return inside(CLEAR_ZONE, toLocal(layout, p));
}

/** Ground height for walking: the platform is raised. */
export function stationGroundHeight(layout: StationLayout, p: WorldXZ): number {
  return inside(PLATFORM, toLocal(layout, p)) ? PLATFORM.height : 0;
}

/** Station building footprint in world space, for collision. */
export function stationFootprints(layout: StationLayout): WorldXZ[][] {
  const b = STATION_BUILDING;
  return [[[b.minX, b.minZ], [b.maxX, b.minZ], [b.maxX, b.maxZ], [b.minX, b.maxZ]].map((q) => toWorld(layout, q as WorldXZ))];
}

/** Where a new player steps out of the train and where they walk to. */
export function introPoints(layout: StationLayout): { door: WorldXZ; platform: WorldXZ } {
  return { door: toWorld(layout, [INTRO_DOOR_X, 1.75]), platform: toWorld(layout, [INTRO_DOOR_X - 1.5, 5.5]) };
}
