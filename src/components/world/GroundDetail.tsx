import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WorldData } from '../../game/world/worldData';
import type { WorldXZ } from '../../game/world/projection';
import type { Terrain } from '../../game/world/terrain';
import { RoadIndex } from '../../game/world/vegetation';
import { pointInPolygon } from '../../game/world/collision';
import { hash2 } from '../../game/world/random';

const RADIUS = 55;
const CELL = 2.2;
const MAX_TUFTS = 2600;
const MAX_FLOWERS = 500;

/** A tuft of grass: a few thin bent blades. */
function tuftGeometry() {
  const blades: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const g = new THREE.PlaneGeometry(0.06, 0.42, 1, 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k) + 0.21;
      p.setY(k, y);
      p.setX(k, p.getX(k) * (1 - y / 0.5));
      p.setZ(k, y * y * 0.6); // bend outwards
    }
    g.rotateY(a).translate(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05);
    blades.push(g);
  }
  return mergeGeometries(blades)!;
}

function flowerGeometry() {
  const stem = new THREE.CylinderGeometry(0.008, 0.01, 0.3, 3).translate(0, 0.15, 0);
  const head = new THREE.IcosahedronGeometry(0.045, 0).translate(0, 0.32, 0);
  stem.deleteAttribute('uv');
  head.deleteAttribute('uv');
  return mergeGeometries([stem.toNonIndexed(), head])!;
}

function swayMat(uTime: { value: number }, params: THREE.MeshStandardMaterialParameters) {
  const m = new THREE.MeshStandardMaterial(params);
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.9;
      float k = transformed.y * transformed.y * 2.0;
      transformed.x += sin(uTime * 2.0 + ph) * 0.06 * k;
      transformed.z += cos(uTime * 1.6 + ph) * 0.04 * k;`,
    );
  };
  m.customProgramCacheKey = () => 'grass-sway';
  return m;
}

const FLOWER_COLORS = ['#ffffff', '#ffd23f', '#e8508a', '#8a6fd8', '#ff8a3a'];

/** Grass tufts and wild flowers around the player (rebuilt as you walk). */
export function GroundDetail({ data, terrain, blocked, playerRef }: {
  data: WorldData;
  terrain: Terrain;
  blocked: (p: WorldXZ) => boolean;
  playerRef: MutableRefObject<THREE.Vector3>;
}) {
  const roads = useMemo(() => new RoadIndex(data.roads), [data]);
  const tuft = useMemo(tuftGeometry, []);
  const flower = useMemo(flowerGeometry, []);
  const uTime = useMemo(() => ({ value: 0 }), []);
  const grassMat = useMemo(() => swayMat(uTime, { color: '#ffffff', roughness: 0.9, side: THREE.DoubleSide }), [uTime]);
  const flowerMat = useMemo(() => swayMat(uTime, { color: '#ffffff', roughness: 0.6 }), [uTime]);
  useEffect(() => () => { tuft.dispose(); flower.dispose(); grassMat.dispose(); flowerMat.dispose(); }, [tuft, flower, grassMat, flowerMat]);
  const [centre, setCentre] = useState<WorldXZ | null>(null);
  useFrame(({ clock }) => {
    uTime.value = clock.elapsedTime;
    const p = playerRef.current;
    if (!centre || Math.hypot(p.x - centre[0], p.z - centre[1]) > 14) setCentre([Math.round(p.x / 4) * 4, Math.round(p.z / 4) * 4]);
  });

  const parks = data.parks;
  const { tufts, flowers } = useMemo(() => {
    const tufts: number[] = [], flowers: number[] = [];
    if (!centre) return { tufts, flowers };
    const [cx, cz] = centre;
    for (let gx = Math.floor((cx - RADIUS) / CELL); gx <= Math.ceil((cx + RADIUS) / CELL); gx++)
      for (let gz = Math.floor((cz - RADIUS) / CELL); gz <= Math.ceil((cz + RADIUS) / CELL); gz++) {
        if (tufts.length / 5 >= MAX_TUFTS) break;
        const h = hash2(gx, gz);
        const x = gx * CELL + (hash2(gz, gx) - 0.5) * CELL, z = gz * CELL + (h - 0.5) * CELL;
        if (Math.hypot(x - cx, z - cz) > RADIUS) continue;
        if (roads.near([x, z], 0.6) || blocked([x, z])) continue;
        const y = terrain.heightAt(x, z);
        if (y < terrain.surfaceAt(x, z) - 0.2) continue; // water
        const inPark = parks.some((pk) => pointInPolygon([x, z], pk.outline));
        if (inPark && h < 0.12 && flowers.length / 5 < MAX_FLOWERS) flowers.push(x, y, z, h * 40, Math.floor(h * 1000) % FLOWER_COLORS.length);
        else if (h < 0.8) tufts.push(x, y, z, h * 30, 0.7 + h * 0.8);
      }
    return { tufts, flowers };
  }, [centre, roads, blocked, terrain, parks]);

  const gRef = useRef<THREE.InstancedMesh>(null);
  const fRef = useRef<THREE.InstancedMesh>(null);
  const count = tufts.length / 5, fcount = flowers.length / 5;
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    const g = gRef.current, f = fRef.current;
    if (g) {
      for (let i = 0; i < count; i++) {
        const o = i * 5;
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, tufts[o + 3]!);
        m.compose(p.set(tufts[o]!, tufts[o + 1]!, tufts[o + 2]!), q, s.setScalar(tufts[o + 4]!));
        g.setMatrixAt(i, m);
        g.setColorAt(i, c.setHSL(0.24 + (tufts[o + 3]! % 0.06), 0.45, 0.28 + (tufts[o + 4]! - 0.7) * 0.12));
      }
      g.count = count;
      g.instanceMatrix.needsUpdate = true;
      if (g.instanceColor) g.instanceColor.needsUpdate = true;
      g.computeBoundingSphere();
    }
    if (f) {
      for (let i = 0; i < fcount; i++) {
        const o = i * 5;
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, flowers[o + 3]!);
        m.compose(p.set(flowers[o]!, flowers[o + 1]!, flowers[o + 2]!), q, s.setScalar(1));
        f.setMatrixAt(i, m);
        f.setColorAt(i, c.set(FLOWER_COLORS[flowers[o + 4]!]!));
      }
      f.count = fcount;
      f.instanceMatrix.needsUpdate = true;
      if (f.instanceColor) f.instanceColor.needsUpdate = true;
      f.computeBoundingSphere();
    }
  }, [tufts, flowers, count, fcount]);

  return (
    <group>
      <instancedMesh ref={gRef} args={[tuft, grassMat, MAX_TUFTS]} raycast={() => null} receiveShadow frustumCulled={false} />
      <instancedMesh ref={fRef} args={[flower, flowerMat, MAX_FLOWERS]} raycast={() => null} frustumCulled={false} />
    </group>
  );
}
