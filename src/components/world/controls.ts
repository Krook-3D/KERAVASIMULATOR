/**
 * Third-person controls shared by the camera and the player: the mouse turns
 * the camera (pointer locked to the centre of the screen), the arrow keys or
 * WASD move the character relative to where the camera looks.
 */
export interface ControlState {
  /** Camera angle around the player (radians); 0 = camera south of the player, looking north. */
  yaw: number;
  /** Camera tilt above the horizon (radians). */
  pitch: number;
  /** Camera distance from the player (metres). */
  dist: number;
  /** Movement keys held right now. */
  keys: Set<string>;
  /** Camera angles were taken from the current camera position. */
  ready: boolean;
}

export const PITCH_MIN = 0.05;
export const PITCH_MAX = 1.15;
export const DIST_MIN = 2.6;
export const DIST_MAX = 14;

export const createControls = (): ControlState => ({ yaw: 0, pitch: 0.36, dist: 5.6, keys: new Set(), ready: false });

const FORWARD = ['arrowup', 'w'];
const BACK = ['arrowdown', 's'];
const LEFT = ['arrowleft', 'a'];
const RIGHT = ['arrowright', 'd'];
export const MOVE_KEYS = new Set([...FORWARD, ...BACK, ...LEFT, ...RIGHT]);

const held = (keys: Set<string>, names: string[]) => names.some((k) => keys.has(k));

/**
 * World-space walking direction (unit vector, or [0, 0] when no key is held).
 * Forward is the direction the camera looks along the ground.
 */
export function moveDir(c: Pick<ControlState, 'yaw' | 'keys'>): [number, number] {
  const f = (held(c.keys, FORWARD) ? 1 : 0) - (held(c.keys, BACK) ? 1 : 0);
  const r = (held(c.keys, RIGHT) ? 1 : 0) - (held(c.keys, LEFT) ? 1 : 0);
  if (!f && !r) return [0, 0];
  // camera sits at +(sin yaw, cos yaw) from the player, so forward is the opposite
  const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
  const rx = -fz, rz = fx;
  const x = fx * f + rx * r, z = fz * f + rz * r;
  const len = Math.hypot(x, z);
  return [x / len, z / len];
}
