import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { DOOR_XS, TRAIN, toWorld, type StationLayout } from '../../game/world/station';
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
/** Depth of the vestibule behind the platform-side doors. */
const VEST = 0.95;
const WALL_T = 0.08;
const DOOR_H = 2.3;

/** [a, b] minus each door opening (centre ± DOOR_W), as the pieces that remain. */
function spans(a: number, b: number, doors: number[]): (readonly [number, number])[] {
  const out: (readonly [number, number])[] = [];
  let x = a;
  for (const d of [...doors].sort((p, q) => p - q)) {
    if (d - DOOR_W > x) out.push([x, d - DOOR_W] as const);
    x = Math.max(x, d + DOOR_W);
  }
  if (x < b) out.push([x, b] as const);
  return out;
}

/** The platform-side wall of one car, with door-shaped holes, plus the roof, floor and end strips that close the vestibule space. */
function PlatformWall({ L, h, doors }: { L: number; h: number; doors: number[] }) {
  const geo = useMemo(() => {
    const shape = new THREE.Shape();
    const r = 0.3;
    shape.moveTo(-L / 2, 0);
    shape.lineTo(L / 2, 0);
    shape.lineTo(L / 2, h - r);
    shape.quadraticCurveTo(L / 2, h, L / 2 - r, h);
    shape.lineTo(-L / 2 + r, h);
    shape.quadraticCurveTo(-L / 2, h, -L / 2, h - r);
    shape.closePath();
    for (const d of doors) {
      const hole = new THREE.Path();
      hole.moveTo(d - DOOR_W, 0.02);
      hole.lineTo(d - DOOR_W, DOOR_H);
      hole.lineTo(d + DOOR_W, DOOR_H);
      hole.lineTo(d + DOOR_W, 0.02);
      hole.closePath();
      shape.holes.push(hole);
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: WALL_T, bevelEnabled: false, curveSegments: 4 });
    g.computeVertexNormals();
    return g;
  }, [L, h, doors]);
  const zMid = W / 2 - VEST / 2;
  return (
    <group>
      <mesh geometry={geo} position={[0, FLOOR, W / 2 - WALL_T]} castShadow receiveShadow>
        <meshStandardMaterial color={BODY} roughness={0.35} metalness={0.15} />
      </mesh>
      {/* roof and floor of the vestibule strip, and its two ends */}
      <mesh position={[0, FLOOR + h - 0.06, zMid]}>
        <boxGeometry args={[L - 0.6, 0.12, VEST]} />
        <meshStandardMaterial color={BODY} roughness={0.35} metalness={0.15} />
      </mesh>
      <mesh position={[0, FLOOR + 0.05, zMid]} receiveShadow>
        <boxGeometry args={[L - 0.2, 0.1, VEST]} />
        <meshStandardMaterial color="#5d6168" roughness={0.9} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (L / 2 - 0.2), FLOOR + h / 2, zMid]}>
          <boxGeometry args={[0.1, h - 0.1, VEST]} />
          <meshStandardMaterial color={BODY} roughness={0.35} metalness={0.15} />
        </mesh>
      ))}
    </group>
  );
}

/** What you see through an open door: a lit vestibule with a grab pole, glass screens and the seats beyond. */
function Vestibule() {
  const back = -0.02 - VEST + 0.01;
  return (
    <group>
      {/* back wall with the aisle opening and seat backs either side */}
      <mesh position={[0, 1.3, back]}>
        <planeGeometry args={[DOOR_W * 2, 2.6]} />
        <meshStandardMaterial color="#d4d9e0" roughness={0.6} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.95, 0, back + 0.02]}>
          <mesh position={[0, 0.75, 0]}>
            <planeGeometry args={[0.7, 0.9]} />
            <meshStandardMaterial color={BLUE} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.32, 0]}>
            <planeGeometry args={[0.7, 0.12]} />
            <meshStandardMaterial color="#2b2f36" roughness={0.8} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 1.15, back + 0.015]}>
        <planeGeometry args={[0.9, 2.2]} />
        <meshStandardMaterial color="#8d949e" roughness={0.7} />
      </mesh>
      {/* ceiling light */}
      <mesh position={[0, DOOR_H + 0.28, -VEST / 2]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[DOOR_W * 1.6, 0.22]} />
        <meshStandardMaterial color="#fffbea" emissive="#fff3cf" emissiveIntensity={1.6} side={THREE.DoubleSide} />
      </mesh>
      {/* yellow grab pole */}
      <mesh position={[0, 1.4, -VEST * 0.45]}>
        <cylinderGeometry args={[0.03, 0.03, 2.8, 10]} />
        <meshStandardMaterial color={YELLOW} metalness={0.5} roughness={0.35} />
      </mesh>
      {/* glass screens at the sides of the doorway */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (DOOR_W - 0.05), 1.3, -VEST / 2]} rotation-y={Math.PI / 2}>
          <planeGeometry args={[VEST - 0.1, 1.6]} />
          <meshStandardMaterial color="#9fc3d8" transparent opacity={0.35} roughness={0.1} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      {/* dark rubber door frame */}
      {[-1, 1].map((s) => (
        <mesh key={`f${s}`} position={[s * DOOR_W, 1.15, -0.03]}>
          <boxGeometry args={[0.06, DOOR_H, 0.06]} />
          <meshStandardMaterial color="#1e2024" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, DOOR_H, -0.03]}>
        <boxGeometry args={[DOOR_W * 2 + 0.06, 0.06, 0.06]} />
        <meshStandardMaterial color="#1e2024" roughness={0.8} />
      </mesh>
    </group>
  );
}

function Car({ index, doorLeaves }: { index: number; doorLeaves: MutableRefObject<THREE.Group[]> }) {
  const L = TRAIN.carLength;
  const isFront = index === TRAIN.cars - 1;
  const isBack = index === 0;
  const cx = (index - (TRAIN.cars - 1) / 2) * (L + TRAIN.carGap);
  const doors = DOOR_XS.filter((d) => Math.abs(d - cx) < L / 2).map((d) => d - cx);
  const h = ROOF - FLOOR;

  return (
    <group position={[cx, 0, 0]}>
      {/* main body: the platform side is a separate wall with real door openings and a vestibule behind them */}
      <RoundedBox args={[L, h, W - VEST]} radius={0.35} smoothness={3} position={[0, FLOOR + h / 2, -VEST / 2]} castShadow receiveShadow>
        <meshStandardMaterial color={BODY} roughness={0.35} metalness={0.15} />
      </RoundedBox>
      <PlatformWall L={L} h={h} doors={doors} />
      {/* window band and stripes: full length on the far side, between the doors on the platform side */}
      {[1, -1].map((side) =>
        (side > 0 ? spans(-L / 2 + 0.8, L / 2 - 0.8, doors) : [[-L / 2 + 0.8, L / 2 - 0.8] as const]).map(([a, b]) => (
          <group key={`${side}${a}`} position={[(a + b) / 2, 0, (side * W) / 2]}>
            {([[2.45, 1.05, GLASS], [1.55, 0.32, BLUE], [1.33, 0.08, YELLOW]] as const).map(([y, hh, c]) => (
              <mesh key={y} position={[0, y, side * 0.012]} rotation-y={side < 0 ? Math.PI : 0}>
                <planeGeometry args={[b - a, hh]} />
                <meshStandardMaterial color={c} roughness={c === GLASS ? 0.22 : 0.4} metalness={c === GLASS ? 0.6 : 0} />
              </mesh>
            ))}
          </group>
        )),
      )}
      {/* doors on the platform side (+z): two sliding leaves each, a lit vestibule behind */}
      {doors.map((dx) => (
        <group key={dx} position={[dx, FLOOR, W / 2 + 0.02]}>
          <Vestibule />
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

export function Train({ layout, clockRef, railAt }: { layout: StationLayout; clockRef: MutableRefObject<number>; railAt?: (x: number, z: number) => number }) {
  const group = useRef<THREE.Group>(null);
  const carGroups = useRef<(THREE.Group | null)[]>([]);
  const doorLeaves = useRef<THREE.Group[]>([]);
  const cars = useMemo(() => Array.from({ length: TRAIN.cars }, (_, i) => i), []);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const s = trainStateAt(clockRef.current);
    g.visible = s.visible;
    g.position.x = s.x;
    for (const leaf of doorLeaves.current) leaf.position.x = (leaf.userData.side as number) * s.doors * (DOOR_W - 0.1);
    // each car rides on the rails: height and pitch from the track bed under its two bogies
    if (!railAt || !s.visible) return;
    const base = railAt(layout.origin[0], layout.origin[1]);
    const L = TRAIN.carLength;
    for (const i of cars) {
      const car = carGroups.current[i];
      if (!car) continue;
      const cx = (i - (TRAIN.cars - 1) / 2) * (L + TRAIN.carGap) + s.x;
      const [bx, bz] = toWorld(layout, [cx - L / 2 + 3.5, 0]);
      const [fx, fz] = toWorld(layout, [cx + L / 2 - 3.5, 0]);
      const yb = railAt(bx, bz) - base, yf = railAt(fx, fz) - base;
      car.position.y = (yb + yf) / 2;
      car.rotation.z = Math.atan2(yf - yb, L - 7);
    }
  });

  return (
    <group position={[layout.origin[0], 0, layout.origin[1]]} rotation-y={layout.rotationY}>
      <group ref={group}>
        {cars.map((i) => (
          <group key={i} ref={(el) => void (carGroups.current[i] = el)}>
            <Car index={i} doorLeaves={doorLeaves} />
          </group>
        ))}
      </group>
    </group>
  );
}
