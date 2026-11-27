#!/usr/bin/env node
/**
 * Downloads Kerava from OpenStreetMap (Overpass API) plus elevation
 * (Open-Meteo / Copernicus DEM) and writes public/data/kerava-world.json in
 * world metres for the 3D scene.
 *
 *   npm run fetch:osm              # default area: central Kerava + towards Talma
 *   npm run fetch:osm -- 1000      # square of ±1000 m around the station instead
 *   npm run fetch:osm -- --no-elevation
 *
 * Data © OpenStreetMap contributors, ODbL 1.0. Elevation: Copernicus DEM GLO-90
 * via open-meteo.com (CC BY 4.0).
 */
import { writeFile, mkdir } from 'node:fs/promises';

const ORIGIN = [25.1037, 60.4044]; // keep in sync with src/game/map/config.ts
const args = process.argv.slice(2);
const radiusArg = args.find((a) => /^\d+$/.test(a));
const WITH_ELEVATION = !args.includes('--no-elevation');
// Keep in sync with DEFAULT_BOUNDS in src/game/world/worldData.ts (north is -z).
const BOUNDS = radiusArg
  ? { minX: -Number(radiusArg), maxX: Number(radiusArg), minZ: -Number(radiusArg), maxZ: Number(radiusArg) }
  : { minX: -700, maxX: 2000, minZ: -1400, maxZ: 700 };
const RADIUS = Math.max(-BOUNDS.minX, BOUNDS.maxX, -BOUNDS.minZ, BOUNDS.maxZ);
const OUT = new URL('../public/data/kerava-world.json', import.meta.url);
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

const R = 6_371_000;
const rad = (d) => (d * Math.PI) / 180;
const mLat = rad(1) * R;
const mLng = mLat * Math.cos(rad(ORIGIN[1]));
const toWorld = ({ lon, lat }) => [round((lon - ORIGIN[0]) * mLng), round(-(lat - ORIGIN[1]) * mLat)];
const round = (n) => Math.round(n * 10) / 10;

const toLngLat = (x, z) => [ORIGIN[0] + x / mLng, ORIGIN[1] - z / mLat];
const [west, north] = toLngLat(BOUNDS.minX, BOUNDS.minZ);
const [east, south] = toLngLat(BOUNDS.maxX, BOUNDS.maxZ);
const bbox = [south, west, north, east].join(',');

const query = `[out:json][timeout:90];
(
  way["building"](${bbox});
  relation["building"](${bbox});
  way["highway"](${bbox});
  way["railway"="rail"](${bbox});
  way["natural"="water"](${bbox});
  way["waterway"~"river|stream"](${bbox});
  way["leisure"~"park|pitch|playground"](${bbox});
  way["landuse"~"grass|forest|recreation_ground|meadow"](${bbox});
  way["natural"="wood"](${bbox});
  relation["landuse"="forest"](${bbox});
  relation["natural"="wood"](${bbox});
  nwr["name"~"Prisma"](${bbox});
);
out geom;`;

async function overpass() {
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        headers: { 'User-Agent': 'kerava-simulator-dev/0.1' },
      });
      if (res.ok) return await res.json();
      console.warn(`${url}: HTTP ${res.status}`);
    } catch (e) {
      console.warn(`${url}: ${e.message}`);
    }
  }
  throw new Error('All Overpass endpoints failed');
}

function buildingHeight(tags) {
  const h = parseFloat(tags.height);
  if (Number.isFinite(h)) return h;
  const levels = parseFloat(tags['building:levels']);
  if (Number.isFinite(levels)) return levels * 3.2;
  if (['house', 'detached', 'garage', 'shed', 'cabin'].includes(tags.building)) return 4.5;
  return 9;
}

const ROAD_KINDS = {
  primary: 'major', secondary: 'major', tertiary: 'major', trunk: 'major',
  residential: 'street', unclassified: 'street', service: 'street', living_street: 'street',
  pedestrian: 'path', footway: 'path', cycleway: 'path', path: 'path', steps: 'path',
};

const inside = ([x, z]) => x >= BOUNDS.minX - 50 && x <= BOUNDS.maxX + 50 && z >= BOUNDS.minZ - 50 && z <= BOUNDS.maxZ + 50;

const data = await overpass();
const world = { source: 'osm', radius: RADIUS, bounds: BOUNDS, buildings: [], roads: [], water: [], parks: [], forests: [], landmarks: [] };

for (const el of data.elements) {
  const tags = el.tags ?? {};
  if (tags.name && /prisma/i.test(tags.name)) {
    const pts = el.type === 'node' ? [toWorld(el)] : (el.geometry ?? []).map(toWorld);
    if (pts.length) {
      const c = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
      world.landmarks.push({ name: tags.name, x: round(c[0] / pts.length), z: round(c[1] / pts.length) });
    }
  }
  if (el.type === 'node') continue;
  const rings =
    el.type === 'way'
      ? [el.geometry]
      : (el.members ?? []).filter((m) => m.role === 'outer' && m.geometry).map((m) => m.geometry);

  for (const geom of rings) {
    if (!geom || geom.length < 2) continue;
    const pts = geom.map(toWorld);
    if (!pts.some(inside)) continue;

    if (tags.building) {
      if (pts.length >= 4) world.buildings.push({ footprint: pts.slice(0, -1), height: buildingHeight(tags), kind: tags.building });
    } else if (tags.highway && ROAD_KINDS[tags.highway]) {
      world.roads.push({ points: pts, kind: ROAD_KINDS[tags.highway] });
    } else if (tags.railway === 'rail') {
      world.roads.push({ points: pts, kind: 'rail' });
    } else if (tags.waterway) {
      world.roads.push({ points: pts, kind: 'river' });
    } else if (tags.natural === 'water') {
      world.water.push({ outline: pts });
    } else if (tags.landuse === 'forest' || tags.natural === 'wood') {
      world.forests.push({ outline: pts });
    } else if (tags.leisure || tags.landuse) {
      world.parks.push({ outline: pts });
    }
  }
}

/** Elevation grid (50 m) from Open-Meteo, relative to the station. */
async function fetchElevation() {
  const step = 50;
  const margin = 300;
  const minX = BOUNDS.minX - margin, minZ = BOUNDS.minZ - margin;
  const cols = Math.ceil((BOUNDS.maxX + margin - minX) / step) + 1;
  const rows = Math.ceil((BOUNDS.maxZ + margin - minZ) / step) + 1;
  const pts = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) pts.push(toLngLat(minX + c * step, minZ + r * step));
  pts.push(ORIGIN);
  const out = [];
  for (let i = 0; i < pts.length; i += 100) {
    const chunk = pts.slice(i, i + 100);
    const url =
      'https://api.open-meteo.com/v1/elevation?latitude=' +
      chunk.map((p) => p[1].toFixed(5)).join(',') +
      '&longitude=' +
      chunk.map((p) => p[0].toFixed(5)).join(',');
    let tries = 0;
    for (;;) {
      const res = await fetch(url, { headers: { 'User-Agent': 'kerava-simulator-dev/0.1' } });
      if (res.ok) {
        out.push(...(await res.json()).elevation);
        break;
      }
      if (++tries > 4) throw new Error(`elevation HTTP ${res.status}`);
      await new Promise((r) => setTimeout(r, 1500 * tries));
    }
    process.stdout.write(`\relevation ${Math.min(out.length, pts.length)}/${pts.length}`);
  }
  process.stdout.write('\n');
  const base = out.pop();
  return { minX, minZ, step, cols, rows, heights: out.map((h) => round(h - base)) };
}

if (WITH_ELEVATION) {
  try {
    world.elevation = await fetchElevation();
  } catch (e) {
    console.warn(`Elevation skipped (${e.message}); the game uses procedural hills instead.`);
  }
}

await mkdir(new URL('.', OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(world));
console.log(
  `Wrote ${OUT.pathname}: ${world.buildings.length} buildings, ${world.roads.length} roads, ` +
    `${world.water.length} water, ${world.parks.length} parks, ${world.forests.length} forests, ` +
    `${world.landmarks.length} landmarks, elevation: ${world.elevation ? 'yes' : 'no'}`,
);
