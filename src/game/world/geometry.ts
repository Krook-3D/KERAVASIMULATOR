import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WorldXZ } from './projection';
import { hash2 } from './random';
import { ROAD_WIDTH, type Area, type Building, type Road, type RoadKind } from './worldData';
import { densify, type Terrain } from './terrain';
import { inEndGap, WIDE_FADE, WIDE_FULL } from './crossings';

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

function addColor(geo: THREE.BufferGeometry, hex: string, facade: number, top: number, base = 0) {
  geo.deleteAttribute('uv');
  const count = geo.getAttribute('position').count;
  const c = new THREE.Color(hex);
  const colors = new Float32Array(count * 3);
  const facadeArr = new Float32Array(count).fill(facade);
  const topArr = new Float32Array(count).fill(top);
  for (let v = 0; v < count; v++) c.toArray(colors, v * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aBase', new THREE.BufferAttribute(new Float32Array(count).fill(base), 1));
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

/** Lowest ground point under a footprint: the building's ground floor level. */
export function buildingBase(b: Building, terrain: Terrain | null): number {
  if (!terrain) return 0;
  let min = Infinity;
  for (const [x, z] of b.footprint) min = Math.min(min, terrain.surfaceAt(x, z));
  return Number.isFinite(min) ? min : 0;
}

/** Walls reach this far below the ground floor so they never float on slopes. */
const FOUNDATION = 4;

export function buildBuildingsGeometry(buildings: Building[], terrain: Terrain | null = null): THREE.BufferGeometry | null {
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

    const base = buildingBase(b, terrain);
    const sink = terrain ? FOUNDATION : 0;
    const walls = new THREE.ExtrudeGeometry(toShape(b.footprint), { depth: b.height + sink, bevelEnabled: false });
    walls.rotateX(-Math.PI / 2);
    walls.translate(0, base - sink, 0);
    const flat = walls.index ? walls.toNonIndexed() : walls;
    if (flat !== walls) walls.dispose();
    addColor(flat, color, 1, b.height, base);
    parts.push(flat);

    if (small) {
      const roof = gableRoof(b.footprint, b.height);
      if (roof) {
        roof.translate(0, base, 0);
        addColor(roof, ROOF_COLORS[Math.floor(hash2(cz, cx) * ROOF_COLORS.length)]!, 0, b.height, base);
        parts.push(roof);
      }
    } else if (b.footprint.length >= 3) {
      // Parapet cap: a slightly darker rim on flat roofs.
      const cap = new THREE.ExtrudeGeometry(toShape(b.footprint), { depth: 0.5, bevelEnabled: false });
      cap.rotateX(-Math.PI / 2);
      cap.translate(0, base + b.height, 0);
      const capFlat = cap.index ? cap.toNonIndexed() : cap;
      if (capFlat !== cap) cap.dispose();
      addColor(capFlat, new THREE.Color(color).multiplyScalar(0.78).getStyle(), 2, b.height + 0.5, base);
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
    // same overlap for every ribbon width, so layered ribbons (sidewalk under asphalt) follow the ground alike on slopes
    const ext = Math.min(half * extend, 2.6);
    const ex = ux * ext, ez = uz * ext;
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

/** Moves ribbon vertices onto the ground: y += height(x, z). */
type Drape = ((x: number, z: number) => number) | null;

function toGeometry(r: Ribbons, drape: Drape = null): THREE.BufferGeometry | null {
  if (r.positions.length === 0) return null;
  if (drape) for (let i = 0; i < r.positions.length; i += 3) r.positions[i + 1] = r.positions[i + 1]! + drape(r.positions[i]!, r.positions[i + 2]!);
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

export function buildRoadLayers(roads: Road[], terrain: Terrain | null = null): RoadLayers {
  const sidewalk = newRibbons(), asphalt = newRibbons(), markings = newRibbons();
  const path = newRibbons(), ballast = newRibbons(), sleepers = newRibbons();
  const rails = newRibbons(), river = newRibbons();
  const half = (k: RoadKind) => ROAD_WIDTH[k] / 2;

  const ends = terrain?.crossings.filter((c) => c.kind === 'end') ?? [];
  for (const raw of roads) {
    // Short segments so the ribbons follow the ground.
    const r = terrain ? { ...raw, points: densify(raw.points, 5) } : raw;
    // roads stop short of the tracks at the station yard: draw each remaining piece
    if (ends.length && r.kind !== 'rail' && r.kind !== 'river') {
      const pieces: WorldXZ[][] = [[]];
      for (const p of r.points) {
        if (ends.some((c) => inEndGap(c, p))) {
          if (pieces[pieces.length - 1]!.length) pieces.push([]);
        } else pieces[pieces.length - 1]!.push(p);
      }
      const kept = pieces.filter((q) => q.length >= 2);
      if (kept.length !== 1 || kept[0]!.length !== r.points.length) {
        for (const q of kept) addRoad({ ...r, points: q });
        continue;
      }
    }
    addRoad(r);
  }
  function addRoad(r: Road) {
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
        // wider than the channel: the banks hide the edges
        addRibbon(river, r.points, half('river') + (terrain ? 5 : 0), terrain ? -0.4 : 0.03);
        break;
    }
  }
  const d: Drape = terrain ? (x, z) => terrain.surfaceAt(x, z) : null;
  const dr: Drape = terrain ? (x, z) => terrain.railAt(x, z) : null;
  return {
    sidewalk: toGeometry(sidewalk, d),
    asphalt: toGeometry(asphalt, d),
    markings: toGeometry(markings, d),
    path: toGeometry(path, d),
    ballast: toGeometry(ballast, dr),
    sleepers: toGeometry(sleepers, dr),
    rails: toGeometry(rails, dr),
    river: toGeometry(river, d),
  };
}

/** Flat polygons; `y` is one height for all or one per area (e.g. water levels). */
export function buildAreaGeometry(areas: Area[], y: number | number[]): THREE.BufferGeometry | null {
  const parts = areas
    .map((a, i) => ({ a, y: typeof y === 'number' ? y : (y[i] ?? 0) }))
    .filter(({ a }) => a.outline.length >= 3)
    .map(({ a, y }) => {
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

// ---------------------------------------------------------------- terrain

/**
 * Terrain mesh on the heightfield grid. Triangles use the 00 → 11 diagonal,
 * matching Terrain.heightAt(). Carries `aSlope` (0 flat … 1 vertical) for
 * rocky banks and hillsides in the ground shader.
 */
export function buildTerrainGeometry(t: Terrain): THREE.BufferGeometry {
  const { cols, rows, step, minX, minZ, h } = t;
  const pos = new Float32Array(cols * rows * 3);
  const nor = new Float32Array(cols * rows * 3);
  const slope = new Float32Array(cols * rows);
  const at = (c: number, r: number) => h[Math.max(0, Math.min(rows - 1, r)) * cols + Math.max(0, Math.min(cols - 1, c))]!;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const k = r * cols + c;
      pos[k * 3] = minX + c * step;
      pos[k * 3 + 1] = h[k]!;
      pos[k * 3 + 2] = minZ + r * step;
      const dx = (at(c + 1, r) - at(c - 1, r)) / (2 * step);
      const dz = (at(c, r + 1) - at(c, r - 1)) / (2 * step);
      const len = Math.hypot(dx, 1, dz);
      nor[k * 3] = -dx / len;
      nor[k * 3 + 1] = 1 / len;
      nor[k * 3 + 2] = -dz / len;
      slope[k] = 1 - 1 / len;
    }
  const idx = new Uint32Array((cols - 1) * (rows - 1) * 6);
  let i = 0;
  for (let r = 0; r < rows - 1; r++)
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      // a=00 b=10 d=01 e=11 (x right, z down); counter-clockwise seen from above
      idx[i++] = a; idx[i++] = e; idx[i++] = b;
      idx[i++] = a; idx[i++] = d; idx[i++] = e;
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('aSlope', new THREE.BufferAttribute(slope, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

// ---------------------------------------------------------------- road–rail crossings

/**
 * Concrete for the road–rail crossings: bridge decks, parapets and abutments,
 * the rail bridge over each underpass, and retaining walls along the ramps.
 */
export function buildCrossingGeometry(terrain: Terrain): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = [];
  /** Box of size (w across, h, l along) centred at (x, y, z), turned so its length runs along dir. */
  const box = (x: number, y: number, z: number, w: number, h: number, l: number, dir: WorldXZ) => {
    if (h <= 0.05 || l <= 0.05) return;
    const g = new THREE.BoxGeometry(w, h, l);
    g.rotateY(Math.atan2(dir[0], dir[1]));
    g.translate(x, y, z);
    parts.push(g.index ? g.toNonIndexed() : g);
  };
  const STEP = 5;
  for (const c of terrain.crossings) {
    if (c.kind === 'end') continue;
    const [ux, uz] = c.dir;
    const px = -uz, pz = ux;
    const at = (s: number, d: number): WorldXZ => [c.at[0] + ux * s + px * d, c.at[1] + uz * s + pz * d];
    const edge = c.halfWidth + 0.25;
    if (c.kind === 'over') {
      const deckTop = terrain.surfaceAt(c.at[0], c.at[1]);
      const len = c.span * 2 + 2;
      box(c.at[0], deckTop - 0.6, c.at[1], c.halfWidth * 2 + 0.8, 1.1, len, c.dir);
      for (const side of [-1, 1]) {
        const [x, z] = at(0, side * edge);
        box(x, deckTop + 0.55, z, 0.35, 1.1, len, c.dir);
      }
      // abutments at both ends, down to the ground under the bridge
      for (const end of [-1, 1]) {
        const [x, z] = at(end * (c.span + 0.5), 0);
        const ground = terrain.railAt(x, z) - 0.5;
        const top = terrain.surfaceAt(x, z) - 0.1;
        box(x, (ground + top) / 2, z, c.halfWidth * 2 + 1.6, top - ground, 1.4, c.dir);
      }
    } else {
      // the rail bridge over the underpass
      const sin = Math.max(0.35, Math.abs(c.dir[0] * c.railDir[1] - c.dir[1] * c.railDir[0]));
      const top = terrain.railAt(c.at[0], c.at[1]) - 0.04;
      const across = (c.halfWidth * 2 + 3) / sin;
      box(c.at[0], top - 0.55, c.at[1], c.span * 2 * sin, 1.1, across, c.railDir);
      // parapets along both sides of the rail bridge
      const rpx = -c.railDir[1], rpz = c.railDir[0];
      for (const side of [-1, 1]) {
        const off = c.span * sin - 0.2;
        box(c.at[0] + rpx * off * side, top + 0.5, c.at[1] + rpz * off * side, 0.3, 1.0, across, c.railDir);
      }
    }
    // retaining walls along the ramps (and the cut), where the road is well off the old ground
    for (let s = -(c.span + c.ramp); s < c.span + c.ramp; s += STEP) {
      if (c.kind === 'over' && Math.abs(s + STEP / 2) < c.span) continue;
      const sm = s + STEP / 2;
      for (const side of [-1, 1]) {
        const [x, z] = at(sm, side * edge);
        const road = terrain.surfaceAt(x, z);
        const old = terrain.railAt(x, z);
        if (Math.abs(road - old) < 0.4) continue;
        if (c.kind === 'over') {
          box(x, (Math.min(road, old) - 0.4 + road + 1.0) / 2, z, 0.35, road + 1.4 - Math.min(road, old), STEP + 0.05, c.dir);
        } else {
          // a solid wall block from the road edge out over the carved ground (the coarse grid carves wider than the road)
          const T = WIDE_FULL + WIDE_FADE;
          const [bx, bz] = at(sm, side * (edge + T / 2 - 0.2));
          const under = Math.abs(sm) < c.span + 1;
          const hi = under ? old - 0.45 : Math.max(old, terrain.railAt(bx, bz)) + 0.35;
          const lo = road - 0.4;
          box(bx, (lo + hi) / 2, bz, T, hi - lo, STEP + 0.05, c.dir);
        }
      }
    }
  }
  if (!parts.length) return null;
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
}

// ---------------------------------------------------------------- overhead line

/**
 * Overhead line for the electrified railway: steel masts every ~55 m beside
 * the track with an arm over it, and the contact wire between them.
 * `skip` leaves out places that have their own structures (the station).
 */
export function buildCatenaryGeometry(roads: Road[], terrain: Terrain, skip: (p: WorldXZ) => boolean): { masts: THREE.BufferGeometry | null; wires: THREE.BufferGeometry | null } {
  const masts: THREE.BufferGeometry[] = [], wires: THREE.BufferGeometry[] = [];
  const placed: WorldXZ[] = [];
  const box = (out: THREE.BufferGeometry[], x: number, y: number, z: number, w: number, h: number, l: number, yaw: number, pitch = 0) => {
    const g = new THREE.BoxGeometry(w, h, l);
    if (pitch) g.rotateX(pitch);
    g.rotateY(yaw);
    g.translate(x, y, z);
    out.push(g.index ? g.toNonIndexed() : g);
  };
  const SPACING = 55, SIDE = 3.4, WIRE_H = 5.8;
  for (const r of roads) {
    if (r.kind !== 'rail') continue;
    const pts = densify(r.points, 5);
    // walk the line, dropping a mast every SPACING metres
    const stops: { p: WorldXZ; dir: WorldXZ }[] = [];
    let carry = SPACING / 2;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!, b = pts[i + 1]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.01) continue;
      const dir: WorldXZ = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      for (let t = carry; t < len; t += SPACING) stops.push({ p: [a[0] + dir[0] * t, a[1] + dir[1] * t], dir });
      carry = (carry - len) % SPACING;
      if (carry < 0) carry += SPACING;
    }
    let prev: { p: WorldXZ; y: number } | null = null;
    for (const s of stops) {
      if (skip(s.p)) {
        prev = null;
        continue;
      }
      const y = terrain.railAt(s.p[0], s.p[1]);
      const yaw = Math.atan2(s.dir[0], s.dir[1]);
      const side: WorldXZ = [s.dir[1], -s.dir[0]];
      const m: WorldXZ = [s.p[0] + side[0] * SIDE, s.p[1] + side[1] * SIDE];
      // parallel tracks share masts: skip one right next to another
      if (!placed.some((q) => Math.hypot(q[0] - m[0], q[1] - m[1]) < 7)) {
        placed.push(m);
        box(masts, m[0], y + 3.8, m[1], 0.28, 7.6, 0.28, yaw);
        box(masts, m[0], y + 0.15, m[1], 0.7, 0.3, 0.7, yaw); // footing
      }
      // arm from the mast over the track, and a thin hanger down to the wire
      box(masts, s.p[0] + side[0] * SIDE * 0.5, y + 6.9, s.p[1] + side[1] * SIDE * 0.5, SIDE + 0.2, 0.12, 0.12, yaw);
      box(masts, s.p[0], y + (WIRE_H + 6.9) / 2, s.p[1], 0.04, 6.9 - WIRE_H, 0.04, yaw);
      if (prev) {
        const dx = s.p[0] - prev.p[0], dz = s.p[1] - prev.p[1];
        const len = Math.hypot(dx, dz);
        if (len < SPACING * 1.6) {
          const dy = y - prev.y;
          // contact wire and the catenary (messenger) wire above it
          for (const hh of [WIRE_H, 6.85])
            box(wires, (s.p[0] + prev.p[0]) / 2, (y + prev.y) / 2 + hh, (s.p[1] + prev.p[1]) / 2, 0.035, 0.035, Math.hypot(len, dy), Math.atan2(dx, dz), -Math.atan2(dy, len));
        }
      }
      prev = { p: s.p, y };
    }
  }
  const merge = (list: THREE.BufferGeometry[]) => {
    if (!list.length) return null;
    const g = mergeGeometries(list);
    list.forEach((p) => p.dispose());
    return g;
  };
  return { masts: merge(masts), wires: merge(wires) };
}
