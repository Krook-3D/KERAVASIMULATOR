import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WorldXZ } from './projection';
import { hash2 } from './random';
import { ROAD_WIDTH, type Area, type Building, type Road, type RoadKind } from './worldData';

/**
 * Builds merged meshes from world data. Everything of one kind becomes a
 * single geometry so the whole town renders in a handful of draw calls.
 */

/** Shape in the XY plane that becomes the ground after rotateX(-90°). */
function toShape(points: WorldXZ[]): THREE.Shape {
  return new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
}

// Finnish small-town palette: ochre and falu-red wooden houses, white and
// beige concrete blocks, brick.
const WOOD_COLORS = ['#d9a441', '#b5432f', '#e9dfc8', '#c9a27a', '#8fa3b0', '#e0c27a', '#a8503c'];
const BLOCK_COLORS = ['#ece6da', '#d8cfbf', '#c9bfae', '#e6dccb', '#b7785c', '#a9a49b', '#f1ede4', '#cdb79a'];
const ROOF_COLORS = ['#5a2e25', '#3d3f44', '#6e3a2a', '#2f3a33', '#4a4f57', '#7a4a32'];
const STATION_COLOR = '#c75b39';

const LOW_KINDS = new Set(['house', 'detached', 'semidetached_house', 'garage', 'garages', 'shed', 'cabin', 'hut', 'barn']);

function addColor(geo: THREE.BufferGeometry, hex: string, facade: number, top: number) {
  geo.deleteAttribute('uv');
  const count = geo.getAttribute('position').count;
  const c = new THREE.Color(hex);
  const colors = new Float32Array(count * 3);
  const facadeArr = new Float32Array(count).fill(facade);
  const topArr = new Float32Array(count).fill(top);
  for (let v = 0; v < count; v++) c.toArray(colors, v * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aFacade', new THREE.BufferAttribute(facadeArr, 1));
  geo.setAttribute('aTop', new THREE.BufferAttribute(topArr, 1));
}

/** Oriented bounding box from the longest edge, used for gable roofs. */
function orientedBox(points: WorldXZ[]) {
  let best = 0;
  let dir: WorldXZ = [1, 0];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > best) {
      best = len;
      dir = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    }
  }
  const perp: WorldXZ = [-dir[1], dir[0]];
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const [x, z] of points) {
    const u = x * dir[0] + z * dir[1];
    const v = x * perp[0] + z * perp[1];
    minU = Math.min(minU, u); maxU = Math.max(maxU, u);
    minV = Math.min(minV, v); maxV = Math.max(maxV, v);
  }
  return { dir, perp, minU, maxU, minV, maxV };
}

/** Gable roof prism over a small building, ridge along its long axis. */
function gableRoof(points: WorldXZ[], wallTop: number): THREE.BufferGeometry | null {
  const { dir, perp, minU, maxU, minV, maxV } = orientedBox(points);
  const len = maxU - minU;
  const wid = maxV - minV;
  if (len < 3 || wid < 3 || len * wid > 600) return null;
  const o = 0.35; // eaves overhang
  const rise = THREE.MathUtils.clamp(wid * 0.32, 1.2, 3.5);
  const P = (u: number, v: number, y: number) => [u * dir[0] + v * perp[0], y, u * dir[1] + v * perp[1]];
  const midV = (minV + maxV) / 2;
  const a = P(minU - o, minV - o, wallTop), b = P(maxU + o, minV - o, wallTop);
  const c = P(maxU + o, maxV + o, wallTop), d = P(minU - o, maxV + o, wallTop);
  const r1 = P(minU - o, midV, wallTop + rise), r2 = P(maxU + o, midV, wallTop + rise);
  // Gable ends sit at the wall line (no overhang) so they close the attic.
  const ga = P(minU, minV, wallTop), gd = P(minU, maxV, wallTop), gr1 = P(minU, midV, wallTop + rise);
  const gb = P(maxU, minV, wallTop), gc = P(maxU, maxV, wallTop), gr2 = P(maxU, midV, wallTop + rise);
  const tris = [
    a, r1, b, b, r1, r2, // slope 1
    c, r2, d, d, r2, r1, // slope 2
    ga, gd, gr1, // gable ends
    gb, gr2, gc,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  geo.computeVertexNormals();
  return geo;
}

function isSmallHouse(b: Building): boolean {
  return b.height <= 7.5 && b.footprint.length <= 6 && (LOW_KINDS.has(b.kind ?? '') || b.height <= 6);
}

export function buildBuildingsGeometry(buildings: Building[]): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = [];
  for (const b of buildings) {
    if (b.footprint.length < 3) continue;
    const [cx, cz] = b.footprint[0]!;
    const h = hash2(cx, cz);
    const small = isSmallHouse(b);
    const color =
      b.kind === 'train_station'
        ? STATION_COLOR
        : small
          ? WOOD_COLORS[Math.floor(h * WOOD_COLORS.length)]!
          : BLOCK_COLORS[Math.floor(h * BLOCK_COLORS.length)]!;

    const walls = new THREE.ExtrudeGeometry(toShape(b.footprint), { depth: b.height, bevelEnabled: false });
    walls.rotateX(-Math.PI / 2);
    const flat = walls.index ? walls.toNonIndexed() : walls;
    if (flat !== walls) walls.dispose();
    addColor(flat, color, 1, b.height);
    parts.push(flat);

    if (small) {
      const roof = gableRoof(b.footprint, b.height);
      if (roof) {
        addColor(roof, ROOF_COLORS[Math.floor(hash2(cz, cx) * ROOF_COLORS.length)]!, 0, b.height);
        parts.push(roof);
      }
    } else if (b.footprint.length >= 3) {
      // Parapet cap: a slightly darker rim on flat roofs.
      const cap = new THREE.ExtrudeGeometry(toShape(b.footprint), { depth: 0.5, bevelEnabled: false });
      cap.rotateX(-Math.PI / 2);
      cap.translate(0, b.height, 0);
      const capFlat = cap.index ? cap.toNonIndexed() : cap;
      if (capFlat !== cap) cap.dispose();
      addColor(capFlat, new THREE.Color(color).multiplyScalar(0.78).getStyle(), 2, b.height + 0.5);
      parts.push(capFlat);
    }
  }
  if (parts.length === 0) return null;
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

// ---------------------------------------------------------------- roads

interface Ribbons {
  positions: number[];
  indices: number[];
}

const newRibbons = (): Ribbons => ({ positions: [], indices: [] });

/** Adds a flat ribbon along a polyline, optionally shifted sideways. */
function addRibbon(out: Ribbons, points: WorldXZ[], half: number, y: number, offset = 0, extend = 0.9) {
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i]!;
    const [bx, bz] = points[i + 1]!;
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    const ux = dx / len, uz = dz / len;
    const px = -uz, pz = ux;
    const ox = px * offset, oz = pz * offset;
    const nx = px * half, nz = pz * half;
    const ex = ux * half * extend, ez = uz * half * extend;
    const base = out.positions.length / 3;
    out.positions.push(
      ax - ex + ox + nx, y, az - ez + oz + nz,
      ax - ex + ox - nx, y, az - ez + oz - nz,
      bx + ex + ox - nx, y, bz + ez + oz - nz,
      bx + ex + ox + nx, y, bz + ez + oz + nz,
    );
    out.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }
}

/** Short quads placed at regular intervals along a polyline (dashes, sleepers). */
function addDashes(out: Ribbons, points: WorldXZ[], y: number, spacing: number, length: number, half: number) {
  let carry = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i]!;
    const [bx, bz] = points[i + 1]!;
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    const ux = dx / len, uz = dz / len;
    for (let t = carry; t < len; t += spacing) {
      const sx = ax + ux * t, sz = az + uz * t;
      addRibbon(out, [[sx, sz], [sx + ux * length, sz + uz * length]], half, y, 0, 0);
    }
    carry = (carry - len) % spacing;
    if (carry < 0) carry += spacing;
  }
}

function toGeometry(r: Ribbons): THREE.BufferGeometry | null {
  if (r.positions.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(r.positions, 3));
  geo.setIndex(r.indices);
  geo.computeVertexNormals();
  // Ribbons are built with mixed winding; force upward normals.
  const n = geo.getAttribute('normal');
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return geo;
}

export interface RoadLayers {
  sidewalk: THREE.BufferGeometry | null;
  asphalt: THREE.BufferGeometry | null;
  markings: THREE.BufferGeometry | null;
  path: THREE.BufferGeometry | null;
  ballast: THREE.BufferGeometry | null;
  sleepers: THREE.BufferGeometry | null;
  rails: THREE.BufferGeometry | null;
  river: THREE.BufferGeometry | null;
}

const SIDEWALK = 2.4;

export function buildRoadLayers(roads: Road[]): RoadLayers {
  const sidewalk = newRibbons(), asphalt = newRibbons(), markings = newRibbons();
  const path = newRibbons(), ballast = newRibbons(), sleepers = newRibbons();
  const rails = newRibbons(), river = newRibbons();
  const half = (k: RoadKind) => ROAD_WIDTH[k] / 2;

  for (const r of roads) {
    switch (r.kind) {
      case 'major':
      case 'street':
        addRibbon(sidewalk, r.points, half(r.kind) + SIDEWALK, 0.04);
        addRibbon(asphalt, r.points, half(r.kind), 0.07);
        if (r.kind === 'major') addDashes(markings, r.points, 0.09, 7, 3, 0.12);
        break;
      case 'path':
        addRibbon(path, r.points, half('path'), 0.06);
        break;
      case 'rail':
        addRibbon(ballast, r.points, half('rail'), 0.05);
        addDashes(sleepers, r.points, 0.1, 0.75, 0.25, 1.3);
        addRibbon(rails, r.points, 0.07, 0.16, 0.75, 0);
        addRibbon(rails, r.points, 0.07, 0.16, -0.75, 0);
        break;
      case 'river':
        addRibbon(river, r.points, half('river'), 0.03);
        break;
    }
  }
  return {
    sidewalk: toGeometry(sidewalk),
    asphalt: toGeometry(asphalt),
    markings: toGeometry(markings),
    path: toGeometry(path),
    ballast: toGeometry(ballast),
    sleepers: toGeometry(sleepers),
    rails: toGeometry(rails),
    river: toGeometry(river),
  };
}

export function buildAreaGeometry(areas: Area[], y: number): THREE.BufferGeometry | null {
  const parts = areas
    .filter((a) => a.outline.length >= 3)
    .map((a) => {
      const geo = new THREE.ShapeGeometry(toShape(a.outline));
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, y, 0);
      return geo.index ? geo.toNonIndexed() : geo;
    });
  if (parts.length === 0) return null;
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}
