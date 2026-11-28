import { lngLatToWorld, type WorldXZ } from './projection';
import type { WorldData } from './worldData';
import { SAVIO_Z } from './placeholderWorld';

/** Savio station, roughly 2.5 km down the main line from Kerava. */
export const SAVIO_STATION_LNGLAT: [number, number] = [25.1052, 60.3822];
export const TRAIN_FARE = 4;
export const TRAIN_DODGE_CATCH = 0.3;
export const TRAIN_FINE = 40;

export interface SavioStation {
  /** Point on the track centre line. */
  centre: WorldXZ;
  /** Unit vector along the track (towards Kerava = north). */
  dir: WorldXZ;
  /** Unit vector from the track to the platform side (east). */
  side: WorldXZ;
  /** Where the player waits on the platform. */
  wait: WorldXZ;
}

/** Snap the Savio station onto the nearest rail line. */
export function findSavioStation(world: WorldData): SavioStation {
  const target: WorldXZ = world.source === 'placeholder' ? [0, SAVIO_Z] : lngLatToWorld(SAVIO_STATION_LNGLAT);
  let best = { d: Infinity, q: target, dir: [0, -1] as WorldXZ };
  for (const r of world.roads) {
    if (r.kind !== 'rail') continue;
    for (let i = 0; i + 1 < r.points.length; i++) {
      const a = r.points[i]!, b = r.points[i + 1]!;
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const len2 = dx * dx + dz * dz;
      if (len2 < 1e-6) continue;
      const t = Math.max(0, Math.min(1, ((target[0] - a[0]) * dx + (target[1] - a[1]) * dz) / len2));
      const q: WorldXZ = [a[0] + dx * t, a[1] + dz * t];
      const d = Math.hypot(q[0] - target[0], q[1] - target[1]);
      if (d < best.d) {
        const len = Math.sqrt(len2);
        best = { d, q, dir: [dx / len, dz / len] };
      }
    }
  }
  let dir = best.dir;
  if (dir[1] > 0) dir = [-dir[0], -dir[1]]; // point north
  let side: WorldXZ = [-dir[1], dir[0]];
  if (side[0] < 0) side = [-side[0], -side[1]]; // east side
  return { centre: best.q, dir, side, wait: [best.q[0] + side[0] * 7.5, best.q[1] + side[1] * 7.5] };
}
