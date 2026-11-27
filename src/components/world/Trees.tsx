import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Tree, TreeKind } from '../../game/world/vegetation';

/** Darker underneath, lighter on top: baked into a colour attribute so instanced tints still apply. */
function shadeByHeight(g: THREE.BufferGeometry, lo: number, hi: number, dark = 0.62, light = 1.12) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const k = Math.min(1, Math.max(0, (p.getY(i) - lo) / (hi - lo)));
    // a little per-vertex noise so facets read as clumps of needles/leaves
    const n = 0.92 + 0.16 * Math.abs(Math.sin(p.getX(i) * 12.9 + p.getZ(i) * 78.2 + p.getY(i) * 37.7));
    const v = (dark + (light - dark) * k) * n;
    col[i * 3] = v;
    col[i * 3 + 1] = v;
    col[i * 3 + 2] = v;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Low-poly tree parts: [trunk, crown] per kind, built once. */
function makeTreeGeometries(): Record<TreeKind, [THREE.BufferGeometry, THREE.BufferGeometry]> {
  const cone = (r: number, h: number, y: number, rot = 0, dx = 0) => new THREE.ConeGeometry(r, h, 8).rotateY(rot).translate(dx, y, 0);
  const spruceCrown = mergeGeometries([
    cone(2.15, 2.4, 1.7), cone(1.85, 2.3, 2.7, 0.4), cone(1.55, 2.2, 3.6, 0.8, 0.05), cone(1.2, 2.0, 4.5, 1.2), cone(0.85, 1.8, 5.3, 1.6, -0.04), cone(0.5, 1.4, 6.0, 2.0),
  ]);
  const clump = (r: number, x: number, y: number, z: number, sy = 0.7) => new THREE.DodecahedronGeometry(r, 0).scale(1.2, sy, 1.2).translate(x, y, z);
  const pineCrown = mergeGeometries([clump(1.7, 0.3, 6.2, 0), clump(1.3, -0.7, 5.5, 0.5), clump(1.1, 0.6, 5.3, -0.7), clump(0.9, -0.2, 6.9, -0.3, 0.6)]);
  const leaf = (r: number, x: number, y: number, z: number, d = 1) => new THREE.IcosahedronGeometry(r, d).translate(x, y, z);
  const birchCrown = mergeGeometries([
    new THREE.IcosahedronGeometry(1.8, 1).scale(1, 1.3, 1).translate(0, 5.1, 0),
    leaf(1.15, 0.95, 4.3, 0.5), leaf(1.0, -0.9, 4.6, -0.3), leaf(0.9, 0.2, 6.2, -0.6), leaf(0.8, -0.4, 3.9, 0.8, 0),
  ]);
  // Faceted normals baked into the geometry. (flatShading derives normals from
  // screen-space derivatives, which turn into NaN on sub-pixel distant trees and
  // then black out the whole frame through bloom.)
  const faceted = (g: THREE.BufferGeometry) => {
    const n = g.index ? g.toNonIndexed() : g;
    n.computeVertexNormals();
    return n;
  };
  return {
    spruce: [faceted(new THREE.CylinderGeometry(0.16, 0.28, 1.6, 6).translate(0, 0.8, 0)), shadeByHeight(faceted(spruceCrown), 0.6, 6.7)],
    pine: [faceted(new THREE.CylinderGeometry(0.17, 0.3, 5.8, 7).translate(0, 2.9, 0)), shadeByHeight(faceted(pineCrown), 4.4, 7.4, 0.7, 1.1)],
    birch: [faceted(new THREE.CylinderGeometry(0.12, 0.21, 4.6, 7).translate(0, 2.3, 0)), shadeByHeight(faceted(birchCrown), 3.0, 7.4, 0.7, 1.15)],
  };
}

/** Crowns sway gently in the wind (phase from the instance position). */
function swayMaterial(uTime: { value: number }, roughness: number) {
  const m = new THREE.MeshStandardMaterial({ roughness, vertexColors: true });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * 0.13 + instanceMatrix[3].z * 0.17;
      #else
        float ph = 0.0;
      #endif
      float hh = max(0.0, transformed.y - 1.2);
      transformed.x += sin(uTime * 1.3 + ph) * 0.035 * hh + sin(uTime * 3.1 + ph * 2.0 + transformed.y) * 0.012 * hh;
      transformed.z += cos(uTime * 1.1 + ph) * 0.028 * hh;`,
    );
  };
  m.customProgramCacheKey = () => 'tree-sway';
  return m;
}

const COLORS: Record<TreeKind, { trunk: string; crown: [string, string] }> = {
  spruce: { trunk: '#5a3e2b', crown: ['#24502f', '#356b3a'] },
  pine: { trunk: '#a0603a', crown: ['#3d6b34', '#557d3a'] },
  birch: { trunk: '#ece8df', crown: ['#6f9e3c', '#9cbf4a'] },
};

function TreeKindMesh({ kind, trees, geos, crownMat }: { kind: TreeKind; trees: Tree[]; geos: [THREE.BufferGeometry, THREE.BufferGeometry]; crownMat: THREE.Material }) {
  const trunk = useRef<THREE.InstancedMesh>(null);
  const crown = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const c = new THREE.Color();
    const [c1, c2] = COLORS[kind].crown;
    trees.forEach((t, i) => {
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, t.rotation);
      s.setScalar(t.scale);
      p.set(t.x, t.y ?? 0, t.z);
      m.compose(p, q, s);
      trunk.current?.setMatrixAt(i, m);
      crown.current?.setMatrixAt(i, m);
      crown.current?.setColorAt(i, c.set(c1).lerp(new THREE.Color(c2), t.tint));
    });
    for (const mesh of [trunk.current, crown.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [trees, kind]);

  if (trees.length === 0) return null;
  return (
    <group>
      <instancedMesh ref={trunk} args={[geos[0], undefined, trees.length]} castShadow receiveShadow>
        <meshStandardMaterial color={COLORS[kind].trunk} roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={crown} args={[geos[1], crownMat, trees.length]} castShadow receiveShadow />
    </group>
  );
}

export function Trees({ trees }: { trees: Tree[] }) {
  const geos = useMemo(makeTreeGeometries, []);
  const uTime = useMemo(() => ({ value: 0 }), []);
  const crownMat = useMemo(() => swayMaterial(uTime, 0.82), [uTime]);
  useEffect(() => () => crownMat.dispose(), [crownMat]);
  useFrame(({ clock }) => {
    uTime.value = clock.elapsedTime;
  });
  const byKind = useMemo(() => {
    const out: Record<TreeKind, Tree[]> = { spruce: [], pine: [], birch: [] };
    for (const t of trees) out[t.kind].push(t);
    return out;
  }, [trees]);

  return (
    <>
      {(Object.keys(byKind) as TreeKind[]).map((k) => (
        <TreeKindMesh key={k} kind={k} trees={byKind[k]} geos={geos[k]} crownMat={crownMat} />
      ))}
    </>
  );
}
