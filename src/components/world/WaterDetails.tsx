import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WorldData } from '../../game/world/worldData';
import { ROAD_WIDTH } from '../../game/world/worldData';
import type { WorldXZ } from '../../game/world/projection';
import type { Terrain } from '../../game/world/terrain';
import { pointInPolygon } from '../../game/world/collision';
import { createRng } from '../../game/world/random';
import { createFoamMaterial } from './materials';

function densify(pts: WorldXZ[], step: number): WorldXZ[] {
  const out: WorldXZ[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!, b = pts[i + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

/** A ribbon along `line`, offset `off` sideways, `width` wide, with a `foam` attribute (across, along). */
function ribbon(line: WorldXZ[], off: number, width: number, yAt: (x: number, z: number) => number, pos: number[], foam: number[], idx: number[]) {
  let along = 0;
  const base = pos.length / 3;
  for (let i = 0; i < line.length; i++) {
    const p = line[i]!, a = line[Math.max(0, i - 1)]!, b = line[Math.min(line.length - 1, i + 1)]!;
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    const nx = -dz / l, nz = dx / l;
    if (i > 0) along += Math.hypot(p[0] - line[i - 1]![0], p[1] - line[i - 1]![1]);
    for (const k of [0, 1]) {
      const o = off + (k - 0.5) * width;
      const x = p[0] + nx * o, z = p[1] + nz * o;
      pos.push(x, yAt(x, z), z);
      foam.push(k, along);
    }
    if (i > 0) {
      const v = base + i * 2;
      idx.push(v - 2, v - 1, v, v - 1, v + 1, v);
    }
  }
}

/** Shore foam, lily pads and reeds around ponds and the river. */
export function WaterDetails({ data, terrain }: { data: WorldData; terrain: Terrain }) {
  const foamMat = useMemo(createFoamMaterial, []);
  useEffect(() => () => foamMat.dispose(), [foamMat]);
  const foamGeo = useMemo(() => {
    const pos: number[] = [], foam: number[] = [], idx: number[] = [];
    data.water.forEach((a, i) => {
      if (a.outline.length < 3) return;
      const level = terrain.waterLevels[i] ?? 0;
      // outline winding decides which side is "inside": try both and keep the inner one
      const line = densify([...a.outline, a.outline[0]!], 2);
      const c = a.outline.reduce((s, p) => [s[0] + p[0] / a.outline.length, s[1] + p[1] / a.outline.length], [0, 0]);
      const p0 = line[0]!, p1 = line[1]!;
      const nx = -(p1[1] - p0[1]), nz = p1[0] - p0[0];
      const inward = (c[0] - p0[0]) * nx + (c[1] - p0[1]) * nz > 0 ? 1 : -1;
      ribbon(line, inward * 0.7, 1.6, () => level + 0.04, pos, foam, idx);
    });
    for (const r of data.roads) {
      if (r.kind !== 'river') continue;
      const line = densify(r.points, 3);
      const half = ROAD_WIDTH.river / 2 + 1.6;
      for (const side of [-1, 1]) ribbon(line, side * half, 1.8, (x, z) => terrain.surfaceAt(x, z) - 0.36, pos, foam, idx);
    }
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('foam', new THREE.Float32BufferAttribute(foam, 2));
    g.setIndex(idx);
    return g;
  }, [data, terrain]);
  useEffect(() => () => foamGeo?.dispose(), [foamGeo]);

  // lily pads and reeds on the ponds
  const { pads, reeds } = useMemo(() => {
    const rng = createRng(2024);
    const pads: { x: number; y: number; z: number; r: number; s: number }[] = [];
    const reeds: { x: number; y: number; z: number; s: number; r: number }[] = [];
    data.water.forEach((a, i) => {
      if (a.outline.length < 3) return;
      const level = terrain.waterLevels[i] ?? 0;
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const [x, z] of a.outline) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
      }
      for (let k = 0; k < 160; k++) {
        const x = minX + rng() * (maxX - minX), z = minZ + rng() * (maxZ - minZ);
        if (!pointInPolygon([x, z], a.outline)) continue;
        if (rng() < 0.4) pads.push({ x, y: level + 0.03, z, r: rng() * Math.PI * 2, s: 0.5 + rng() * 0.7 });
      }
      for (const [x, z] of densify([...a.outline, a.outline[0]!], 1.6)) {
        if (rng() < 0.45) reeds.push({ x: x + (rng() - 0.5) * 1.5, y: level - 0.2, z: z + (rng() - 0.5) * 1.5, s: 0.7 + rng() * 0.8, r: rng() * 6.28 });
      }
    });
    return { pads, reeds };
  }, [data, terrain]);
  const padRef = useRef<THREE.InstancedMesh>(null);
  const reedRef = useRef<THREE.InstancedMesh>(null);
  const padGeo = useMemo(() => new THREE.CircleGeometry(0.55, 10, 0.3, Math.PI * 2 - 0.6).rotateX(-Math.PI / 2), []);
  const reedGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(0.05, 1.8, 4).translate(0, 0.9, 0);
    return g;
  }, []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    pads.forEach((d, i) => {
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, d.r);
      m.compose(p.set(d.x, d.y, d.z), q, s.setScalar(d.s));
      padRef.current?.setMatrixAt(i, m);
    });
    reeds.forEach((d, i) => {
      q.setFromEuler(new THREE.Euler((d.r % 1) * 0.2 - 0.1, d.r, ((d.r * 7) % 1) * 0.2 - 0.1));
      m.compose(p.set(d.x, d.y, d.z), q, s.set(1, d.s, 1));
      reedRef.current?.setMatrixAt(i, m);
    });
    for (const r of [padRef.current, reedRef.current]) if (r) { r.instanceMatrix.needsUpdate = true; r.computeBoundingSphere(); }
  }, [pads, reeds]);
  useEffect(() => () => { padGeo.dispose(); reedGeo.dispose(); }, [padGeo, reedGeo]);

  useFrame(({ clock }) => {
    foamMat.userData.uTime.value = clock.elapsedTime;
  });
  return (
    <group>
      {foamGeo && <mesh geometry={foamGeo} material={foamMat} raycast={() => null} />}
      {pads.length > 0 && (
        <instancedMesh ref={padRef} args={[padGeo, undefined, pads.length]} raycast={() => null} receiveShadow>
          <meshStandardMaterial color="#4f8a3a" roughness={0.6} side={THREE.DoubleSide} />
        </instancedMesh>
      )}
      {reeds.length > 0 && (
        <instancedMesh ref={reedRef} args={[reedGeo, undefined, reeds.length]} raycast={() => null} castShadow>
          <meshStandardMaterial color="#8a9a4a" roughness={0.9} />
        </instancedMesh>
      )}
    </group>
  );
}
