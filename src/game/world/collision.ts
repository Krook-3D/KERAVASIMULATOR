import type { WorldXZ } from './projection';
import type { Building } from './worldData';

/** Player body radius in metres, kept clear of walls. */
const BODY_RADIUS = 0.35;
const CELL = 25;

/**
 * Grid-indexed building footprints so the player cannot walk through walls.
 * Proper pathfinding (walk around buildings) comes later; for now movement
 * slides along walls and stops when fully blocked.
 */
export class BuildingCollider {
  private cells = new Map<string, WorldXZ[][]>();

  constructor(buildings: Building[]) {
    for (const b of buildings) {
      if (b.footprint.length < 3) continue;
      let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
      for (const [x, z] of b.footprint) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      }
      for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
        for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
          const key = `${cx},${cz}`;
          const list = this.cells.get(key);
          if (list) list.push(b.footprint);
          else this.cells.set(key, [b.footprint]);
        }
      }
    }
  }

  isBlocked([x, z]: WorldXZ, radius = BODY_RADIUS): boolean {
    // Sample the body circle at its centre and four edges.
    const r = radius;
    const samples: WorldXZ[] = [[x, z], [x + r, z], [x - r, z], [x, z + r], [x, z - r]];
    return samples.some((p) => this.insideAny(p));
  }

  private insideAny(p: WorldXZ): boolean {
    const list = this.cells.get(`${Math.floor(p[0] / CELL)},${Math.floor(p[1] / CELL)}`);
    return !!list && list.some((poly) => pointInPolygon(p, poly));
  }
}

export function pointInPolygon([x, z]: WorldXZ, poly: WorldXZ[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]!;
    const [xj, zj] = poly[j]!;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
