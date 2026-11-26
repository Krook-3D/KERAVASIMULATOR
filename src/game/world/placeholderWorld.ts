import type { Building, Road, WorldData } from './worldData';
import type { WorldXZ } from './projection';

/**
 * Hand-made stand-in used until real OSM data is generated with
 * `npm run fetch:osm`. Loosely shaped like central Kerava: a north–south
 * railway through the middle, the station at the origin and a street grid
 * on both sides.
 */
export function createPlaceholderWorld(): WorldData {
  const radius = 500;
  const roads: Road[] = [
    { kind: 'rail', points: [[0, -radius], [0, radius]] },
    { kind: 'major', points: [[-radius, -180], [radius, -180]] },
    { kind: 'major', points: [[-radius, 220], [radius, 220]] },
  ];
  for (const x of [-320, -200, -80, 80, 200, 320]) roads.push({ kind: 'street', points: [[x, -radius], [x, radius]] });
  for (const z of [-60, 60, 340]) roads.push({ kind: 'street', points: [[-radius, z], [radius, z]] });
  roads.push({ kind: 'path', points: [[20, 0], [80, 0]] });

  // Deterministic pseudo-random so the layout is stable between reloads.
  let seed = 42;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const buildings: Building[] = [];
  const xs = [-radius, -320, -200, -80, 80, 200, 320, radius];
  const zs = [-radius, -180, -60, 60, 220, 340, radius];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const x0 = xs[i]! + 12, x1 = xs[i + 1]! - 12;
      const z0 = zs[j]! + 12, z1 = zs[j + 1]! - 12;
      const isPark = (i === 4 && j === 3) || (i === 1 && j === 4);
      if (isPark) continue;
      for (let bx = x0; bx < x1 - 20; bx += 34) {
        for (let bz = z0; bz < z1 - 20; bz += 34) {
          if (rand() < 0.35) continue;
          const w = 14 + rand() * 14, d = 14 + rand() * 14;
          const center = Math.abs(bx) < 250 && Math.abs(bz) < 250;
          buildings.push({
            footprint: rect(bx, bz, w, d),
            height: center ? 9 + rand() * 18 : 4 + rand() * 6,
          });
        }
      }
    }
  }
  // Station building next to the tracks.
  buildings.push({ footprint: rect(9, -25, 14, 50), height: 8, kind: 'train_station' });

  return {
    source: 'placeholder',
    radius,
    buildings: buildings.filter((b) => !b.footprint.some(([x]) => Math.abs(x) < 10)),
    roads,
    water: [{ outline: [[-radius, 400], [-250, 380], [-150, 430], [-radius, radius]] }],
    parks: [
      { outline: rect(212, 232, 96, 96) },
      { outline: rect(-308, 352, 96, 136) },
    ],
  };
}

function rect(x: number, z: number, w: number, d: number): WorldXZ[] {
  return [[x, z], [x + w, z], [x + w, z + d], [x, z + d]];
}
