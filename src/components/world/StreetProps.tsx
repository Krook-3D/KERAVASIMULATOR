import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Cloud, PlacedProp } from '../../game/world/streetProps';

const CAR_COLORS = ['#c9ccd1', '#2c2f36', '#f2f2ef', '#8b1e22', '#1f4e8c', '#5f6b72', '#355e3b', '#d6b04a'];

function faceted(g: THREE.BufferGeometry) {
  const n = g.index ? g.toNonIndexed() : g;
  n.deleteAttribute('uv');
  n.computeVertexNormals();
  return n;
}

function useInstances(ref: React.RefObject<THREE.InstancedMesh | null>, items: PlacedProp[], color?: (p: PlacedProp) => string) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    const c = new THREE.Color();
    items.forEach((p, i) => {
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, p.rotation);
      m.compose(new THREE.Vector3(p.x, p.y ?? 0, p.z), q, one);
      mesh.setMatrixAt(i, m);
      if (color) mesh.setColorAt(i, c.set(color(p)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ref, items, color]);
}

/** Simple hatchback: body, cabin, wheels and lights, all in one geometry per material. */
function useCarGeometries() {
  return useMemo(() => {
    const body = faceted(
      mergeGeometries([
        new THREE.BoxGeometry(1.75, 0.62, 4.1).translate(0, 0.62, 0),
        new THREE.BoxGeometry(1.6, 0.56, 2.3).translate(0, 1.2, -0.25),
      ]),
    );
    const glass = faceted(
      mergeGeometries([
        new THREE.BoxGeometry(1.62, 0.42, 2.0).translate(0, 1.2, -0.25),
      ]),
    );
    const wheel = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 12).rotateZ(Math.PI / 2);
    const wheels = faceted(
      mergeGeometries([
        wheel.clone().translate(0.84, 0.34, 1.3),
        wheel.clone().translate(-0.84, 0.34, 1.3),
        wheel.clone().translate(0.84, 0.34, -1.3),
        wheel.clone().translate(-0.84, 0.34, -1.3),
      ]),
    );
    const lights = faceted(
      mergeGeometries([
        new THREE.BoxGeometry(0.32, 0.14, 0.05).translate(0.6, 0.72, 2.06),
        new THREE.BoxGeometry(0.32, 0.14, 0.05).translate(-0.6, 0.72, 2.06),
      ]),
    );
    return { body, glass, wheels, lights };
  }, []);
}

function Cars({ cars }: { cars: PlacedProp[] }) {
  const g = useCarGeometries();
  const body = useRef<THREE.InstancedMesh>(null);
  const glass = useRef<THREE.InstancedMesh>(null);
  const wheels = useRef<THREE.InstancedMesh>(null);
  const lights = useRef<THREE.InstancedMesh>(null);
  const colorOf = useMemo(() => (p: PlacedProp) => CAR_COLORS[Math.floor(p.variant * CAR_COLORS.length)]!, []);
  useInstances(body, cars, colorOf);
  useInstances(glass, cars);
  useInstances(wheels, cars);
  useInstances(lights, cars);
  if (cars.length === 0) return null;
  return (
    <group>
      <instancedMesh ref={body} args={[g.body, undefined, cars.length]} castShadow receiveShadow>
        <meshStandardMaterial roughness={0.35} metalness={0.4} />
      </instancedMesh>
      <instancedMesh ref={glass} args={[g.glass, undefined, cars.length]}>
        <meshStandardMaterial color="#25313d" roughness={0.25} metalness={0.5} />
      </instancedMesh>
      <instancedMesh ref={wheels} args={[g.wheels, undefined, cars.length]} castShadow>
        <meshStandardMaterial color="#1b1c1f" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={lights} args={[g.lights, undefined, cars.length]}>
        <meshStandardMaterial color="#f5f0dc" roughness={0.3} />
      </instancedMesh>
    </group>
  );
}

function Lamps({ lamps }: { lamps: PlacedProp[] }) {
  const geos = useMemo(
    () => ({
      pole: faceted(
        mergeGeometries([
          new THREE.CylinderGeometry(0.07, 0.1, 6.5, 6).translate(0, 3.25, 0),
          new THREE.BoxGeometry(0.08, 0.08, 1.4).translate(0, 6.4, -0.65),
        ]),
      ),
      head: faceted(new THREE.BoxGeometry(0.32, 0.12, 0.6).translate(0, 6.3, -1.3)),
    }),
    [],
  );
  const pole = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  useInstances(pole, lamps);
  useInstances(head, lamps);
  if (lamps.length === 0) return null;
  return (
    <group>
      <instancedMesh ref={pole} args={[geos.pole, undefined, lamps.length]} castShadow>
        <meshStandardMaterial color="#5d646b" roughness={0.5} metalness={0.6} />
      </instancedMesh>
      <instancedMesh ref={head} args={[geos.head, undefined, lamps.length]}>
        <meshStandardMaterial color="#e9e5d6" emissive="#fff2c4" emissiveIntensity={0.25} />
      </instancedMesh>
    </group>
  );
}

export function StreetProps({ lamps, cars }: { lamps: PlacedProp[]; cars: PlacedProp[] }) {
  return (
    <>
      <Lamps lamps={lamps} />
      <Cars cars={cars} />
    </>
  );
}

/** Slowly drifting low-poly cumulus clouds. */
export function Clouds({ clouds }: { clouds: Cloud[] }) {
  const group = useRef<THREE.Group>(null);
  const geo = useMemo(() => faceted(new THREE.IcosahedronGeometry(1, 1)), []);
  useFrame((_, dt) => {
    if (group.current) group.current.position.x += dt * 1.5;
  });
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.scale}>
          {c.puffs.map(([x, y, z, r], j) => (
            <mesh key={j} geometry={geo} position={[x, y, z]} scale={[r, r * 0.6, r]}>
              <meshStandardMaterial color="#ffffff" roughness={1} emissive="#ffffff" emissiveIntensity={0.35} fog={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
