import type { WorldXZ } from './projection';

/**
 * Static world geometry in world metres, produced by scripts/fetch-osm.mjs
 * from OpenStreetMap (© OpenStreetMap contributors, ODbL).
 */
export type RoadKind = 'major' | 'street' | 'path' | 'rail' | 'river';

export interface Building {
  footprint: WorldXZ[];
  height: number;
  kind?: string;
}

export interface Road {
  points: WorldXZ[];
  kind: RoadKind;
  /** OSM bridge / tunnel tag: this way goes over or under what it crosses. */
  level?: 'bridge' | 'tunnel';
}

export interface Area {
  outline: WorldXZ[];
}

/** Playable rectangle in world metres (north is -z). */
export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Elevation samples on a regular grid, metres relative to the station. */
export interface ElevationGrid {
  minX: number;
  minZ: number;
  step: number;
  cols: number;
  rows: number;
  /** Row-major (z rows, x columns). */
  heights: number[];
  /** The station's height above sea level (heights are relative to it). */
  base?: number;
}

/** A hill from OSM: a peak (point, maybe with a height) or a named 'mäki' area. */
export interface Hill {
  name: string;
  x: number;
  z: number;
  /** Height above sea level, when OSM has it. */
  ele?: number;
  outline?: WorldXZ[];
}

export interface Landmark {
  name: string;
  x: number;
  z: number;
}

export interface WorldData {
  source: 'osm' | 'placeholder';
  /** Half-size of the original square map (kept for old data files). */
  radius: number;
  /** Playable area; older data files only have `radius`. */
  bounds?: Bounds;
  buildings: Building[];
  roads: Road[];
  water: Area[];
  parks: Area[];
  forests?: Area[];
  /** Real elevation from scripts/fetch-osm.mjs; procedural hills when missing. */
  elevation?: ElevationGrid;
  /** Named places (e.g. Prisma) found in OSM. */
  landmarks?: Landmark[];
  /** Hills the terrain is shaped to (see game/world/landforms.ts). */
  hills?: Hill[];
}

/**
 * Default playable area: central Kerava plus a stretch towards Talma
 * (north-east) so the map reaches the first forests.
 */
/** Kerava centre, Talma to the north-east and Savio down the line to the south. */
export const DEFAULT_BOUNDS: Bounds = { minX: -700, maxX: 2000, minZ: -1400, maxZ: 2900 };

export function worldBounds(w: Pick<WorldData, 'bounds' | 'radius'>): Bounds {
  return w.bounds ?? { minX: -w.radius, maxX: w.radius, minZ: -w.radius, maxZ: w.radius };
}

export function inBounds(b: Bounds, [x, z]: WorldXZ, margin = 0): boolean {
  return x >= b.minX + margin && x <= b.maxX - margin && z >= b.minZ + margin && z <= b.maxZ - margin;
}

export const ROAD_WIDTH: Record<RoadKind, number> = {
  major: 12,
  street: 8,
  path: 3,
  rail: 6,
  river: 14,
};

export async function loadWorldData(): Promise<WorldData> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/kerava-world.json`);
    if (res.ok) return (await res.json()) as WorldData;
  } catch {
    // fall through to placeholder
  }
  const { createPlaceholderWorld } = await import('./placeholderWorld');
  return createPlaceholderWorld();
}
