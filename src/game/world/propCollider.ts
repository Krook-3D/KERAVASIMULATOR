import type { WorldXZ } from './projection';

const CELL = 8;

type Shape =
  | { kind: 'circle'; x: number; z: number; r: number }
  | { kind: 'box'; x: number; z: number; hw: number; hd: number; cos: number; sin: number };

/**
 * Small solid things in the street the player can't walk through: lamp posts
 * (circles), parked cars and bus shelter walls (rotated boxes). Stored in a
 * coarse grid so checks stay cheap.
 */
export class PropCollider {
  private cells = new Map<string, Shape[]>();

  private add(s: Shape, reach: number) {
    for (let cx = Math.floor((s.x - reach) / CELL); cx <= Math.floor((s.x + reach) / CELL); cx++)
      for (let cz = Math.floor((s.z - reach) / CELL); cz <= Math.floor((s.z + reach) / CELL); cz++) {
        const k = `${cx},${cz}`;
        const l = this.cells.get(k);
        if (l) l.push(s);
        else this.cells.set(k, [s]);
      }
  }

  circle(x: number, z: number, r: number) {
    this.add({ kind: 'circle', x, z, r }, r + 1);
    return this;
  }

  /** Box of half-width `hw` (local x) and half-depth `hd` (local z), turned by `yaw` around Y. */
  box(x: number, z: number, hw: number, hd: number, yaw: number) {
    this.add({ kind: 'box', x, z, hw, hd, cos: Math.cos(yaw), sin: Math.sin(yaw) }, Math.hypot(hw, hd) + 1);
    return this;
  }

  /** A box given in a parent's local frame (origin + yaw), e.g. a part of a bus shelter. */
  boxIn(ox: number, oz: number, yaw: number, lx: number, lz: number, hw: number, hd: number) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    // three.js rotation.y: world = (x c + z s, -x s + z c)
    return this.box(ox + lx * c + lz * s, oz - lx * s + lz * c, hw, hd, yaw);
  }

  isBlocked([x, z]: WorldXZ, radius = 0.3): boolean {
    const list = this.cells.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`);
    if (!list) return false;
    for (const s of list) {
      if (s.kind === 'circle') {
        if (Math.hypot(x - s.x, z - s.z) < s.r + radius) return true;
      } else {
        const dx = x - s.x, dz = z - s.z;
        // into the box's local frame (inverse of the rotation above)
        const lx = dx * s.cos - dz * s.sin, lz = dx * s.sin + dz * s.cos;
        if (Math.abs(lx) < s.hw + radius && Math.abs(lz) < s.hd + radius) return true;
      }
    }
    return false;
  }
}
