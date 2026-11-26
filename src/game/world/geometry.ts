import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WorldXZ } from './projection';
import { ROAD_WIDTH, type Area, type Building, type Road, type RoadKind } from './worldData';

/**
 * Builds merged meshes from world data. Everything of one kind becomes a
 * single geometry so the whole town renders in a handful of draw calls.
 */

/** Shape in the XY plane that becomes the ground after rotateX(-90°). */
function toShape(points: WorldXZ[]): THREE.Shape {
  return new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
}

const BUILDING_PALETTE = ['#e8dcc4', '#d9c6a5', '#c9b79c', '#e3e0d6', '#b9a58c', '#d7ccbd', '#c4b2a0', '#efe7d7'];

export function buildBuildingsGeometry(buildings: Building[]): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = [];
  const color = new THREE.Color();
  buildings.forEach((b, i) => {
    if (b.footprint.length < 3) return;
    const geo = new THREE.ExtrudeGeometry(toShape(b.footprint), { depth: b.height, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    color.set(b.kind === 'train_station' ? '#c75b39' : BUILDING_PALETTE[i % BUILDING_PALETTE.length]!);
    const count = geo.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let v = 0; v < count; v++) color.toArray(colors, v * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    parts.push(geo.index ? geo.toNonIndexed() : geo);
    if (geo.index) geo.dispose();
  });
  if (parts.length === 0) return null;
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

const ROAD_Y: Record<RoadKind, number> = { river: 0.03, major: 0.06, street: 0.05, path: 0.07, rail: 0.08 };

/** Flat ribbons along each polyline, one geometry per road kind. */
export function buildRoadGeometry(roads: Road[], kind: RoadKind): THREE.BufferGeometry | null {
  const positions: number[] = [];
  const indices: number[] = [];
  const half = ROAD_WIDTH[kind] / 2;
  const y = ROAD_Y[kind];

  for (const road of roads) {
    if (road.kind !== kind) continue;
    for (let i = 0; i < road.points.length - 1; i++) {
      const [ax, az] = road.points[i]!;
      const [bx, bz] = road.points[i + 1]!;
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 0.01) continue;
      // Extend each segment by half a width so joints overlap without gaps.
      const ux = dx / len, uz = dz / len;
      const nx = -uz * half, nz = ux * half;
      const ex = ux * half * 0.9, ez = uz * half * 0.9;
      const base = positions.length / 3;
      positions.push(
        ax - ex + nx, y, az - ez + nz,
        ax - ex - nx, y, az - ez - nz,
        bx + ex - nx, y, bz + ez - nz,
        bx + ex + nx, y, bz + ez + nz,
      );
      indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  }
  if (positions.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
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
