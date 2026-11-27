import { DEFAULT_BOUNDS, type Area, type Building, type Road, type WorldData } from './worldData';
import { lngLatToWorld, type WorldXZ } from './projection';
import { PRISMA_FALLBACK_LNGLAT, prismaRect } from './prisma';
import { pointInPolygon } from './collision';

/**
 * Hand-made stand-in used until real OSM data is generated with
 * `npm run fetch:osm`. Loosely shaped like Kerava: a north–south railway
 * through the middle with the Lahti line branching off to the north-east,
 * the station at the origin, a street grid on both sides, Keravanjoki on the
 * west side, and fields, small houses and forests along the road to Talma.
 */
export function createPlaceholderWorld(): WorldData {
  const radius = 500;
  const B = DEFAULT_BOUNDS;
  const roads: Road[] = [
    { kind: 'rail', points: [[0, B.maxZ], [0, B.minZ]] },
    // Lahti direct line curving off north-east
    { kind: 'rail', points: [[6, -520], [40, -700], [130, -880], [300, -1060], [520, -1220], [760, -1340], [900, B.minZ]] },
    // Road towards Talma
    { kind: 'major', points: [[radius, -180], [700, -260], [960, -420], [1220, -640], [1480, -860], [1700, -1060], [1880, -1250], [B.maxX, -1360]] },
    { kind: 'street', points: [[960, -420], [1120, -250], [1400, -150], [B.maxX, -120]] },
    { kind: 'street', points: [[1220, -640], [1060, -900], [980, -1180], [940, B.minZ]] },
    { kind: 'path', points: [[700, -260], [760, -520], [900, -760], [1150, -1000], [1500, -1150], [1720, -1180]] },
    { kind: 'path', points: [[1480, -860], [1640, -760], [1800, -520], [1900, -300]] },
    // Keravanjoki
    { kind: 'river', points: [[-470, B.minZ], [-430, -1050], [-520, -760], [-455, -430], [-540, -120], [-480, 180], [-575, 480], [-540, B.maxZ]] },
    { kind: 'street', points: [[-radius, -500], [-200, -560], [0, -560]] },
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

  // Small houses and farms along the road to Talma.
  const talmaRoad = roads[2]!.points;
  for (let i = 0; i < talmaRoad.length - 1; i++) {
    const [ax, az] = talmaRoad[i]!, [bx, bz] = talmaRoad[i + 1]!;
    const len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    for (let t = 20; t < len; t += 26 + rand() * 40) {
      if (rand() < 0.35) continue;
      const side = rand() < 0.5 ? -1 : 1;
      const off = 20 + rand() * 22;
      const cx = ax + ux * t - uz * off * side, cz = az + uz * t + ux * off * side;
      const w = 9 + rand() * 5, d = 8 + rand() * 4;
      buildings.push({ footprint: rect(cx - w / 2, cz - d / 2, w, d), height: 4 + rand() * 2.5, kind: 'house' });
      if (rand() < 0.3) buildings.push({ footprint: rect(cx + w / 2 + 3, cz - 3, 6, 5), height: 3, kind: 'shed' });
    }
  }

  const forests: Area[] = [
    { outline: [[620, -560], [860, -620], [1100, -820], [1010, -1000], [870, -1300], [640, -1180], [480, -900]] },
    { outline: [[1180, -900], [1420, -1020], [1660, -1160], [1600, -1400], [1100, -1400], [1020, -1200]] },
    { outline: [[1720, -1300], [2000, -1180], [2000, -720], [1820, -560], [1700, -900]] },
    { outline: [[1150, -330], [1500, -280], [2000, -330], [2000, -40], [1600, 120], [1200, 60]] },
    { outline: [[1250, 220], [2000, 160], [2000, 700], [1400, 700]] },
    { outline: [[-700, -1400], [-250, -1400], [-180, -1100], [-380, -900], [-700, -950]] },
    { outline: [[560, 380], [900, 330], [1050, 560], [900, 700], [560, 700]] },
    { outline: [[-700, 560], [-420, 520], [-330, 700], [-700, 700]] },
  ];

  // Keep buildings off the tracks, the river and the Prisma block.
  const prismaCentre = lngLatToWorld(PRISMA_FALLBACK_LNGLAT);
  const prismaZone = prismaRect(prismaCentre, 92, 70);
  const river = roads.find((r) => r.kind === 'river')!.points;
  const nearRiver = ([x, z]: WorldXZ) => river.some(([rx, rz], i) => {
    const n = river[i + 1];
    if (!n) return false;
    const dx = n[0] - rx, dz = n[1] - rz;
    const t = Math.max(0, Math.min(1, ((x - rx) * dx + (z - rz) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - (rx + dx * t), z - (rz + dz * t)) < 26;
  });
  const keep = (b: Building) =>
    !b.footprint.some(([x]) => Math.abs(x) < 10) &&
    !b.footprint.some(nearRiver) &&
    !b.footprint.some((q) => pointInPolygon(q, prismaZone)) &&
    !forests.some((f) => b.kind !== 'house' && b.kind !== 'shed' ? false : pointInPolygon(b.footprint[0]!, f.outline));
  const kept = buildings.filter(keep);
  kept.push({ footprint: prismaRect(prismaCentre), height: 11, kind: 'prisma' });

  return {
    source: 'placeholder',
    radius,
    bounds: B,
    buildings: kept,
    roads,
    water: [{ outline: [[-700, 380], [-610, 360], [-590, 430], [-650, 520], [-700, 520]] }],
    parks: [
      { outline: rect(212, 232, 96, 96) },
      { outline: rect(-308, 352, 96, 136) },
      { outline: rect(-60, -330, 50, 60) },
    ],
    forests,
    landmarks: [{ name: 'Prisma Kerava', x: prismaCentre[0], z: prismaCentre[1] }],
  };
}

function rect(x: number, z: number, w: number, d: number): WorldXZ[] {
  return [[x, z], [x + w, z], [x + w, z + d], [x, z + d]];
}
