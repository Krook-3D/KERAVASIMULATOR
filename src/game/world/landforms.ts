import { pointInPolygon } from './collision';
import type { WorldXZ } from './projection';
import type { Hill, WorldData } from './worldData';

/**
 * Hills the coarse elevation data (≈90 m DEM) smooths away. Each one is
 * added on top of the base ground:
 * - an OSM area named "...mäki" (e.g. Aurinkomäki) becomes a rounded hill
 *   filling that area, steepest near the edge and flattening on top;
 * - an OSM peak with a height (ele) is raised to that height;
 * - with no OSM data (placeholder town) a few known Kerava hills are placed
 *   at approximate spots.
 */

/** Approximate spots for the placeholder town (no OSM). Positions are guesses. */
export const KNOWN_HILLS: (Hill & { height: number; radius: number })[] = [
  { name: 'Aurinkomäki', x: -230, z: -330, height: 14, radius: 110 },
];

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function distToEdge(p: WorldXZ, poly: WorldXZ[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2));
    best = Math.min(best, Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t)));
  }
  return best;
}

function polyArea(poly: WorldXZ[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!, q = poly[(i + 1) % poly.length]!;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

/** One hill as a height function (metres added at x, z) plus its reach for culling. */
export interface Landform {
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  add: (x: number, z: number, base: number) => number;
}

/** Height for a named hill area: bigger areas rise higher (6–18 m). */
export const areaHillHeight = (area: number) => Math.max(6, Math.min(18, Math.sqrt(area) * 0.06));

export function landformsFor(world: WorldData): Landform[] {
  const out: Landform[] = [];
  const hills = world.hills ?? [];
  const stationEle = world.elevation?.base;
  for (const h of hills) {
    if (h.outline && h.outline.length >= 3) {
      const poly = h.outline;
      const area = polyArea(poly);
      const height = areaHillHeight(area);
      // the slope runs over a third of the hill's "radius", with a soft skirt outside the outline
      const r = Math.sqrt(area / Math.PI);
      const ramp = Math.max(25, r * 0.6), skirt = 30;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [x, z] of poly) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      }
      out.push({
        name: h.name, minX: minX - skirt, maxX: maxX + skirt, minZ: minZ - skirt, maxZ: maxZ + skirt,
        add: (x, z) => {
          const inside = pointInPolygon([x, z], poly);
          const d = distToEdge([x, z], poly);
          return inside ? height * (0.12 + 0.88 * smooth(0, ramp, d)) : height * 0.12 * (1 - smooth(0, skirt, d));
        },
      });
    } else if (h.ele !== undefined && stationEle !== undefined) {
      // a peak point: lift the ground to its height, fading out over ~80 m
      const target = h.ele - stationEle;
      const sigma = 70;
      out.push({
        name: h.name, minX: h.x - 3 * sigma, maxX: h.x + 3 * sigma, minZ: h.z - 3 * sigma, maxZ: h.z + 3 * sigma,
        add: (x, z, base) => {
          const k = Math.exp(-((x - h.x) ** 2 + (z - h.z) ** 2) / (2 * sigma * sigma));
          return Math.max(0, target - base) * k;
        },
      });
    }
  }
  if (world.source !== 'osm' || !hills.length) {
    for (const k of KNOWN_HILLS) {
      if (hills.some((h) => h.name === k.name)) continue;
      out.push({
        name: k.name, minX: k.x - k.radius * 1.6, maxX: k.x + k.radius * 1.6, minZ: k.z - k.radius * 1.6, maxZ: k.z + k.radius * 1.6,
        add: (x, z) => {
          const d = Math.hypot(x - k.x, z - k.z) / k.radius;
          return k.height * (1 - smooth(0.15, 1.35, d));
        },
      });
    }
  }
  return out;
}

/** Total landform height at a point. `base` is the ground there before landforms. */
export function landformHeight(forms: Landform[], x: number, z: number, base: number): number {
  let s = 0;
  for (const f of forms) if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) s += f.add(x, z, base);
  return s;
}
