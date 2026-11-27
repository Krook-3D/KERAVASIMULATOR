import type { WorldXZ } from './projection';
import { ROAD_WIDTH, type Road, type RoadKind } from './worldData';

/** Where streets meet: crossings get zebra crossings, stop lines and a break in the curbs. */
export interface Junction {
  at: WorldXZ;
  /** Road arms leaving the junction. */
  arms: { dir: WorldXZ; kind: RoadKind; half: number }[];
  /** Widest road half-width at the junction (asphalt only). */
  maxHalf: number;
  hasMajor: boolean;
}

const CAR: RoadKind[] = ['major', 'street'];
const CELL = 60;
const key = (p: WorldXZ) => `${Math.round(p[0] * 2)},${Math.round(p[1] * 2)}`;

/** Unit direction from point i of a polyline, walking `step` along it (+1 forward, −1 back). */
function armDir(pts: WorldXZ[], i: number, step: 1 | -1, from: WorldXZ): WorldXZ | null {
  for (let j = i + step; j >= 0 && j < pts.length; j += step) {
    const q = pts[j]!;
    const d = Math.hypot(q[0] - from[0], q[1] - from[1]);
    if (d > 4 || j === 0 || j === pts.length - 1) return d > 0.5 ? [(q[0] - from[0]) / d, (q[1] - from[1]) / d] : null;
  }
  return null;
}

/**
 * Junctions between car roads: shared OSM nodes (way ends and middles) and
 * plain segment crossings (the placeholder grid). Close points are merged.
 */
export function findJunctions(roads: Road[]): Junction[] {
  const cars = roads.filter((r) => CAR.includes(r.kind) && r.points.length >= 2);
  type Hit = { at: WorldXZ; arms: Junction['arms'] };
  const hits = new Map<string, Hit>();
  const add = (at: WorldXZ, r: Road, pts: WorldXZ[], i: number, t = 0) => {
    // a point on segment i–i+1 at parameter t (t = 0: the vertex itself)
    const k = key(at);
    let h = hits.get(k);
    if (!h) hits.set(k, (h = { at, arms: [] }));
    const half = ROAD_WIDTH[r.kind] / 2;
    const fwd = t > 0 ? armDir(pts, i, 1, at) : i < pts.length - 1 ? armDir(pts, i, 1, at) : null;
    const back = t > 0 ? armDir(pts, i + 1, -1, at) : i > 0 ? armDir(pts, i, -1, at) : null;
    for (const dir of [fwd, back]) if (dir && !h.arms.some((a) => a.dir[0] * dir[0] + a.dir[1] * dir[1] > 0.97)) h.arms.push({ dir, kind: r.kind, half });
  };
  // shared vertices
  const owners = new Map<string, { r: Road; i: number }[]>();
  for (const r of cars)
    r.points.forEach((p, i) => {
      const k = key(p);
      const l = owners.get(k);
      if (l) l.push({ r, i });
      else owners.set(k, [{ r, i }]);
    });
  for (const list of owners.values()) {
    const ends = list.filter(({ r, i }) => i === 0 || i === r.points.length - 1).length;
    // a node used by two ways that just continue each other is not a junction
    if (list.length < 2 || (list.length === 2 && ends === 2)) continue;
    for (const { r, i } of list) add(r.points[i]!, r, r.points, i);
  }
  // segment crossings (roads that cross without a shared node)
  const segs: { r: Road; i: number; a: WorldXZ; b: WorldXZ }[] = [];
  const grid = new Map<string, number[]>();
  for (const r of cars)
    for (let i = 0; i < r.points.length - 1; i++) {
      const a = r.points[i]!, b = r.points[i + 1]!;
      const idx = segs.push({ r, i, a, b }) - 1;
      for (let cx = Math.floor(Math.min(a[0], b[0]) / CELL); cx <= Math.floor(Math.max(a[0], b[0]) / CELL); cx++)
        for (let cz = Math.floor(Math.min(a[1], b[1]) / CELL); cz <= Math.floor(Math.max(a[1], b[1]) / CELL); cz++) {
          const k = `${cx},${cz}`;
          const l = grid.get(k);
          if (l) l.push(idx);
          else grid.set(k, [idx]);
        }
    }
  const seen = new Set<string>();
  for (const list of grid.values())
    for (let x = 0; x < list.length; x++)
      for (let y = x + 1; y < list.length; y++) {
        const s1 = segs[list[x]!]!, s2 = segs[list[y]!]!;
        if (s1.r === s2.r) continue;
        const pk = `${list[x]},${list[y]}`;
        if (seen.has(pk)) continue;
        seen.add(pk);
        const r = [s1.b[0] - s1.a[0], s1.b[1] - s1.a[1]], s = [s2.b[0] - s2.a[0], s2.b[1] - s2.a[1]];
        const den = r[0]! * s[1]! - r[1]! * s[0]!;
        if (Math.abs(den) < 1e-6) continue;
        const q = [s2.a[0] - s1.a[0], s2.a[1] - s1.a[1]];
        const t = (q[0]! * s[1]! - q[1]! * s[0]!) / den, u = (q[0]! * r[1]! - q[1]! * r[0]!) / den;
        // strictly inside both segments (shared vertices are handled above)
        if (t <= 0.001 || t >= 0.999 || u <= 0.001 || u >= 0.999) continue;
        const at: WorldXZ = [s1.a[0] + r[0]! * t, s1.a[1] + r[1]! * t];
        add(at, s1.r, s1.r.points, s1.i, t);
        add(at, s2.r, s2.r.points, s2.i, u);
      }
  // merge junction points closer than a road width (dual carriageways, OSM node clutter)
  const out: Junction[] = [];
  for (const h of hits.values()) {
    if (h.arms.length < 3) continue;
    const near = out.find((j) => Math.hypot(j.at[0] - h.at[0], j.at[1] - h.at[1]) < 8);
    if (near) {
      for (const a of h.arms) if (!near.arms.some((b) => b.dir[0] * a.dir[0] + b.dir[1] * a.dir[1] > 0.97)) near.arms.push(a);
      continue;
    }
    out.push({ at: h.at, arms: h.arms, maxHalf: 0, hasMajor: false });
  }
  for (const j of out) {
    j.maxHalf = Math.max(...j.arms.map((a) => a.half));
    j.hasMajor = j.arms.some((a) => a.kind === 'major');
  }
  return out;
}

/** Junction lookup by grid, for "is this point inside a junction?" checks while building geometry. */
export class JunctionIndex {
  private cells = new Map<string, Junction[]>();
  constructor(readonly list: Junction[], private pad: number) {
    for (const j of list) {
      const k = `${Math.floor(j.at[0] / CELL)},${Math.floor(j.at[1] / CELL)}`;
      const l = this.cells.get(k);
      if (l) l.push(j);
      else this.cells.set(k, [j]);
    }
  }
  /** The junction p is in (within the crossing roads' width plus `pad`), if any. */
  at(p: WorldXZ, extra = 0): Junction | null {
    const cx = Math.floor(p[0] / CELL), cz = Math.floor(p[1] / CELL);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        for (const j of this.cells.get(`${cx + dx},${cz + dz}`) ?? []) if (Math.hypot(j.at[0] - p[0], j.at[1] - p[1]) < j.maxHalf + this.pad + extra) return j;
    return null;
  }
}
