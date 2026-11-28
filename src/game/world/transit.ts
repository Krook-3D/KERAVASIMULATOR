import type { WorldXZ } from './projection';
import type { Road } from './worldData';

/**
 * Public transport: bus stops on the street network. At a stop you pick a
 * destination, a bus drives in, picks you up and drops you at that stop.
 */
export const BUS_FARE = 3;
/** Chance a ticket inspector catches you when riding without a ticket. */
export const FARE_DODGE_CATCH = 0.25;

export interface BusStopDef {
  id: string;
  name: string;
  /** Rough spot (world metres); the stop snaps to the nearest street. */
  near: WorldXZ;
}

export interface BusStop extends BusStopDef {
  /** Where the player stands to wait. */
  at: WorldXZ;
  /** Kerb point on the road centre line where the bus stops. */
  road: WorldXZ;
  /** Unit vector along the road (bus driving direction). */
  dir: WorldXZ;
  /** Unit vector from the road towards the stop. */
  side: WorldXZ;
}

export interface Segment {
  a: WorldXZ;
  b: WorldXZ;
}

/** Nearest point on any drivable road to `p`. */
export function nearestOnRoads(roads: Road[], p: WorldXZ): { q: WorldXZ; dir: WorldXZ; d: number } | null {
  let best: { q: WorldXZ; dir: WorldXZ; d: number } | null = null;
  for (const r of roads) {
    if (r.kind !== 'street' && r.kind !== 'major') continue;
    for (let i = 0; i + 1 < r.points.length; i++) {
      const a = r.points[i]!, b = r.points[i + 1]!;
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const len2 = dx * dx + dz * dz;
      if (len2 < 1e-6) continue;
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2));
      const q: WorldXZ = [a[0] + dx * t, a[1] + dz * t];
      const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (!best || d < best.d) {
        const len = Math.sqrt(len2);
        best = { q, dir: [dx / len, dz / len], d };
      }
    }
  }
  return best;
}

/** Snap stop definitions to the street network. Stops that find no street nearby are dropped. */
export function placeBusStops(defs: BusStopDef[], roads: Road[], kerb = 5): BusStop[] {
  const out: BusStop[] = [];
  for (const def of defs) {
    const hit = nearestOnRoads(roads, def.near);
    if (!hit || hit.d > 250) continue;
    // stop on the side of the road facing the requested spot
    let side: WorldXZ = [-hit.dir[1], hit.dir[0]];
    if ((def.near[0] - hit.q[0]) * side[0] + (def.near[1] - hit.q[1]) * side[1] < 0) side = [-side[0], -side[1]];
    // drive on the right: the bus direction keeps the stop on its right-hand side
    let dir = hit.dir;
    const right: WorldXZ = [-dir[1], dir[0]];
    if (right[0] * side[0] + right[1] * side[1] < 0) dir = [-dir[0], -dir[1]];
    out.push({ ...def, at: [hit.q[0] + side[0] * kerb, hit.q[1] + side[1] * kerb], road: [hit.q[0] + side[0] * 1.8, hit.q[1] + side[1] * 1.8], dir, side });
  }
  return out;
}

/** Pick the stop the inspector throws you off at: some other stop, not the one you wanted. */
export function inspectorDropStop(stops: BusStop[], from: string, to: string, roll: number): BusStop | undefined {
  const others = stops.filter((s) => s.id !== from && s.id !== to);
  return others[Math.floor(roll * others.length) % Math.max(1, others.length)];
}
