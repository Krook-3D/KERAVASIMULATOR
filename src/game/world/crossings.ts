import type { WorldXZ } from './projection';
import { ROAD_WIDTH, type Road, type RoadKind, type WorldData } from './worldData';

/**
 * Where roads meet the railway. Nothing crosses the tracks at grade: a road
 * either goes over on a bridge, under through an underpass (the rails cross
 * on a short rail bridge), or, right at the station yard, stops before the
 * tracks. OSM `bridge` / `tunnel` tags decide when the data has them;
 * otherwise main roads go over and smaller streets and paths go under.
 */
export type CrossingKind = 'over' | 'under' | 'end';

export interface Crossing {
  kind: CrossingKind;
  /** Where the road centre line meets the middle of the tracks. */
  at: WorldXZ;
  /** Unit direction of the road. */
  dir: WorldXZ;
  /** Unit direction of the railway. */
  railDir: WorldXZ;
  /** Half the road's width incl. sidewalks. */
  halfWidth: number;
  /** Half the span along the road that the tracks take (all parallel tracks plus a margin). */
  span: number;
  /** Ramp length on each side. */
  ramp: number;
  /** Height change at the crossing (+ over, − under, 0 for an end). */
  lift: number;
  road: RoadKind;
  /** Ground height at the tracks (set by the terrain); the road sits at base + lift there. */
  base: number;
}

/** Road deck height above the rails on a bridge, and road depth in an underpass. */
export const BRIDGE_LIFT = 7.2;
export const UNDERPASS_DEPTH = -5.6;
const RAMP_OVER = 85;
const RAMP_UNDER = 65;
/** Intersections closer than this along one road are one crossing (several parallel tracks). */
const CLUSTER = 40;
const SIDEWALK = 2.4;

const sub = (a: WorldXZ, b: WorldXZ): WorldXZ => [a[0] - b[0], a[1] - b[1]];
const cross = (a: WorldXZ, b: WorldXZ) => a[0] * b[1] - a[1] * b[0];
const unit = (v: WorldXZ): WorldXZ => {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
};

/** Segment intersection: parameter t on a-b, or null. */
function intersect(a: WorldXZ, b: WorldXZ, c: WorldXZ, d: WorldXZ): number | null {
  const r = sub(b, a), s = sub(d, c);
  const den = cross(r, s);
  if (Math.abs(den) < 1e-9) return null;
  const q = sub(c, a);
  const t = cross(q, s) / den, u = cross(q, r) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

export interface CrossingOpts {
  /** True where a crossing would be inside the station yard (roads stop there). */
  inYard?: (p: WorldXZ) => boolean;
}

export function findCrossings(world: Pick<WorldData, 'roads'>, opts: CrossingOpts = {}): Crossing[] {
  const rails = world.roads.filter((r) => r.kind === 'rail');
  if (!rails.length) return [];
  const railSegs: { a: WorldXZ; b: WorldXZ; level?: Road['level'] }[] = [];
  for (const r of rails) for (let i = 0; i < r.points.length - 1; i++) railSegs.push({ a: r.points[i]!, b: r.points[i + 1]!, level: r.level });

  const out: Crossing[] = [];
  for (const road of world.roads) {
    if (road.kind === 'rail' || road.kind === 'river') continue;
    // all hits along this road, by distance along it
    const hits: { s: number; at: WorldXZ; dir: WorldXZ; railDir: WorldXZ; railLevel?: Road['level'] }[] = [];
    let s0 = 0;
    for (let i = 0; i < road.points.length - 1; i++) {
      const a = road.points[i]!, b = road.points[i + 1]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (const rs of railSegs) {
        const t = intersect(a, b, rs.a, rs.b);
        if (t === null) continue;
        hits.push({ s: s0 + t * len, at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], dir: unit(sub(b, a)), railDir: unit(sub(rs.b, rs.a)), railLevel: rs.level });
      }
      s0 += len;
    }
    hits.sort((p, q) => p.s - q.s);
    for (let i = 0; i < hits.length; ) {
      let j = i;
      while (j + 1 < hits.length && hits[j + 1]!.s - hits[j]!.s < CLUSTER) j++;
      const first = hits[i]!, last = hits[j]!;
      const mid: WorldXZ = [(first.at[0] + last.at[0]) / 2, (first.at[1] + last.at[1]) / 2];
      const dir = unit(sub(last.at, first.at)[0] || sub(last.at, first.at)[1] ? sub(last.at, first.at) : first.dir);
      // how much road the tracks take: the spread of the hits plus one track bed, widened for a skewed crossing
      const sin = Math.max(0.35, Math.abs(cross(first.dir, first.railDir)));
      const span = (last.s - first.s) / 2 + (ROAD_WIDTH.rail / 2 + 3) / sin;
      const railUnder = hits.slice(i, j + 1).some((h) => h.railLevel === 'bridge');
      const railOver = hits.slice(i, j + 1).some((h) => h.railLevel === 'tunnel');
      let kind: CrossingKind;
      if (road.level === 'bridge' || railOver) kind = 'over';
      else if (road.level === 'tunnel' || railUnder) kind = 'under';
      else if (opts.inYard?.(mid)) kind = 'end';
      else kind = road.kind === 'major' ? 'over' : 'under';
      const halfWidth = ROAD_WIDTH[road.kind] / 2 + (road.kind === 'path' ? 0.8 : SIDEWALK);
      out.push({
        kind,
        at: mid,
        dir: first.dir[0] * dir[0] + first.dir[1] * dir[1] < 0 ? [-dir[0], -dir[1]] : dir,
        railDir: first.railDir,
        halfWidth,
        span,
        ramp: kind === 'over' ? RAMP_OVER : kind === 'under' ? RAMP_UNDER * (road.kind === 'path' ? 0.6 : 1) : 0,
        lift: kind === 'over' ? BRIDGE_LIFT : kind === 'under' ? (road.kind === 'path' ? UNDERPASS_DEPTH * 0.6 : UNDERPASS_DEPTH) : 0,
        road: road.kind,
        base: 0,
      });
      i = j + 1;
    }
  }
  return out;
}

/** Ramp easing 0–1 along the road: full at the tracks, easing to 0 at the end of the ramp. */
export function liftProfile(c: Crossing, s: number): number {
  const a = Math.abs(s);
  if (a <= c.span) return 1;
  if (a >= c.span + c.ramp) return 0;
  const t = (a - c.span) / c.ramp;
  return 0.5 + 0.5 * Math.cos(t * Math.PI);
}

/** Local coordinates of p in the crossing frame: s along the road, d across it. */
export function crossingLocal(c: Crossing, p: WorldXZ): [number, number] {
  const v = sub(p, c.at);
  return [v[0] * c.dir[0] + v[1] * c.dir[1], v[0] * -c.dir[1] + v[1] * c.dir[0]];
}

/**
 * Height change the crossing makes at p: the road profile across the road
 * width, fading out over a few metres to the sides (the walls hide the edge).
 */
export function crossingLift(c: Crossing, p: WorldXZ, wide = c.kind === 'over'): number {
  if (c.kind === 'end') return 0;
  const [s, d] = crossingLocal(c, p);
  // full height out to `full`, then fading over `fade` metres
  const full = wide ? WIDE_FULL : 0.5, fade = wide ? WIDE_FADE : 4.5;
  const side = Math.abs(d) - c.halfWidth - full;
  if (side > fade) return 0;
  const lat = side <= 0 ? 1 : 1 - side / fade;
  return c.lift * liftProfile(c, s) * lat;
}

/** The terrain grid (6 m) carves and raises wider than the road so its coarse mesh never pokes through the road. */
export const WIDE_FULL = 6.5;
export const WIDE_FADE = 6;
/** How far from the road centre line a crossing can change the ground. */
export const crossingReach = (c: Crossing) => c.halfWidth + WIDE_FULL + WIDE_FADE;

/** Is p on the part of an 'end' crossing where the road is removed (too close to the tracks)? */
export function inEndGap(c: Crossing, p: WorldXZ): boolean {
  if (c.kind !== 'end') return false;
  const [s, d] = crossingLocal(c, p);
  return Math.abs(s) < c.span + 6 && Math.abs(d) < c.halfWidth + 1;
}

/** Is p under a road bridge, between the abutments (where the ground stays at rail level)? */
export function underBridge(c: Crossing, p: WorldXZ): boolean {
  if (c.kind !== 'over') return false;
  const [s, d] = crossingLocal(c, p);
  // the whole width the ramp raises, so its earth never covers the tracks beside the deck
  return Math.abs(s) < c.span && Math.abs(d) < crossingReach(c) + 2;
}
