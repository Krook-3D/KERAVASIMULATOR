import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { INTERIORS, POOL_BASIN, POOL_HALL } from '../../../game/interiors/interiors';
import { Humanoid, type HumanBones, type Outfit } from '../humanoid/Humanoid';
import { poseLocomotion, poseSwim, resetPose } from '../humanoid/animate';
import { Box, Cutaway, TextPanel, WallFromRect, useTileTexture } from './kit';

const WALL_H = 6;
const DEPTH = 1.6;
export const SWIM_TIME = 12;
const LANES = 5;
const laneZ = (i: number) => POOL_BASIN.minZ + ((i + 0.5) * (POOL_BASIN.maxZ - POOL_BASIN.minZ)) / LANES;

/** Animated water surface: rippling transparent blue with moving caustic-ish highlights. */
function Water() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        uniforms: { uTime: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float uTime; varying vec2 vUv;
          void main(){
            vec2 p = vUv * vec2(25.0, 10.0);
            float w = sin(p.x*2.1 + uTime*1.3) * sin(p.y*2.7 - uTime*1.1) + sin((p.x+p.y)*1.3 + uTime*0.8);
            float hl = smoothstep(1.1, 1.8, w);
            vec3 col = mix(vec3(0.12,0.55,0.75), vec3(0.75,0.95,1.0), hl*0.6);
            gl_FragColor = vec4(col, 0.72 + hl*0.15);
          }`,
      }),
    [],
  );
  useFrame((_, dt) => {
    mat.uniforms.uTime!.value += dt;
  });
  const w = POOL_BASIN.maxX - POOL_BASIN.minX, d = POOL_BASIN.maxZ - POOL_BASIN.minZ;
  return (
    <mesh rotation-x={-Math.PI / 2} position={[(POOL_BASIN.minX + POOL_BASIN.maxX) / 2, -0.25, (POOL_BASIN.minZ + POOL_BASIN.maxZ) / 2]} material={mat}>
      <planeGeometry args={[w, d]} />
    </mesh>
  );
}

function Swimmer({ lane, speed, offset, outfit }: { lane: number; speed: number; offset: number; outfit: Outfit }) {
  const g = useRef<THREE.Group>(null);
  const bones = useRef<HumanBones | null>(null);
  const len = POOL_BASIN.maxX - POOL_BASIN.minX - 2.4;
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed + offset;
    const lap = (t / len) % 2;
    const forward = lap < 1;
    const x = POOL_BASIN.minX + 1.2 + (forward ? lap : 2 - lap) * len;
    if (g.current) {
      g.current.position.set(x, -0.42, laneZ(lane));
      g.current.rotation.set(0, forward ? Math.PI / 2 : -Math.PI / 2, 0);
    }
    if (bones.current) {
      resetPose(bones.current);
      poseSwim(bones.current, clock.elapsedTime + offset);
    }
  });
  return (
    <group ref={g}>
      <group rotation-x={Math.PI / 2} position-y={0}>
        <Humanoid bonesRef={bones} outfit={outfit} />
      </group>
    </group>
  );
}

/** The player's own swim: lengths of lane 0 during the activity. */
function PlayerSwim({ t0, clockRef, outfit }: { t0: number; clockRef: MutableRefObject<number>; outfit: Outfit }) {
  const g = useRef<THREE.Group>(null);
  const bones = useRef<HumanBones | null>(null);
  const len = POOL_BASIN.maxX - POOL_BASIN.minX - 2.4;
  useFrame(() => {
    const t = clockRef.current - t0;
    const lap = ((t * 2.6) / len) % 2;
    const forward = lap < 1;
    const x = POOL_BASIN.minX + 1.2 + (forward ? lap : 2 - lap) * len;
    if (g.current) {
      g.current.position.set(x, -0.42, laneZ(0));
      g.current.rotation.set(0, forward ? Math.PI / 2 : -Math.PI / 2, 0);
    }
    if (bones.current) {
      resetPose(bones.current);
      poseSwim(bones.current, t);
    }
  });
  return (
    <group ref={g}>
      <group rotation-x={Math.PI / 2}>
        <Humanoid bonesRef={bones} outfit={{ ...outfit, hat: 'beanie', hatColor: '#ffd23f', backpack: false }} />
      </group>
    </group>
  );
}

function Lifeguard() {
  const bones = useRef<HumanBones | null>(null);
  useFrame(({ clock }) => {
    if (!bones.current) return;
    resetPose(bones.current);
    poseLocomotion(bones.current, 0, 0, clock.elapsedTime);
    bones.current.head.rotation.y = Math.sin(clock.elapsedTime * 0.4) * 0.7;
  });
  return (
    <group position={[14.1, 1.6, -6]} rotation-y={-Math.PI / 2}>
      <Humanoid bonesRef={bones} outfit={{ top: '#d62f2f', legs: '#d62f2f', shoes: '#eee', hair: '#c89a5a', hat: 'cap', hatColor: '#ffd23f', accent: '#fff' }} />
    </group>
  );
}

export function PoolInterior({ swimT0, clockRef, outfit }: { swimT0: number | null; clockRef: MutableRefObject<number>; outfit: Outfit }) {
  const deck = useTileTexture('#e8eef0', '#cfdde2', 8, [10, 8], '#00000022');
  const tiles = useTileTexture('#5fb6d6', '#4aa3c6', 8, [12, 2], '#ffffff44');
  const def = INTERIORS.pool;
  const B = POOL_BASIN;
  const bw = B.maxX - B.minX, bd = B.maxZ - B.minZ, bcx = (B.minX + B.maxX) / 2, bcz = (B.minZ + B.maxZ) / 2;
  return (
    <group>
      {/* deck with a hole for the basin: four slabs */}
      {[
        [POOL_HALL.minX, POOL_HALL.maxX, POOL_HALL.minZ, B.minZ],
        [POOL_HALL.minX, POOL_HALL.maxX, B.maxZ, POOL_HALL.maxZ],
        [POOL_HALL.minX, B.minX, B.minZ, B.maxZ],
        [B.maxX, POOL_HALL.maxX, B.minZ, B.maxZ],
      ].map(([x0, x1, z0, z1], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[(x0! + x1!) / 2, 0.01, (z0! + z1!) / 2]} receiveShadow>
          <planeGeometry args={[x1! - x0!, z1! - z0!]} />
          <meshStandardMaterial map={deck} roughness={0.5} />
        </mesh>
      ))}
      {/* basin: floor, walls, lane ropes */}
      <mesh rotation-x={-Math.PI / 2} position={[bcx, -DEPTH, bcz]}>
        <planeGeometry args={[bw, bd]} />
        <meshStandardMaterial map={tiles} roughness={0.4} />
      </mesh>
      {[
        [bcx, B.minZ, bw, 0],
        [bcx, B.maxZ, bw, Math.PI],
        [B.minX, bcz, bd, Math.PI / 2],
        [B.maxX, bcz, bd, -Math.PI / 2],
      ].map(([x, z, w, r], i) => (
        <mesh key={i} position={[x!, -DEPTH / 2, z!]} rotation-y={r!}>
          <planeGeometry args={[w!, DEPTH]} />
          <meshStandardMaterial map={tiles} roughness={0.4} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {Array.from({ length: LANES - 1 }, (_, i) => B.minZ + ((i + 1) * bd) / LANES).map((z) => (
        <Box key={z} p={[bcx, -0.22, z]} s={[bw, 0.06, 0.06]} color={'#ffd23f'} cast={false} />
      ))}
      {Array.from({ length: LANES }, (_, i) => (
        <Box key={i} p={[bcx, -DEPTH + 0.01, laneZ(i)]} s={[bw - 2, 0.01, 0.25]} color="#1f3f8f" cast={false} />
      ))}
      <Water />
      {/* edge coping */}
      <Box p={[bcx, 0.04, B.minZ - 0.15]} s={[bw + 0.6, 0.08, 0.3]} color="#f4f4f0" />
      <Box p={[bcx, 0.04, B.maxZ + 0.15]} s={[bw + 0.6, 0.08, 0.3]} color="#f4f4f0" />
      {/* starting blocks */}
      {Array.from({ length: LANES }, (_, i) => (
        <group key={i} position={[B.minX - 0.45, 0, laneZ(i)]}>
          <Box p={[0, 0.35, 0]} s={[0.6, 0.7, 0.55]} color="#f4f4f0" />
          <TextPanel p={[-0.31, 0.45, 0]} rotY={-Math.PI / 2} w={0.4} h={0.3} text={String(i + 1)} bg="#1f3f8f" />
        </group>
      ))}

      {def.solids.slice(0, 5).map((r, i) => (
        <WallFromRect key={i} r={r} h={WALL_H} color={i === 0 ? '#bcd8ea' : '#e8e2d6'} room={[0, 0]} />
      ))}
      <Cutaway axis="z" at={-12} outward={-1}>
        {[-12, -6, 0, 6, 12].map((x) => (
          <Box key={x} p={[x, 3.2, -11.95]} s={[4.6, 3.8, 0.04]} color="#d8ecf6" emissive="#bfe2f5" cast={false} />
        ))}
        <TextPanel p={[0, 5.4, -11.9]} w={8} h={0.7} text="KERAVAN UIMAHALLI" bg="#1f3f8f" />
      </Cutaway>
      {/* changing rooms + sauna */}
      <Box p={[0, 1.4, 8.75]} s={[10, 2.8, 6.5]} color="#cfd7dc" />
      <TextPanel p={[-2.5, 2.1, 5.48]} rotY={Math.PI} w={2} h={0.5} text="MIEHET" bg="#1f3f8f" />
      <TextPanel p={[2.5, 2.1, 5.48]} rotY={Math.PI} w={2} h={0.5} text="NAISET" bg="#c94a5a" />
      <Box p={[13.5, 1.4, 8.25]} s={[7, 2.8, 7.5]} color="#a5713e" rough={0.7} />
      <TextPanel p={[13.5, 2.1, 4.48]} rotY={Math.PI} w={2.2} h={0.5} text="SAUNA 80°" bg="#6b3f1f" />
      <Box p={[12.2, 1.05, 4.47]} s={[0.9, 2.1, 0.04]} color="#d8b98a" opacity={0.65} cast={false} />
      {/* lifeguard chair */}
      <Box p={[14.1, 0.8, -6]} s={[0.9, 1.6, 0.9]} color="#f4f4f0" />
      <Box p={[14.1, 1.62, -6]} s={[0.8, 0.06, 0.8]} color="#d62f2f" />
      <Lifeguard />
      {/* benches, towels */}
      {[-8, -3, 3, 8].map((x) => (
        <group key={x}>
          <Box p={[x, 0.22, -10.8]} s={[2.4, 0.08, 0.6]} color="#c89a5a" />
          <Box p={[x - 0.5, 0.29, -10.8]} s={[0.7, 0.04, 0.5]} color={x > 0 ? '#ff6fa8' : '#3a7bd5'} />
        </group>
      ))}
      <TextPanel p={[-15, 2.4, 3.4]} rotY={Math.PI / 2} w={3} h={1.3} text={'PESEYDY\nENNEN\nUINTIA'} bg="#1f3f8f" />

      <Swimmer lane={2} speed={1.6} offset={3} outfit={{ top: '#222', legs: '#222', shoes: '#c58f62', skin: '#e6b893', hair: '#2a1a10', hat: 'beanie', hatColor: '#ff6fa8', accent: '#fff' }} />
      <Swimmer lane={4} speed={1.1} offset={14} outfit={{ top: '#1f3f8f', legs: '#1f3f8f', shoes: '#c58f62', skin: '#8a5a3c', hair: '#111', hat: 'beanie', hatColor: '#fff', accent: '#fff' }} />
      {swimT0 !== null && <PlayerSwim t0={swimT0} clockRef={clockRef} outfit={outfit} />}
    </group>
  );
}
