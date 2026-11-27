import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const FLOCKS = 3;
const PER = 7;

/** Little flocks of birds circling over town, kept roughly above the player. */
export function Birds({ followRef }: { followRef: MutableRefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => {
    // a flat "v": body point at the origin, wings out to the sides
    const g = new THREE.BufferGeometry();
    const v = new Float32Array([0, 0, 0.25, -0.9, 0, -0.1, 0, 0, -0.2, 0, 0, 0.25, 0.9, 0, -0.1, 0, 0, -0.2]);
    g.setAttribute('position', new THREE.BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  const uTime = useMemo(() => ({ value: 0 }), []);
  const mat = useMemo(() => {
    const mm = new THREE.MeshBasicMaterial({ color: '#2a2d33', side: THREE.DoubleSide });
    mm.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float ph = instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.17;
        transformed.y += abs(position.x) * sin(uTime * 9.0 + ph) * 0.55;`,
      );
    };
    mm.customProgramCacheKey = () => 'birds';
    return mm;
  }, [uTime]);
  const anchor = useRef(new THREE.Vector3());
  const m = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const s = useMemo(() => new THREE.Vector3(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const e = useMemo(() => new THREE.Euler(), []);
  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;
    uTime.value = t;
    anchor.current.lerp(followRef.current, 0.002);
    let i = 0;
    for (let f = 0; f < FLOCKS; f++) {
      const r = 60 + f * 35, speed = 0.06 + f * 0.015, h = 45 + f * 14;
      const a = t * speed + f * 2.1;
      const cx = anchor.current.x + Math.cos(f * 1.7) * 90, cz = anchor.current.z + Math.sin(f * 1.7) * 90;
      for (let b = 0; b < PER; b++) {
        const lag = b * 0.025 + (b % 2) * 0.012;
        const side = (b % 2 ? 1 : -1) * Math.ceil(b / 2) * 2.2;
        const ang = a - lag;
        const x = cx + Math.cos(ang) * (r + side), z = cz + Math.sin(ang) * (r + side);
        p.set(x, h + Math.sin(t * 0.7 + b) * 1.5, z);
        e.set(0, -ang, Math.sin(t * 0.8 + b) * 0.12);
        q.setFromEuler(e);
        m.compose(p, q, s.setScalar(1.1));
        mesh.setMatrixAt(i++, m);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[geo, mat, FLOCKS * PER]} frustumCulled={false} raycast={() => null} />
  );
}
