/**
 * Cars: models for sale at the used-car lot beside Motonet, and the driving
 * physics (a simple bicycle model). Pure functions, so the 3D car, the tests
 * and a future server can share them.
 */

export type CarModelId = 'romu' | 'farmari' | 'tuunattu';

export interface CarModel {
  id: CarModelId;
  name: string;
  price: number;
  /** Top speed forward, m/s. */
  top: number;
  /** Acceleration, m/s². */
  accel: number;
  /** Turning: how sharp the car can steer (rad of heading per metre at full lock). */
  grip: number;
  colors: string[];
  blurb: string;
}

export const CAR_MODELS: Record<CarModelId, CarModel> = {
  romu: {
    id: 'romu',
    name: 'Ruosteinen pikkuauto',
    price: 450,
    top: 17,
    accel: 3.2,
    grip: 0.16,
    colors: ['#9a3b2e', '#6f7a3c', '#c9c2b2'],
    blurb: 'Katsastettu viimeksi joskus. Lämmitin toimii, radio ei.',
  },
  farmari: {
    id: 'farmari',
    name: 'Luotettava farmari',
    price: 1200,
    top: 22,
    accel: 4.2,
    grip: 0.17,
    colors: ['#2b3a55', '#e9e6df', '#4a4f57'],
    blurb: 'Iso takakontti, vetokoukku ja vain yksi omistaja ennen sinua.',
  },
  tuunattu: {
    id: 'tuunattu',
    name: 'Tuunattu sedan',
    price: 3200,
    top: 28,
    accel: 6,
    grip: 0.19,
    colors: ['#ffd23f', '#111318', '#d4202a'],
    blurb: 'Matalaksi laskettu, isot vanteet ja pakoputki joka kuuluu Savioon asti.',
  },
};

/** Buying back: the lot pays this share of the price. */
export const CAR_RESALE = 0.5;
export const REVERSE_TOP = 5;
/** Collision box, metres. */
export const CAR_HALF_W = 0.9;
export const CAR_HALF_L = 2.05;

export interface CarState {
  x: number;
  z: number;
  /** Heading: the car points along (sin yaw, cos yaw). */
  yaw: number;
  /** Signed speed along the heading, m/s. */
  speed: number;
  /** Steering −1…1 (smoothed). */
  steer: number;
}

export interface DriveInput {
  /** −1 (brake / reverse) … 1 (gas). */
  throttle: number;
  /** −1 (left) … 1 (right). */
  steer: number;
  /** Handbrake. */
  brake?: boolean;
}

/** Points to test for a collision: the corners and mid-sides of the car's box. */
export function carProbe(s: Pick<CarState, 'x' | 'z' | 'yaw'>): [number, number][] {
  const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
  const rx = fz, rz = -fx;
  const out: [number, number][] = [];
  for (const l of [-CAR_HALF_L, 0, CAR_HALF_L])
    for (const w of [-CAR_HALF_W, CAR_HALF_W]) out.push([s.x + fx * l + rx * w, s.z + fz * l + rz * w]);
  return out;
}

/**
 * One physics step. `blocked` says whether a world point is inside a wall,
 * fence or the track bed; on a hit the car stops and bounces back a little.
 * Returns the new state and the impact speed (0 when nothing was hit).
 */
export function stepCar(s: CarState, input: DriveInput, m: CarModel, dt: number, blocked: (x: number, z: number) => boolean): { state: CarState; impact: number } {
  dt = Math.min(dt, 0.1);
  let speed = s.speed;
  const t = Math.max(-1, Math.min(1, input.throttle));
  if (t > 0) speed += (speed < 0 ? m.accel * 2.2 : m.accel * (1 - Math.max(0, speed) / m.top)) * t * dt;
  else if (t < 0) speed += (speed > 0.3 ? -m.accel * 2.4 : -m.accel * 0.8 * (1 + speed / REVERSE_TOP)) * -t * dt;
  // rolling resistance and air drag
  const drag = 0.6 + 0.012 * speed * speed;
  if (t === 0 || input.brake) speed -= Math.sign(speed) * Math.min(Math.abs(speed), (input.brake ? 9 : drag) * dt);
  speed = Math.max(-REVERSE_TOP, Math.min(m.top, speed));

  const steer = s.steer + (Math.max(-1, Math.min(1, input.steer)) - s.steer) * Math.min(1, dt * 6);
  // less steering at high speed, so it stays drivable
  const lock = m.grip / (1 + Math.abs(speed) / 14);
  const yaw = s.yaw - steer * lock * speed * dt;
  const nx = s.x + Math.sin(yaw) * speed * dt;
  const nz = s.z + Math.cos(yaw) * speed * dt;
  const next = { x: nx, z: nz, yaw, speed, steer };
  if (carProbe(next).some(([x, z]) => blocked(x, z))) {
    return { state: { ...s, yaw: s.yaw, speed: -speed * 0.25, steer }, impact: Math.abs(speed) };
  }
  return { state: next, impact: 0 };
}

export const kmh = (speed: number) => Math.round(Math.abs(speed) * 3.6);

/** Damage to the player from a crash at this speed (m/s): nothing under ~25 km/h. */
export const crashHurt = (impact: number) => (impact < 7 ? 0 : Math.round((impact - 7) * 2.5));
