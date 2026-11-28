import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { DOOR_XS, TRAIN, type StationLayout } from '../../game/world/station';
import { trainStateAt } from '../../game/world/trainSchedule';

/**
 * Original low-poly electric commuter train: three cars, white body with a
 * Kerava blue/yellow stripe, sliding doors on the platform side.
 */
const BODY = '#f2f2ee';
const BLUE = '#2a5fb8';
const YELLOW = '#ffd23f';
const GLASS = '#1f2c3a';
const UNDER = '#33363c';

const W = 3.2; // car width
const FLOOR = 0.6;
const ROOF = 4.0;
const DOOR_W = 1.3;

function Car({ index, doorLeaves }: { index: number; doorLeaves: MutableRefObject<THREE.Group[]> }) {
  const L = TRAIN.carLength;
  const isFront = index === TRAIN.cars - 1;
  const isBack = index === 0;
  const cx = (index - (TRAIN.cars - 1) / 2) * (L + TRAIN.carGap);
  const doors = DOOR_XS.filter((d) => Math.abs(d - cx) < L / 2).map((d) => d - cx);
  const h = ROOF - FLOOR;

  return (
    <group position={[cx, 0, 0]}>
      {/* main body */}
      <RoundedBox args={[L, h, W]} radius={0.35} smoothness={3} position={[0, FLOOR + h / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={BODY} roughness={0.35} metalness={0.15} />
      </RoundedBox>
      {/* window band and stripes on both sides */}
      {[1, -1].map((side) => (
        <group key={side} position={[0, 0, (side * W) / 2]}>
          <mesh position={[0, 2.45, side * 0.012]} rotation-y={side < 0 ? Math.PI : 0}>
            <planeGeometry args={[L - 1.6, 1.05]} />
            <meshStandardMaterial color={GLASS} roughness={0.22} metalness={0.6} />
          </mesh>
          <mesh position={[0, 1.55, side * 0.012]} rotation-y={side < 0 ? Math.PI : 0}>
            <planeGeometry args={[L - 0.8, 0.32]} />
            <meshStandardMaterial color={BLUE} roughness={0.4} />
          </mesh>
          <mesh position={[0, 1.33, side * 0.012]} rotation-y={side < 0 ? Math.PI : 0}>
            <planeGeometry args={[L - 0.8, 0.08]} />
            <meshStandardMaterial color={YELLOW} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* doors on the platform side (+z), two sliding leaves each */}
      {doors.map((dx) => (
        <group key={dx} position={[dx, FLOOR, W / 2 + 0.02]}>
          <mesh position={[0, 1.15, -0.03]}>
            <planeGeometry args={[DOOR_W * 2, 2.3]} />
            <meshStandardMaterial color="#9fb3c4" roughness={0.6} />
          </mesh>
          {[-1, 1].map((s) => (
            <group
              key={s}
              ref={(g) => {
                if (g && !doorLeaves.current.includes(g)) {
                  g.userData.side = s;
                  doorLeaves.current.push(g);
                }
              }}
            >
              <mesh position={[(s * DOOR_W) / 2, 1.15, 0]} castShadow>
                <boxGeometry args={[DOOR_W - 0.04, 2.3, 0.06]} />
                <meshStandardMaterial color={BLUE} roughness={0.4} />
              </mesh>
              <mesh position={[(s * DOOR_W) / 2, 1.45, 0.035]}>
                <planeGeometry args={[DOOR_W - 0.4, 1.1]} />
                <meshStandardMaterial color={GLASS} roughness={0.22} metalness={0.6} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      {/* roof equipment */}
      <mesh position={[0, ROOF + 0.15, 0]} castShadow>
        <boxGeometry args={[L * 0.55, 0.3, W * 0.6]} />
        <meshStandardMaterial color="#9ca1a8" roughness={0.5} metalness={0.4} />
      </mesh>
      {index === 1 && (
        <group position={[2, ROOF + 0.3, 0]}>
          <mesh position={[0, 0.5, 0]} rotation-z={0.6}>
            <boxGeometry args={[0.08, 1.3, 0.08]} />
            <meshStandardMaterial color={UNDER} metalness={0.7} />
          </mesh>
          <mesh position={[0.4, 1.05, 0]}>
            <boxGeometry args={[0.1, 0.06, 1.8]} />
            <meshStandardMaterial color={UNDER} metalness={0.7} />
          </mesh>
        </group>
      )}
      {/* underframe and bogies */}
      <mesh position={[0, FLOOR - 0.12, 0]}>
        <boxGeometry args={[L - 1, 0.3, W - 0.4]} />
        <meshStandardMaterial color={UNDER} roughness={0.8} />
      </mesh>
      {[-L / 2 + 3.5, L / 2 - 3.5].map((bx) => (
        <group key={bx} position={[bx, 0.42, 0]}>
          <mesh>
            <boxGeometry args={[3, 0.35, W - 0.7]} />
            <meshStandardMaterial color="#1e2024" roughness={0.7} />
          </mesh>
          {[-0.9, 0.9].map((wx) =>
            [-0.75, 0.75].map((wz) => (
              <mesh key={`${wx}${wz}`} position={[wx, -0.05, wz]} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[0.38, 0.38, 0.12, 14]} />
                <meshStandardMaterial color="#3a3d42" metalness={0.8} roughness={0.35} />
              </mesh>
            )),
          )}
        </group>
      ))}
      {/* sloped cab nose with windscreen and headlights */}
      {(isFront || isBack) && (
        <group position={[isFront ? L / 2 : -L / 2, 0, 0]} scale={[isFront ? 1 : -1, 1, 1]}>
          <mesh position={[0.9, FLOOR + 1.1, 0]} castShadow>
            <boxGeometry args={[1.8, 2.2, W - 0.05]} />
            <meshStandardMaterial color={BODY} roughness={0.35} metalness={0.15} />
          </mesh>
          <mesh position={[0.55, FLOOR + 2.75, 0]} rotation-z={-0.62} castShadow>
            <boxGeometry args={[1.95, 0.12, W - 0.1]} />
            <meshStandardMaterial color={GLASS} roughness={0.22} metalness={0.6} />
          </mesh>
          <mesh position={[1.81, FLOOR + 0.75, 0]}>
            <boxGeometry args={[0.05, 0.5, W - 0.2]} />
            <meshStandardMaterial color={YELLOW} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[1.84, FLOOR + 1.35, s * 1.0]}>
              <boxGeometry args={[0.04, 0.18, 0.35]} />
              <meshStandardMaterial color="#fffbe8" emissive="#fff4c8" emissiveIntensity={2.5} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

export function Train({ layout, clockRef }: { layout: StationLayout; clockRef: MutableRefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const doorLeaves = useRef<THREE.Group[]>([]);
  const cars = useMemo(() => Array.from({ length: TRAIN.cars }, (_, i) => i), []);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const s = trainStateAt(clockRef.current);
    g.visible = s.visible;
    g.position.x = s.x;
    for (const leaf of doorLeaves.current) leaf.position.x = (leaf.userData.side as number) * s.doors * (DOOR_W - 0.1);
  });

  return (
    <group position={[layout.origin[0], 0, layout.origin[1]]} rotation-y={layout.rotationY}>
      <group ref={group}>
        {cars.map((i) => (
          <Car key={i} index={i} doorLeaves={doorLeaves} />
        ))}
      </group>
    </group>
  );
}
