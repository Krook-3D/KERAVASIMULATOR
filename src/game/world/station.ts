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

/**
 * Footbridge over the tracks just past the north end of the platform:
 * stairs up from the station side, a deck across the rails, stairs down on
 * the far side. Walkable corridor along local z at x = BRIDGE.x ± halfWidth.
 */
export const BRIDGE = {
  x: 84,
  halfWidth: 1.5,
  deck: 7.2,
  /** Station-side stairs run from footNear (ground) to topNear (deck). */
  footNear: 15.5,
  topNear: 5,
  /** Far-side stairs from topFar (deck) to footFar (ground). */
  topFar: -11,
  footFar: -21.5,
};
/** Stair openings down to the pedestrian tunnel (station-local). */
export const TUNNEL_ENTRANCES = [
  { id: 'tunnel-town' as const, x: -32, z: 18, rotY: 0 },
  { id: 'tunnel-east' as const, x: -32, z: -15, rotY: Math.PI },
];

const BRIDGE_CLEAR = { minX: BRIDGE.x - 8, maxX: BRIDGE.x + 8, minZ: BRIDGE.footFar - 6, maxZ: BRIDGE.footNear + 6 };

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
    const l = toLocal(layout, centroid);
    return !inside(CLEAR_ZONE, l) && !inside(BRIDGE_CLEAR, l) && !b.footprint.some((q) => inside(BRIDGE_CLEAR, toLocal(layout, q)));
  });
}

export function isInStationClearZone(layout: StationLayout, p: WorldXZ): boolean {
  const l = toLocal(layout, p);
  return inside(CLEAR_ZONE, l) || inside(BRIDGE_CLEAR, l);
}

const inCorridor = ([lx, lz]: WorldXZ) => Math.abs(lx - BRIDGE.x) <= BRIDGE.halfWidth && lz <= BRIDGE.footNear && lz >= BRIDGE.footFar;

/** Is this world point on the footbridge (stairs or deck)? */
export function onBridge(layout: StationLayout, p: WorldXZ): boolean {
  return inCorridor(toLocal(layout, p));
}

/** Walking height on the bridge for a point inside the corridor. */
function bridgeHeight([, lz]: WorldXZ): number {
  if (lz >= BRIDGE.topNear) return BRIDGE.deck * (1 - (lz - BRIDGE.topNear) / (BRIDGE.footNear - BRIDGE.topNear));
  if (lz <= BRIDGE.topFar) return BRIDGE.deck * (1 - (BRIDGE.topFar - lz) / (BRIDGE.topFar - BRIDGE.footFar));
  return BRIDGE.deck;
}

/**
 * Blocks stepping on or off the bridge anywhere except at the foot of the
 * stairs (no climbing up the side of the stairs or jumping off the deck).
 */
export function bridgeBlocked(layout: StationLayout, to: WorldXZ, from: WorldXZ): boolean {
  const a = toLocal(layout, from), b = toLocal(layout, to);
  const ia = inCorridor(a), ib = inCorridor(b);
  if (ia === ib) return false;
  const lz = ia ? a[1] : b[1];
  return !(lz > BRIDGE.footNear - 1.2 || lz < BRIDGE.footFar + 1.2);
}

/** Where to walk to get onto the bridge from either side (just outside the stair foot). */
export function bridgeFeet(layout: StationLayout): { near: WorldXZ; far: WorldXZ; nearIn: WorldXZ; farIn: WorldXZ } {
  return {
    near: toWorld(layout, [BRIDGE.x, BRIDGE.footNear + 1]),
    far: toWorld(layout, [BRIDGE.x, BRIDGE.footFar - 1]),
    nearIn: toWorld(layout, [BRIDGE.x, BRIDGE.footNear - 0.4]),
    farIn: toWorld(layout, [BRIDGE.x, BRIDGE.footFar + 0.4]),
  };
}

/**
 * Simple route planning around the tracks: crossing from one side to the
 * other goes over the footbridge; stepping onto the bridge goes via the
 * nearest stair foot.
 */
export function planRoute(layout: StationLayout, from: WorldXZ, to: WorldXZ): WorldXZ[] {
  const a = toLocal(layout, from), b = toLocal(layout, to);
  const feet = bridgeFeet(layout);
  const side = (l: WorldXZ) => (l[1] > TRACK_ZONE.maxZ ? 1 : l[1] < TRACK_ZONE.minZ ? -1 : 0);
  const nearTracks = (l: WorldXZ) => Math.abs(l[0]) < TRACK_ZONE.maxX + 40;
  const ia = inCorridor(a), ib = inCorridor(b);
  if (ia && ib) return [to];
  if (ia && !ib) {
    // leave by the stairs on the side of the target
    return b[1] > 0 ? [feet.nearIn, feet.near, to] : [feet.farIn, feet.far, to];
  }
  if (!ia && ib) return b[1] > (BRIDGE.topNear + BRIDGE.topFar) / 2 || a[1] > 0 ? [feet.near, feet.nearIn, to] : [feet.far, feet.farIn, to];
  const sa = side(a), sb = side(b);
  if (sa !== 0 && sb !== 0 && sa !== sb && nearTracks(a) && nearTracks(b) && Math.abs(b[0] - a[0]) < 400) {
    return sa > 0 ? [feet.near, feet.nearIn, feet.farIn, feet.far, to] : [feet.far, feet.farIn, feet.nearIn, feet.near, to];
  }
  return [to];
}

/** Track bed next to the platform: off limits (no walking onto the rails or through the train). */
const TRACK_ZONE = { minX: -95, maxX: 95, minZ: -5, maxZ: PLATFORM.minZ + 0.3 };

export function isTrackBlocked(layout: StationLayout, p: WorldXZ): boolean {
  const l = toLocal(layout, p);
  return inside(TRACK_ZONE, l) && !inCorridor(l);
}

/** Ground height for walking: the platform and the footbridge are raised, elsewhere the terrain. */
export function stationGroundHeight(layout: StationLayout, p: WorldXZ, ground = 0): number {
  const l = toLocal(layout, p);
  if (inCorridor(l)) return bridgeHeight(l);
  return inside(PLATFORM, l) ? PLATFORM.height : ground;
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
