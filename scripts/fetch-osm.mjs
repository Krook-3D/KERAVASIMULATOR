#!/usr/bin/env node
/**
 * Downloads central Kerava from OpenStreetMap (Overpass API) and writes
 * public/data/kerava-world.json in world metres for the 3D scene.
 *
 *   npm run fetch:osm            # default radius 700 m around Kerava station
 *   npm run fetch:osm -- 1000    # custom radius in metres
 *
 * Data © OpenStreetMap contributors, ODbL 1.0.
 */
import { writeFile, mkdir } from 'node:fs/promises';

const ORIGIN = [25.1037, 60.4044]; // keep in sync with src/game/map/config.ts
const RADIUS = Number(process.argv[2] ?? 700);
const OUT = new URL('../public/data/kerava-world.json', import.meta.url);
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

const R = 6_371_000;
const rad = (d) => (d * Math.PI) / 180;
const mLat = rad(1) * R;
const mLng = mLat * Math.cos(rad(ORIGIN[1]));
const toWorld = ({ lon, lat }) => [round((lon - ORIGIN[0]) * mLng), round(-(lat - ORIGIN[1]) * mLat)];
const round = (n) => Math.round(n * 10) / 10;

const dLat = RADIUS / mLat;
const dLng = RADIUS / mLng;
const bbox = [ORIGIN[1] - dLat, ORIGIN[0] - dLng, ORIGIN[1] + dLat, ORIGIN[0] + dLng].join(',');

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

const inside = ([x, z]) => Math.abs(x) <= RADIUS * 1.05 && Math.abs(z) <= RADIUS * 1.05;

const data = await overpass();
const world = { source: 'osm', radius: RADIUS, buildings: [], roads: [], water: [], parks: [] };

for (const el of data.elements) {
  const tags = el.tags ?? {};
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
    } else if (tags.leisure || tags.landuse) {
      world.parks.push({ outline: pts });
    }
  }
}

await mkdir(new URL('.', OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(world));
console.log(
  `Wrote ${OUT.pathname}: ${world.buildings.length} buildings, ${world.roads.length} roads, ` +
    `${world.water.length} water, ${world.parks.length} parks`,
);
