import type { WorldXZ } from './projection';
import { pointInPolygon } from './collision';
import { createRng } from './random';
import type { Area, WorldData } from './worldData';

/** A place to cook: a park grill shelter or a campfire in the woods. */
export interface CookSpot {
  id: string;
  name: string;
  kind: 'grill' | 'fire';
  at: WorldXZ;
}

function areaOf(a: Area) {
  let s = 0;
  const o = a.outline;
  for (let i = 0; i < o.length; i++) {
    const p = o[i]!, q = o[(i + 1) % o.length]!;
    s += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(s / 2);
}

function spotIn(a: Area, rng: () => number, ok: (p: WorldXZ) => boolean): WorldXZ | null {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of a.outline) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  if (pointInPolygon([cx, cz], a.outline) && ok([cx, cz])) return [cx, cz];
  for (let t = 0; t < 60; t++) {
    const p: WorldXZ = [minX + rng() * (maxX - minX), minZ + rng() * (maxZ - minZ)];
    if (pointInPolygon(p, a.outline) && ok(p)) return p;
  }
  return null;
}

/** Grill shelters in the biggest parks near town, campfires in the biggest forests. */
export function placeCookSpots(world: WorldData, ok: (p: WorldXZ) => boolean): CookSpot[] {
  const rng = createRng(5150);
  const out: CookSpot[] = [];
  const parks = [...world.parks].sort((a, b) => areaOf(b) - areaOf(a)).slice(0, 5);
  parks.forEach((pk, i) => {
    const at = spotIn(pk, rng, ok);
    if (at) out.push({ id: `grill${i}`, name: 'Grillikatos', kind: 'grill', at });
  });
  const forests = [...(world.forests ?? [])].sort((a, b) => areaOf(b) - areaOf(a)).slice(0, 3);
  forests.forEach((f, i) => {
    const at = spotIn(f, rng, ok);
    if (at) out.push({ id: `fire${i}`, name: 'Nuotiopaikka', kind: 'fire', at });
  });
  return out;
}
