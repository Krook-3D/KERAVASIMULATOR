import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Tree, TreeKind } from '../../game/world/vegetation';

/** Low-poly tree parts: [trunk, crown] per kind, built once. */
function makeTreeGeometries(): Record<TreeKind, [THREE.BufferGeometry, THREE.BufferGeometry]> {
  const cone = (r: number, h: number, y: number) => new THREE.ConeGeometry(r, h, 7).translate(0, y, 0);
  const spruceCrown = mergeGeometries([cone(2.0, 2.8, 2.0), cone(1.6, 2.5, 3.3), cone(1.1, 2.2, 4.5), cone(0.6, 1.6, 5.5)]);
  const pineCrown = mergeGeometries([
    new THREE.DodecahedronGeometry(1.7, 0).scale(1.2, 0.7, 1.2).translate(0.3, 6.2, 0),
    new THREE.DodecahedronGeometry(1.3, 0).scale(1.2, 0.7, 1.2).translate(-0.6, 5.4, 0.4),
  ]);
  const birchCrown = mergeGeometries([
    new THREE.IcosahedronGeometry(1.9, 1).scale(1, 1.25, 1).translate(0, 5.0, 0),
    new THREE.IcosahedronGeometry(1.2, 1).translate(0.9, 4.2, 0.5),
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
    spruce: [faceted(new THREE.CylinderGeometry(0.16, 0.26, 1.4, 6).translate(0, 0.7, 0)), faceted(spruceCrown)],
    pine: [faceted(new THREE.CylinderGeometry(0.18, 0.28, 5.6, 6).translate(0, 2.8, 0)), faceted(pineCrown)],
    birch: [faceted(new THREE.CylinderGeometry(0.13, 0.2, 4.4, 6).translate(0, 2.2, 0)), faceted(birchCrown)],
  };
}

const COLORS: Record<TreeKind, { trunk: string; crown: [string, string] }> = {
  spruce: { trunk: '#5a3e2b', crown: ['#24502f', '#356b3a'] },
  pine: { trunk: '#a0603a', crown: ['#3d6b34', '#557d3a'] },
  birch: { trunk: '#ece8df', crown: ['#6f9e3c', '#9cbf4a'] },
};

function TreeKindMesh({ kind, trees, geos }: { kind: TreeKind; trees: Tree[]; geos: [THREE.BufferGeometry, THREE.BufferGeometry] }) {
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
      p.set(t.x, 0, t.z);
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
      <instancedMesh ref={crown} args={[geos[1], undefined, trees.length]} castShadow receiveShadow>
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
    </group>
  );
}

export function Trees({ trees }: { trees: Tree[] }) {
  const geos = useMemo(makeTreeGeometries, []);
  const byKind = useMemo(() => {
    const out: Record<TreeKind, Tree[]> = { spruce: [], pine: [], birch: [] };
    for (const t of trees) out[t.kind].push(t);
    return out;
  }, [trees]);

  return (
    <>
      {(Object.keys(byKind) as TreeKind[]).map((k) => (
        <TreeKindMesh key={k} kind={k} trees={byKind[k]} geos={geos[k]} />
      ))}
    </>
  );
}
