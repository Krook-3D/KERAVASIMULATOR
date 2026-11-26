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
}

export interface Area {
  outline: WorldXZ[];
}

export interface WorldData {
  source: 'osm' | 'placeholder';
  /** Half-size of the playable square around the origin, in metres. */
  radius: number;
  buildings: Building[];
  roads: Road[];
  water: Area[];
  parks: Area[];
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
