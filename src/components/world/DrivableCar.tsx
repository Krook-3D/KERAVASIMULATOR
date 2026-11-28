import { useEffect, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CAR_HALF_L, stepCar, type CarModel, type CarState } from '../../game/vehicle/cars';
import type { ControlState } from './controls';
import { useCarGeometries } from './StreetProps';
import { NIGHT } from './nightState';
import { setEngine } from '../../audio/ambience';

/** One car: body in its colour, glass, wheels and lights (headlights glow at night). */
export function CarMesh({ color, lightsRef }: { color: string; lightsRef?: MutableRefObject<THREE.MeshStandardMaterial | null> }) {
  const g = useCarGeometries();
  return (
    <group>
      <mesh geometry={g.body} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.35} />
      </mesh>
      <mesh geometry={g.glass}>
        <meshStandardMaterial color="#1f2c3a" roughness={0.15} metalness={0.6} />
      </mesh>
      <mesh geometry={g.wheels} castShadow>
        <meshStandardMaterial color="#18191c" roughness={0.8} />
      </mesh>
      <mesh geometry={g.lights}>
        <meshStandardMaterial ref={lightsRef} color="#fffbe8" emissive="#fff2c0" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

const FWD = ['w', 'arrowup'];
const BACK = ['s', 'arrowdown'];
const LEFT = ['a', 'arrowleft'];
const RIGHT = ['d', 'arrowright'];

/**
 * The player's own car. Parked it just sits there; while `driving` the keys
 * steer it (W/S gas and brake, A/D steer, Space handbrake), the camera swings
 * in behind it and the player's position (camera target, minimap) follows.
 */
export function DrivableCar({ color, model, stateRef, driving, controlRef, positionRef, groundHeight, blocked, onCrash, onSpeed }: {
  color: string;
  model: CarModel;
  stateRef: MutableRefObject<CarState>;
  driving: boolean;
  controlRef: MutableRefObject<ControlState>;
  positionRef: MutableRefObject<THREE.Vector3>;
  groundHeight: (x: number, z: number) => number;
  blocked: (x: number, z: number) => boolean;
  onCrash: (impact: number) => void;
  onSpeed?: (speed: number) => void;
}) {
  const root = useRef<THREE.Group>(null);
  const lights = useRef<THREE.MeshStandardMaterial | null>(null);
  const brake = useRef(false);
  const lastCrash = useRef(0);

  useEffect(() => {
    if (!driving) return;
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        brake.current = true;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => e.code === 'Space' && (brake.current = false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    const c = controlRef.current;
    const dist = c.dist;
    c.dist = Math.max(c.dist, 9);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      brake.current = false;
      c.dist = dist;
      setEngine(false, 0);
    };
  }, [driving, controlRef]);

  useFrame((_, dt) => {
    const g = root.current;
    if (!g) return;
    let s = stateRef.current;
    if (driving) {
      const keys = controlRef.current.keys;
      const on = (k: string[]) => k.some((x) => keys.has(x));
      const input = { throttle: (on(FWD) ? 1 : 0) - (on(BACK) ? 1 : 0), steer: (on(RIGHT) ? 1 : 0) - (on(LEFT) ? 1 : 0), brake: brake.current };
      const r = stepCar(s, input, model, dt, blocked);
      s = stateRef.current = r.state;
      const now = performance.now();
      if (r.impact > 3 && now - lastCrash.current > 600) {
        lastCrash.current = now;
        onCrash(r.impact);
      }
      // the camera target is the car; the camera swings in behind it as it drives
      const p = positionRef.current;
      p.x = s.x;
      p.z = s.z;
      const c = controlRef.current;
      const behind = s.yaw + Math.PI;
      let d = behind - c.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      c.yaw += d * Math.min(1, dt * 2.2 * Math.min(1, Math.abs(s.speed) / 4));
      setEngine(true, Math.abs(s.speed) / model.top);
      onSpeed?.(s.speed);
    }
    // sit on the ground, pitched along the slope
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
    const yf = groundHeight(s.x + fx * CAR_HALF_L * 0.8, s.z + fz * CAR_HALF_L * 0.8);
    const yb = groundHeight(s.x - fx * CAR_HALF_L * 0.8, s.z - fz * CAR_HALF_L * 0.8);
    g.position.set(s.x, (yf + yb) / 2, s.z);
    g.rotation.set(0, s.yaw, 0);
    g.rotateX(-Math.atan2(yf - yb, CAR_HALF_L * 1.6));
    if (lights.current) lights.current.emissiveIntensity = 0.4 + NIGHT.value * (driving ? 6 : 1);
  });

  return (
    <group ref={root}>
      <CarMesh color={color} lightsRef={lights} />
    </group>
  );
}
