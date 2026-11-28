import { DROP_POOL } from '../../data/items';

/**
 * Package drops: every now and then a crate parachutes somewhere in town and
 * always holds one legendary item. Pure rules here; the hook in
 * GameWorld/systems/usePackageDrops runs the timers.
 */
export const DROP = {
  /** Game seconds between drops (random in this range). */
  gapMin: 6 * 60,
  gapMax: 12 * 60,
  /** First drop comes sooner, so a new player sees one. */
  firstMin: 90,
  firstMax: 4 * 60,
  /** Seconds the crate is in the air. */
  fallS: 18,
  /** Seconds it stays on the ground before someone else "takes it". */
  stayS: 5 * 60,
  /** Distance from the player where it lands. */
  minDist: 120,
  maxDist: 550,
  /** Height the parachute starts from. */
  fromY: 140,
};

export interface PackageDrop {
  id: string;
  itemId: string;
  x: number;
  y: number;
  z: number;
  /** Game seconds when it was announced (falling starts) and when it lands. */
  at: number;
  landsAt: number;
  goneAt: number;
}

export const rollLegendary = (rng: () => number, pool: readonly string[] = DROP_POOL): string => pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]!;

export const nextGap = (rng: () => number, first = false) => (first ? DROP.firstMin + rng() * (DROP.firstMax - DROP.firstMin) : DROP.gapMin + rng() * (DROP.gapMax - DROP.gapMin));

/** Picks a landing point among known-good ground points (loot spots) at a fair distance from the player. */
export function pickDropSpot<T extends { x: number; y: number; z: number }>(points: readonly T[], from: { x: number; z: number }, rng: () => number): T | null {
  const ok = points.filter((p) => {
    const d = Math.hypot(p.x - from.x, p.z - from.z);
    return d >= DROP.minDist && d <= DROP.maxDist;
  });
  const list = ok.length ? ok : points;
  return list.length ? list[Math.floor(rng() * list.length)]! : null;
}

const DIRS = ['pohjoiseen', 'koilliseen', 'itään', 'kaakkoon', 'etelään', 'lounaaseen', 'länteen', 'luoteeseen'];

/** Finnish compass direction from a to b, "towards" form (world +x is east, +z is south). */
export function compassFi(from: { x: number; z: number }, to: { x: number; z: number }): string {
  const ang = Math.atan2(to.x - from.x, -(to.z - from.z)); // 0 = north, clockwise
  const i = Math.round(((ang + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  return DIRS[i]!;
}

/** Height of a falling crate at game time t (lands on y). */
export function dropHeight(d: PackageDrop, t: number): number {
  if (t >= d.landsAt) return d.y;
  const k = Math.max(0, (d.landsAt - t) / (d.landsAt - d.at));
  return d.y + DROP.fromY * k;
}
