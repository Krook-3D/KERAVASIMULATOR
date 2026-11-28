import type { LngLat } from '../../types/game';

/** Kerava railway station: spawn point and origin of the 3D world. */
export const KERAVA_STATION: LngLat = [25.1037, 60.4044];

/** Rough bounding box of Kerava: [[west, south], [east, north]]. */
export const KERAVA_BOUNDS: [LngLat, LngLat] = [
  [25.03, 60.37],
  [25.18, 60.45],
];
