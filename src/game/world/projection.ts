import type { LngLat } from '../../types/game';
import { KERAVA_STATION } from '../map/config';

/**
 * Converts between real coordinates and 3D world metres.
 * Equirectangular projection around the world origin; accurate to well under
 * a metre across Kerava. World axes: +x = east, +z = south, +y = up.
 */
const EARTH_RADIUS_M = 6_371_000;
const toRad = (d: number) => (d * Math.PI) / 180;

export const WORLD_ORIGIN: LngLat = KERAVA_STATION;
const M_PER_DEG_LAT = toRad(1) * EARTH_RADIUS_M;
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos(toRad(WORLD_ORIGIN[1]));

/** World point on the ground plane: [x, z] in metres. */
export type WorldXZ = [number, number];

export function lngLatToWorld([lng, lat]: LngLat): WorldXZ {
  return [(lng - WORLD_ORIGIN[0]) * M_PER_DEG_LNG, -(lat - WORLD_ORIGIN[1]) * M_PER_DEG_LAT];
}

export function worldToLngLat([x, z]: WorldXZ): LngLat {
  return [WORLD_ORIGIN[0] + x / M_PER_DEG_LNG, WORLD_ORIGIN[1] - z / M_PER_DEG_LAT];
}
