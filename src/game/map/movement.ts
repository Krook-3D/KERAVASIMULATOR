import type { LngLat } from '../../types/game';

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceMeters(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Linear interpolation between two points; fine at city scale. */
export function lerpLngLat(a: LngLat, b: LngLat, t: number): LngLat {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Walking speed in game metres per real second. Faster than real life so
 * crossing the city centre takes seconds, not minutes.
 */
export const WALK_SPEED_MPS = 60;

export function travelDurationMs(from: LngLat, to: LngLat, speedMps = WALK_SPEED_MPS): number {
  return (distanceMeters(from, to) / speedMps) * 1000;
}

export function isInsideBounds(p: LngLat, [[w, s], [e, n]]: [LngLat, LngLat]): boolean {
  return p[0] >= w && p[0] <= e && p[1] >= s && p[1] <= n;
}
