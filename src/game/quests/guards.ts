import type { WorldXZ } from '../world/projection';
import { GUARD_DESK, PLAYER_CELL_X, PRISON_CORRIDOR } from '../interiors/interiors';

/**
 * Prison guards as pure functions of time, so detection is deterministic
 * and easy to reason about (and to test).
 *
 * - The patrol guard walks the corridor back and forth, pausing at each end.
 *   He sees what is in front of him (cone) and anything right next to him.
 * - The desk guard sits by the exit, mostly on his phone. Every few seconds
 *   he stretches (warning) and then looks down the corridor.
 */
export interface GuardPose {
  x: number;
  z: number;
  /** three.js yaw: facing (sin yaw, cos yaw). */
  yaw: number;
  walking: boolean;
  /** Actively watching (desk guard) – the patrol guard always watches ahead. */
  looking: boolean;
  /** About to look up (desk guard). */
  warn: boolean;
}

const PATROL = { west: -15, east: 7, z: 0.45, speed: 1.3, pause: 3 };
const LEG = (PATROL.east - PATROL.west) / PATROL.speed;
const CYCLE = 2 * LEG + 2 * PATROL.pause;

export function patrolGuard(t: number): GuardPose {
  const c = ((t % CYCLE) + CYCLE) % CYCLE;
  const W = -Math.PI / 2, E = Math.PI / 2;
  if (c < LEG) return { x: PATROL.east - c * PATROL.speed, z: PATROL.z, yaw: W, walking: true, looking: true, warn: false };
  if (c < LEG + PATROL.pause) {
    const k = (c - LEG) / PATROL.pause;
    // looks around at the west end, then turns back east
    return { x: PATROL.west, z: PATROL.z, yaw: k < 0.6 ? W + Math.sin(k * 10) * 0.4 : W + ((k - 0.6) / 0.4) * Math.PI, walking: false, looking: true, warn: false };
  }
  if (c < 2 * LEG + PATROL.pause) {
    const d = c - LEG - PATROL.pause;
    return { x: PATROL.west + d * PATROL.speed, z: PATROL.z, yaw: E, walking: true, looking: true, warn: false };
  }
  const k = (c - 2 * LEG - PATROL.pause) / PATROL.pause;
  return { x: PATROL.east, z: PATROL.z, yaw: k < 0.6 ? E + Math.sin(k * 10) * 0.4 : E + ((k - 0.6) / 0.4) * Math.PI, walking: false, looking: true, warn: false };
}

const DESK_CYCLE = 12;
const DESK_WARN = 8.4;
const DESK_LOOK = 9.6;

export function deskGuard(t: number): GuardPose {
  const c = ((t % DESK_CYCLE) + DESK_CYCLE) % DESK_CYCLE;
  return { x: GUARD_DESK[0], z: GUARD_DESK[1], yaw: -Math.PI / 2, walking: false, looking: c >= DESK_LOOK, warn: c >= DESK_WARN && c < DESK_LOOK };
}

/** Patrol guard vision: a 55° half-angle cone 10 m deep, plus anything within 1.8 m. */
export function patrolSees(g: GuardPose, p: WorldXZ): boolean {
  const dx = p[0] - g.x, dz = p[1] - g.z;
  const d = Math.hypot(dx, dz);
  if (d < 1.8) return true;
  if (d > 10) return false;
  const fx = Math.sin(g.yaw), fz = Math.cos(g.yaw);
  return (dx * fx + dz * fz) / d > Math.cos((55 * Math.PI) / 180);
}

/** Desk guard, when looking up: the whole corridor (not inside the cells), and anyone close by. */
export function deskSees(g: GuardPose, p: WorldXZ): boolean {
  if (!g.looking) return false;
  if (Math.hypot(p[0] - g.x, p[1] - g.z) < 2.6) return true;
  return p[0] < g.x && p[1] > PRISON_CORRIDOR.minZ - 0.1 && p[1] < PRISON_CORRIDOR.maxZ;
}

/** Point in front of the player's cell bars where filing happens. */
export const FILE_SPOT: WorldXZ = [PLAYER_CELL_X, -2.2];

/** Is the player standing at the bars (inside the cell) to file? */
export function atBars(p: WorldXZ): boolean {
  return Math.abs(p[0] - PLAYER_CELL_X) < 2.1 && p[1] < -1.7 && p[1] > -3.2;
}

/** While filing, the patrol guard notices the noise when he sees the bars or walks past them. */
export function filingNoticed(t: number): boolean {
  const g = patrolGuard(t);
  return patrolSees(g, FILE_SPOT) || Math.abs(g.x - PLAYER_CELL_X) < 3.2;
}

/** True if the patrol guard will notice filing within the next `ahead` seconds (used for the warning). */
export function filingDangerSoon(t: number, ahead = 1.2): boolean {
  for (let k = 0.2; k <= ahead; k += 0.2) if (filingNoticed(t + k)) return true;
  return false;
}

export function escapeSeen(t: number, p: WorldXZ): boolean {
  return patrolSees(patrolGuard(t), p) || deskSees(deskGuard(t), p);
}
