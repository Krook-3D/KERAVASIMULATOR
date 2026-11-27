import { pointInPolygon } from './collision';
import { landformHeight, landformsFor } from './landforms';
import type { WorldXZ } from './projection';
import { toLocal, type StationLayout } from './station';
import { findSavioStation } from './savio';
import { crossingLift, crossingReach, findCrossings, underBridge, type Crossing } from './crossings';
import { ROAD_WIDTH, worldBounds, type Area, type Bounds, type ElevationGrid, type Road, type WorldData } from './worldData';

/**
 * Terrain heightfield in world metres (y = 0 at the station).
 *
 * Source: the real elevation grid written by scripts/fetch-osm.mjs when
 * available, otherwise procedural landforms: a flat town centre, the
 * Keravanjoki valley, and rolling forested hills rising towards Talma in the
 * north-east. On top of that, the ground is shaped for the town: roads and
 * rails get a level bed, the station area is flat, and rivers and ponds are
 * carved in.
 *
 * Heights are stored on a regular grid and sampled with the same triangle
 * split the mesh uses, so things placed with heightAt() sit exactly on the
 * rendered ground.
 */
export class Terrain {
  /** Final ground (with rivers and ponds carved in). */
  readonly h: Float32Array;
  /** Ground before carving water: roads use it so they bridge over rivers. */
  readonly surface: Float32Array;
  /** Ground for the rails: no road ramps or underpass cuts, so rails cross over underpasses. */
  readonly rail: Float32Array;
  /** Road–rail crossings (bridges, underpasses, roads ending at the station yard). */
  crossings: Crossing[] = [];

  constructor(
    readonly minX: number,
    readonly minZ: number,
    readonly step: number,
    readonly cols: number,
    readonly rows: number,
    h: Float32Array,
    surface: Float32Array,
    /** Water surface height per world.water entry. */
    readonly waterLevels: number[],
    readonly bounds: Bounds,
    rail?: Float32Array,
  ) {
    this.h = h;
    this.surface = surface;
    this.rail = rail ?? surface;
  }

  get maxX() {
    return this.minX + (this.cols - 1) * this.step;
  }
  get maxZ() {
    return this.minZ + (this.rows - 1) * this.step;
  }

  private sample(arr: Float32Array, x: number, z: number): number {
    const fx0 = (x - this.minX) / this.step;
    const fz0 = (z - this.minZ) / this.step;
    const ix = Math.max(0, Math.min(this.cols - 2, Math.floor(fx0)));
    const iz = Math.max(0, Math.min(this.rows - 2, Math.floor(fz0)));
    const fx = Math.max(0, Math.min(1, fx0 - ix));
    const fz = Math.max(0, Math.min(1, fz0 - iz));
    const i = iz * this.cols + ix;
    const h00 = arr[i]!, h10 = arr[i + 1]!, h01 = arr[i + this.cols]!, h11 = arr[i + this.cols + 1]!;
    // Same diagonal (00 → 11) as buildTerrainGeometry.
    return fx > fz ? h00 + (h10 - h00) * fx + (h11 - h10) * fz : h00 + (h11 - h01) * fx + (h01 - h00) * fz;
  }

  heightAt(x: number, z: number): number {
    return this.sample(this.h, x, z);
  }

  /**
   * Height for road surfaces and walking (ignores river carving, so roads
   * bridge water). Bridge ramps and underpasses are worked out exactly from
   * the crossing, not from the coarse grid, so roads stay flat across.
   */
  surfaceAt(x: number, z: number): number {
    if (!this.crossings.length) return this.sample(this.surface, x, z);
    let v = this.sample(this.rail, x, z);
    let hit = false;
    for (const c of this.crossings) {
      if (c.kind === 'end') continue;
      const r = c.span + c.ramp + crossingReach(c);
      if (Math.abs(x - c.at[0]) > r || Math.abs(z - c.at[1]) > r) continue;
      const l = crossingLift(c, [x, z]);
      if (l === 0) continue;
      const w = l / c.lift;
      const t = v + (c.base + c.lift - v) * w;
      v = c.kind === 'over' ? Math.max(v, t) : Math.min(v, t);
      hit = true;
    }
    return hit ? v : this.sample(this.surface, x, z);
  }

  /** Height for rails (no road ramps or underpass cuts). */
  railAt(x: number, z: number): number {
    return this.sample(this.rail, x, z);
  }
}

// ------------------------------------------------------------ noise

function hash(ix: number, iz: number): number {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function vnoise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm(x: number, z: number, octaves = 4): number {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += (vnoise(x * f + o * 17.3, z * f - o * 9.1) * 2 - 1) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Procedural Kerava-ish landforms (metres, before shaping). */
export function proceduralHeight(x: number, z: number): number {
  // Distance "towards Talma" (east-north-east of the station).
  const talma = x * 0.8 - z * 0.6;
  const hilly = smooth(250, 1700, talma);
  const rolling = fbm(x * 0.0024, z * 0.0024) * (4 + 20 * hilly);
  const detail = fbm(x * 0.011, z * 0.011, 3) * (0.8 + 2.5 * hilly);
  // A broad ridge with a ski-hill-like top near the north-east edge.
  const rx = x - 1750, rz = z + 1150;
  const ridge = 34 * Math.exp(-(rx * rx + rz * rz) / (2 * 420 * 420));
  // Keravanjoki valley along the west side of town: a few metres lower.
  const valley = -5 * smooth(-150, -450, x);
  return rolling + detail + ridge + valley + hilly * 6;
}

function sampleGrid(g: ElevationGrid, x: number, z: number): number {
  const fx = Math.max(0, Math.min(g.cols - 1.001, (x - g.minX) / g.step));
  const fz = Math.max(0, Math.min(g.rows - 1.001, (z - g.minZ) / g.step));
  const ix = Math.floor(fx), iz = Math.floor(fz);
  const tx = fx - ix, tz = fz - iz;
  const at = (c: number, r: number) => g.heights[r * g.cols + c] ?? 0;
  const a = at(ix, iz), b = at(ix + 1, iz), c = at(ix, iz + 1), d = at(ix + 1, iz + 1);
  // smoothstep blend hides the 50 m grid
  const sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

// ------------------------------------------------------------ build

export const TERRAIN_STEP = 6;
const MARGIN = 260;

function densify(points: WorldXZ[], maxLen: number): WorldXZ[] {
  const out: WorldXZ[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i]!, [bx, bz] = points[i + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / maxLen));
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  const last = points[points.length - 1];
  if (last) out.push(last);
  return out;
}

export { densify };

interface Grid {
  minX: number;
  minZ: number;
  cols: number;
  rows: number;
  step: number;
}

/** Calls fn for every grid node within `reach` of segment a-b with distance and segment parameter. */
function forNodesNearSegment(g: Grid, a: WorldXZ, b: WorldXZ, reach: number, fn: (i: number, d: number, t: number) => void) {
  const minX = Math.min(a[0], b[0]) - reach, maxX = Math.max(a[0], b[0]) + reach;
  const minZ = Math.min(a[1], b[1]) - reach, maxZ = Math.max(a[1], b[1]) + reach;
  const c0 = Math.max(0, Math.floor((minX - g.minX) / g.step)), c1 = Math.min(g.cols - 1, Math.ceil((maxX - g.minX) / g.step));
  const r0 = Math.max(0, Math.floor((minZ - g.minZ) / g.step)), r1 = Math.min(g.rows - 1, Math.ceil((maxZ - g.minZ) / g.step));
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz || 1;
  for (let r = r0; r <= r1; r++) {
    const z = g.minZ + r * g.step;
    for (let c = c0; c <= c1; c++) {
      const x = g.minX + c * g.step;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
      const d = Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
      if (d <= reach) fn(r * g.cols + c, d, t);
    }
  }
}

function forNodesInPolygon(g: Grid, poly: WorldXZ[], fn: (i: number) => void) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of poly) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  const c0 = Math.max(0, Math.floor((minX - g.minX) / g.step)), c1 = Math.min(g.cols - 1, Math.ceil((maxX - g.minX) / g.step));
  const r0 = Math.max(0, Math.floor((minZ - g.minZ) / g.step)), r1 = Math.min(g.rows - 1, Math.ceil((maxZ - g.minZ) / g.step));
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) if (pointInPolygon([g.minX + c * g.step, g.minZ + r * g.step], poly)) fn(r * g.cols + c);
}

/** Station-local rectangle that is kept perfectly flat at y = 0. */
const STATION_FLAT = { minX: -110, maxX: 110, minZ: -32, maxZ: 38 };

export function createTerrain(world: WorldData, layout: StationLayout | null): Terrain {
  const b = worldBounds(world);
  const step = TERRAIN_STEP;
  const minX = b.minX - MARGIN, minZ = b.minZ - MARGIN;
  const cols = Math.ceil((b.maxX + MARGIN - minX) / step) + 1;
  const rows = Math.ceil((b.maxZ + MARGIN - minZ) / step) + 1;
  const g: Grid = { minX, minZ, cols, rows, step };
  const n = cols * rows;
  const h = new Float32Array(n);

  const elev = world.elevation;
  const base = (x: number, z: number) => (elev ? sampleGrid(elev, x, z) : proceduralHeight(x, z));
  const origin = layout?.origin ?? [0, 0];
  const zero = base(origin[0], origin[1]);
  const forms = landformsFor(world);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = minX + c * step, z = minZ + r * step;
      // Fade to the station level beyond the playable area so the far plane meets it.
      const out = Math.max(b.minX - x, x - b.maxX, b.minZ - z, z - b.maxZ, 0);
      const fade = 1 - smooth(MARGIN * 0.35, MARGIN * 0.9, out);
      const b0 = base(x, z) - zero;
      h[r * cols + c] = (b0 + landformHeight(forms, x, z, b0)) * fade;
    }

  // Level beds for roads and rails, following the smoothed centre line.
  const flatW = new Float32Array(n);
  const flatH = new Float32Array(n);
  const roadHeight = (p: WorldXZ) => {
    // average a few samples so a road does not copy every bump
    let s = 0;
    for (const [ox, oz] of [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6]] as const) s += sampleHeights(h, g, p[0] + ox, p[1] + oz);
    return s / 5;
  };
  for (const road of world.roads) {
    if (road.kind === 'river') continue;
    const half = ROAD_WIDTH[road.kind] / 2 + (road.kind === 'major' || road.kind === 'street' ? 2.4 : 0.6);
    const pts = densify(road.points, 12);
    const hs = pts.map(roadHeight);
    for (let i = 0; i < pts.length - 1; i++) {
      const ha = hs[i]!, hb = hs[i + 1]!;
      forNodesNearSegment(g, pts[i]!, pts[i + 1]!, half + 9, (k, d, t) => {
        const w = 1 - smooth(half + 1, half + 9, d);
        if (w > flatW[k]!) {
          flatW[k] = w;
          flatH[k] = ha + (hb - ha) * t;
        }
      });
    }
  }
  for (let k = 0; k < n; k++) if (flatW[k]! > 0) h[k] = h[k]! + (flatH[k]! - h[k]!) * flatW[k]!;

  // The station sits on a flat yard at y = 0.
  if (layout) {
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c;
        const [lx, lz] = toLocal(layout, [minX + c * step, minZ + r * step]);
        const dx = Math.max(STATION_FLAT.minX - lx, lx - STATION_FLAT.maxX, 0);
        const dz = Math.max(STATION_FLAT.minZ - lz, lz - STATION_FLAT.maxZ, 0);
        const w = 1 - smooth(0, 45, Math.hypot(dx, dz));
        if (w > 0) h[k] = h[k]! * (1 - w);
      }
  }

  // Road–rail crossings: ramps up to bridges and down into underpasses. The
  // rails keep their own height, so they cross over the underpass cut; under a
  // road bridge the ground stays at rail level and the road deck spans it.
  const rail = h.slice();
  const yardPad = 30;
  // Savio platform: about 120 m along the track either way from its centre
  const savio = findSavioStation(world);
  const nearSavio = (p: WorldXZ) => {
    const v: WorldXZ = [p[0] - savio.centre[0], p[1] - savio.centre[1]];
    return Math.abs(v[0] * savio.dir[0] + v[1] * savio.dir[1]) < 90 && Math.abs(v[0] * savio.side[0] + v[1] * savio.side[1]) < 40;
  };
  const crossings = findCrossings(world, {
    inYard: (p) => {
      if (nearSavio(p)) return true;
      if (!layout) return false;
      const [lx, lz] = toLocal(layout, p);
      return lx > STATION_FLAT.minX - yardPad && lx < STATION_FLAT.maxX + yardPad && lz > STATION_FLAT.minZ - yardPad && lz < STATION_FLAT.maxZ + yardPad;
    },
  });
  const walk = h.slice();
  for (const c of crossings) {
    if (c.kind === 'end') continue;
    const reach = crossingReach(c);
    const a: WorldXZ = [c.at[0] - c.dir[0] * (c.span + c.ramp), c.at[1] - c.dir[1] * (c.span + c.ramp)];
    const e: WorldXZ = [c.at[0] + c.dir[0] * (c.span + c.ramp), c.at[1] + c.dir[1] * (c.span + c.ramp)];
    // the deck/road level follows the ground at the tracks
    const base = sampleHeights(rail, g, c.at[0], c.at[1]);
    c.base = base;
    forNodesNearSegment(g, a, e, reach, (k) => {
      const p: WorldXZ = [minX + (k % cols) * step, minZ + Math.floor(k / cols) * step];
      const l = crossingLift(c, p, true);
      if (l === 0) return;
      // ramp from the local ground towards base + lift
      const target = base + c.lift;
      const w = l / c.lift;
      const v = rail[k]! + (target - rail[k]!) * w;
      if (c.kind === 'over') {
        walk[k] = Math.max(walk[k]!, v);
        if (!underBridge(c, p)) h[k] = Math.max(h[k]!, v);
      } else {
        walk[k] = Math.min(walk[k]!, v);
        h[k] = Math.min(h[k]!, v);
      }
    });
  }

  const surface = walk;

  // Rivers: a channel ~1.8 m deep with sloping banks.
  for (const road of world.roads) {
    if (road.kind !== 'river') continue;
    const half = ROAD_WIDTH.river / 2;
    const pts = densify(road.points, 10);
    for (let i = 0; i < pts.length - 1; i++)
      forNodesNearSegment(g, pts[i]!, pts[i + 1]!, half + 6, (k, d) => {
        const depth = 1.8 * (1 - smooth(half, half + 6, d));
        h[k] = Math.min(h[k]!, surface[k]! - depth);
      });
  }

  // Ponds and lakes: a flat water level a little under the lowest shore point.
  const waterLevels = world.water.map((a: Area) => {
    if (a.outline.length < 3) return 0;
    let level = Infinity;
    for (const p of densify([...a.outline, a.outline[0]!], 8)) level = Math.min(level, sampleHeights(surface, g, p[0], p[1]));
    level -= 0.3;
    forNodesInPolygon(g, a.outline, (k) => {
      h[k] = Math.min(h[k]!, level - 1.4);
    });
    return level;
  });

  const t = new Terrain(minX, minZ, step, cols, rows, h, surface, waterLevels, b, rail);
  t.crossings = crossings;
  return t;
}

function sampleHeights(arr: Float32Array, g: Grid, x: number, z: number): number {
  const c = Math.max(0, Math.min(g.cols - 1, Math.round((x - g.minX) / g.step)));
  const r = Math.max(0, Math.min(g.rows - 1, Math.round((z - g.minZ) / g.step)));
  return arr[r * g.cols + c]!;
}

export type { Road };
