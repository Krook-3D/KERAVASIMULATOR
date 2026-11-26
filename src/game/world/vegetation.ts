import type { WorldXZ } from './projection';
import { BuildingCollider, pointInPolygon } from './collision';
import { createRng } from './random';
import { ROAD_WIDTH, type Road, type WorldData } from './worldData';

export type TreeKind = 'spruce' | 'pine' | 'birch';

export interface Tree {
  x: number;
  z: number;
  kind: TreeKind;
  scale: number;
  rotation: number;
  tint: number; // 0–1 colour variation
}

const MAX_TREES = 3000;
const CELL = 30;

/** Fast "is this point on a road?" test using a segment grid. */
class RoadIndex {
  private cells = new Map<string, { a: WorldXZ; b: WorldXZ; half: number }[]>();

  constructor(roads: Road[]) {
    for (const r of roads) {
      const half = ROAD_WIDTH[r.kind] / 2 + (r.kind === 'major' || r.kind === 'street' ? 2.4 : 0.5);
      for (let i = 0; i < r.points.length - 1; i++) {
        const a = r.points[i]!, b = r.points[i + 1]!;
        const minX = Math.min(a[0], b[0]) - half, maxX = Math.max(a[0], b[0]) + half;
        const minZ = Math.min(a[1], b[1]) - half, maxZ = Math.max(a[1], b[1]) + half;
        for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++)
          for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
            const key = `${cx},${cz}`;
            const seg = { a, b, half };
            const list = this.cells.get(key);
            if (list) list.push(seg);
            else this.cells.set(key, [seg]);
          }
      }
    }
  }

  near([x, z]: WorldXZ, margin: number): boolean {
    const list = this.cells.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`);
    if (!list) return false;
    return list.some(({ a, b, half }) => distToSegment(x, z, a, b) < half + margin);
  }
}

function distToSegment(px: number, pz: number, [ax, az]: WorldXZ, [bx, bz]: WorldXZ): number {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

/**
 * Scatters trees: dense in parks, rows along streets and sparse elsewhere.
 * Mostly spruce, pine and birch for a Finnish look.
 */
export function placeTrees(world: WorldData, collider: BuildingCollider, exclude?: (p: WorldXZ) => boolean): Tree[] {
  const rng = createRng(1917); // Kerava's founding vibes
  const roads = new RoadIndex(world.roads);
  const trees: Tree[] = [];
  const r = world.radius;

  const pickKind = (park: boolean): TreeKind => {
    const v = rng();
    if (park) return v < 0.45 ? 'birch' : v < 0.75 ? 'spruce' : 'pine';
    return v < 0.5 ? 'spruce' : v < 0.8 ? 'pine' : 'birch';
  };
  const tryAdd = (x: number, z: number, kind: TreeKind, roadMargin: number) => {
    if (trees.length >= MAX_TREES) return;
    if (Math.abs(x) > r || Math.abs(z) > r) return;
    if (roads.near([x, z], roadMargin)) return;
    if (collider.isBlocked([x, z], 2.2)) return;
    if (exclude?.([x, z])) return;
    trees.push({ x, z, kind, scale: 0.75 + rng() * 0.6, rotation: rng() * Math.PI * 2, tint: rng() });
  };

  // Parks.
  for (const park of world.parks) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of park.outline) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    const n = Math.min(250, ((maxX - minX) * (maxZ - minZ)) / 160);
    for (let i = 0; i < n; i++) {
      const x = minX + rng() * (maxX - minX), z = minZ + rng() * (maxZ - minZ);
      if (pointInPolygon([x, z], park.outline)) tryAdd(x, z, pickKind(true), 1);
    }
  }

  // Street-side rows (birches and lindens feel).
  for (const road of world.roads) {
    if (road.kind !== 'street' && road.kind !== 'major') continue;
    const side = ROAD_WIDTH[road.kind] / 2 + 4.2;
    for (let i = 0; i < road.points.length - 1; i++) {
      const [ax, az] = road.points[i]!, [bx, bz] = road.points[i + 1]!;
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 1) continue;
      const ux = (bx - ax) / len, uz = (bz - az) / len;
      for (let t = 6; t < len; t += 13 + rng() * 6) {
        for (const s of [-1, 1]) {
          if (rng() < 0.45) continue;
          tryAdd(ax + ux * t - uz * side * s, az + uz * t + ux * side * s, rng() < 0.6 ? 'birch' : 'pine', 0.6);
        }
      }
    }
  }

  // Sparse forest patches everywhere else.
  for (let i = 0; i < 1400; i++) {
    const x = (rng() * 2 - 1) * r, z = (rng() * 2 - 1) * r;
    // Clustered: thicker towards the edges of the play area.
    const edge = Math.max(Math.abs(x), Math.abs(z)) / r;
    if (rng() > 0.25 + edge * 0.6) continue;
    tryAdd(x, z, pickKind(false), 2);
  }
  return trees;
}
