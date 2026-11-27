import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Procedural, original low-poly human built as ONE skinned mesh with a real
 * skeleton. Proportions follow an adult of about 1.8 m (roughly 7.5 heads
 * tall): shoulders ~0.47 m wide, legs about half the height, elbows at the
 * waist and wrists at the crotch. Joints (elbows, knees, shoulders, hips,
 * spine, neck) have blended skin weights so they bend smoothly instead of
 * looking like separate blocks.
 *
 * Coordinates: character faces +z, its left side is +x, feet at y = 0.
 */

export interface Outfit {
  top: string;
  legs: string;
  shoes: string;
  skin?: string;
  hair?: string;
  hat: 'beanie' | 'cap' | 'none';
  hatColor: string;
  accent: string;
  backpack?: boolean;
  /** hoodie (default) or a uniform jacket with collar. */
  style?: 'hoodie' | 'jacket';
  /** Small prop in the right hand. */
  prop?: 'phone' | 'reader';
  /** Body width multiplier, 0.9–1.15. */
  build?: number;
}

export const BONE_NAMES = [
  'root',
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'upperArmL',
  'forearmL',
  'handL',
  'upperArmR',
  'forearmR',
  'handR',
  'thighL',
  'shinL',
  'footL',
  'thighR',
  'shinR',
  'footR',
] as const;
export type BoneName = (typeof BONE_NAMES)[number];
export type HumanBones = Record<BoneName, THREE.Bone>;

const B = Object.fromEntries(BONE_NAMES.map((n, i) => [n, i])) as Record<BoneName, number>;

/** Rest (bind) positions of the joints in model space. */
const J = {
  root: [0, 0, 0],
  hips: [0, 0.95, 0],
  spine: [0, 1.07, -0.005],
  chest: [0, 1.25, -0.005],
  neck: [0, 1.48, -0.01],
  head: [0, 1.585, 0],
  upperArmL: [0.185, 1.415, -0.01],
  forearmL: [0.215, 1.135, -0.02],
  handL: [0.228, 0.885, 0.0],
  upperArmR: [-0.185, 1.415, -0.01],
  forearmR: [-0.215, 1.135, -0.02],
  handR: [-0.228, 0.885, 0.0],
  thighL: [0.092, 0.915, 0],
  shinL: [0.1, 0.5, 0.005],
  footL: [0.105, 0.085, -0.01],
  thighR: [-0.092, 0.915, 0],
  shinR: [-0.1, 0.5, 0.005],
  footR: [-0.105, 0.085, -0.01],
} satisfies Record<BoneName, [number, number, number]>;

const PARENT: Partial<Record<BoneName, BoneName>> = {
  hips: 'root',
  spine: 'hips',
  chest: 'spine',
  neck: 'chest',
  head: 'neck',
  upperArmL: 'chest',
  forearmL: 'upperArmL',
  handL: 'forearmL',
  upperArmR: 'chest',
  forearmR: 'upperArmR',
  handR: 'forearmR',
  thighL: 'hips',
  shinL: 'thighL',
  footL: 'shinL',
  thighR: 'hips',
  shinR: 'thighR',
  footR: 'shinR',
};

type Weights = [number, number][]; // [boneIndex, weight]
type WeightFn = (p: THREE.Vector3) => Weights;
type ColorFn = (p: THREE.Vector3) => THREE.Color;

interface Part {
  geo: THREE.BufferGeometry;
  color: ColorFn;
  weights: WeightFn;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

const v3 = (a: readonly number[]) => new THREE.Vector3(a[0], a[1], a[2]);

/** Strip to positions, weld and recompute smooth normals. */
function clean(g: THREE.BufferGeometry): THREE.BufferGeometry {
  let geo = g;
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  geo = mergeVertices(geo, 1e-5);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Smooth tube along a segment with an elliptical, varying cross-section.
 * profile: [t (0 at `from`, 1 at `to`), rx, rz, zOffset]. Ends are capped
 * with rounded domes so joints overlap cleanly when bent.
 */
function limb(from: THREE.Vector3, to: THREE.Vector3, profile: [number, number, number, number?][], radial = 14): THREE.BufferGeometry {
  const L = from.distanceTo(to);
  const first = profile[0]!;
  const last = profile[profile.length - 1]!;
  // Build in a local frame where `from` is at y=0 and `to` at y=-L.
  type Ring = { y: number; rx: number; rz: number; oz: number };
  const rings: Ring[] = [];
  const cap = (r: Ring, dir: 1 | -1) => {
    const out: Ring[] = [];
    const steps = 4;
    for (let i = steps; i >= 1; i--) {
      const a = (i / steps) * (Math.PI / 2);
      out.push({ y: r.y + dir * Math.sin(a) * Math.min(r.rx, r.rz) * 0.85, rx: r.rx * Math.cos(a), rz: r.rz * Math.cos(a), oz: r.oz });
    }
    return out;
  };
  const body: Ring[] = profile.map(([t, rx, rz, oz]) => ({ y: -t * L, rx, rz, oz: oz ?? 0 }));
  // bottom cap (lowest y) first, increasing y
  const bottom = { y: -last[0] * L, rx: last[1], rz: last[2], oz: last[3] ?? 0 };
  const top = { y: -first[0] * L, rx: first[1], rz: first[2], oz: first[3] ?? 0 };
  rings.push(...cap(bottom, -1));
  rings.push(...[...body].reverse());
  rings.push(...cap(top, 1).reverse());

  const pos: number[] = [];
  const idx: number[] = [];
  rings.forEach((r) => {
    for (let s = 0; s <= radial; s++) {
      const a = (s / radial) * Math.PI * 2;
      pos.push(Math.sin(a) * r.rx, r.y, Math.cos(a) * r.rz + r.oz);
    }
  });
  const row = radial + 1;
  for (let i = 0; i < rings.length - 1; i++) {
    for (let s = 0; s < radial; s++) {
      const a = i * row + s;
      const b = a + row;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const dir = to.clone().sub(from).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  g.applyQuaternion(q);
  g.translate(from.x, from.y, from.z);
  return clean(g);
}

function roundedBox(w: number, h: number, d: number, r: number, seg = 3): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  const inner = new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r);
  const v = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(THREE.MathUtils.clamp(v.x, -inner.x, inner.x), THREE.MathUtils.clamp(v.y, -inner.y, inner.y), THREE.MathUtils.clamp(v.z, -inner.z, inner.z));
    v.sub(c);
    if (v.lengthSq() > 0) v.setLength(r);
    v.add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return clean(g);
}

function ellipsoid(rx: number, ry: number, rz: number, w = 14, h = 10, thetaStart = 0, thetaLength = Math.PI): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, w, h, 0, Math.PI * 2, thetaStart, thetaLength);
  g.scale(rx, ry, rz);
  return clean(g);
}

const at = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  return g;
};

const only = (b: BoneName): WeightFn => () => [[B[b], 1]];

const AXIS_END: Partial<Record<BoneName, BoneName>> = {
  upperArmL: 'forearmL',
  forearmL: 'handL',
  upperArmR: 'forearmR',
  forearmR: 'handR',
  thighL: 'shinL',
  shinL: 'footL',
  thighR: 'shinR',
  shinR: 'footR',
};

/**
 * Weights for a part owned by `own`: blends 50/50 into `parent` at the start
 * joint and into `child` at the end joint, fading out over `blend` metres
 * measured along the bone axis (so the whole ring at a joint bends together).
 */
function limbWeights(own: BoneName, parent: BoneName | null, child: BoneName | null, blend = 0.06): WeightFn {
  const s = v3(J[own]);
  const endName = AXIS_END[own];
  const e = endName ? v3(J[endName]) : s.clone().add(new THREE.Vector3(0, -0.1, 0));
  const L = s.distanceTo(e);
  const dir = e.clone().sub(s).normalize();
  const tmp = new THREE.Vector3();
  return (p) => {
    const along = tmp.copy(p).sub(s).dot(dir);
    const w: Weights = [];
    let ownW = 1;
    if (parent) {
      const k = 0.5 * (1 - smooth(0, blend, along));
      if (k > 0.001) {
        w.push([B[parent], k]);
        ownW -= k;
      }
    }
    if (child) {
      const k = 0.5 * (1 - smooth(0, blend, L - along));
      if (k > 0.001) {
        w.push([B[child], k]);
        ownW -= k;
      }
    }
    w.push([B[own], ownW]);
    return w;
  };
}

/** Torso weights by height: hips → spine → chest → neck, plus shoulders into the upper arms. */
const torsoWeights: WeightFn = (p) => {
  const bands: [BoneName, number][] = [];
  const y = p.y;
  const a = smooth(0.98, 1.1, y); // hips → spine
  const b = smooth(1.16, 1.3, y); // spine → chest
  const c = smooth(1.45, 1.5, y); // chest → neck
  bands.push(['hips', 1 - a]);
  bands.push(['spine', a * (1 - b)]);
  bands.push(['chest', b * (1 - c)]);
  bands.push(['neck', c]);
  // shoulder caps follow the arm a little
  const side = p.x > 0 ? 'upperArmL' : 'upperArmR';
  const sh = smooth(0.12, 0.19, Math.abs(p.x)) * smooth(1.3, 1.4, y) * 0.45;
  const out: Weights = bands.filter(([, w]) => w > 0.001).map(([n, w]) => [B[n], w * (1 - sh)]);
  if (sh > 0.001) out.push([B[side], sh]);
  // upper thighs drag the bottom of the pelvis
  const legSide = p.x > 0 ? 'thighL' : 'thighR';
  const lg = (1 - smooth(0.84, 0.93, y)) * smooth(0.02, 0.08, Math.abs(p.x)) * 0.5;
  if (lg > 0.001) {
    out.forEach((o) => (o[1] *= 1 - lg));
    out.push([B[legSide], lg]);
  }
  return out;
};

const solid = (hex: string | THREE.Color): ColorFn => {
  const c = new THREE.Color(hex);
  return () => c;
};

/** Build geometry + skeleton for one character. */
export function buildHumanoid(outfit: Outfit): { mesh: THREE.SkinnedMesh; bones: HumanBones } {
  const W = outfit.build ?? 1;
  const skin = new THREE.Color(outfit.skin ?? '#efc19b');
  const skinShade = skin.clone().multiplyScalar(0.86);
  const lip = skin.clone().lerp(new THREE.Color('#a4524a'), 0.45);
  const hair = new THREE.Color(outfit.hair ?? '#3b2a1e');
  const top = new THREE.Color(outfit.top);
  const topDark = top.clone().multiplyScalar(0.78);
  const legs = new THREE.Color(outfit.legs);
  const legsDark = legs.clone().multiplyScalar(0.8);
  const shoes = new THREE.Color(outfit.shoes);
  const sole = shoes.getHSL({ h: 0, s: 0, l: 0 }).l > 0.6 ? new THREE.Color('#d8d2c4') : new THREE.Color('#f0ece2');
  const accent = new THREE.Color(outfit.accent);
  const hoodie = (outfit.style ?? 'hoodie') === 'hoodie';
  const bulk = hoodie ? 0.014 : 0.008;
  const loose = hoodie ? 0.012 : 0;

  const parts: Part[] = [];
  const add = (geo: THREE.BufferGeometry, color: ColorFn, weights: WeightFn) => parts.push({ geo, color, weights });

  // ---- torso (pelvis to neck), elliptical rings with front/back shaping
  {
    const prof: [number, number, number, number][] = [
      // y, rx, rz, z offset
      [0.815, 0.07, 0.05, 0],
      [0.85, 0.15 + loose * 1.7, 0.1 + loose * 0.8, 0],
      [0.93, 0.168 + loose * 1.2, 0.11 + loose * 0.6, 0.0],
      [0.99, 0.163 + loose, 0.105 + loose * 0.6, 0.005],
      [1.07, 0.15 + bulk + loose * 0.6, 0.097 + bulk, 0.005],
      [1.17, 0.158 + bulk, 0.105 + bulk, 0.01],
      [1.28, 0.172 + bulk, 0.118 + bulk, 0.012],
      [1.37, 0.178 + bulk, 0.112 + bulk, 0.004],
      [1.435, 0.165 + bulk, 0.095 + bulk, -0.004],
      [1.475, 0.125, 0.078, -0.01],
      [1.505, 0.07, 0.064, -0.01],
    ];
    const hem = hoodie ? 0.885 : 0.96;
    // extra rings right at the colour borders keep the hem line crisp
    const lerpRing = (y: number): [number, number, number, number] => {
      const i = prof.findIndex((r) => r[0] > y);
      const p0 = prof[i - 1]!;
      const p1 = prof[i]!;
      const k = (y - p0[0]) / (p1[0] - p0[0]);
      return [y, p0[1] + (p1[1] - p0[1]) * k, p0[2] + (p1[2] - p0[2]) * k, p0[3] + (p1[3] - p0[3]) * k];
    };
    for (const y of [hem - 0.037, hem - 0.033, hem - 0.002, hem + 0.002]) prof.push(lerpRing(y));
    prof.sort((p, q) => p[0] - q[0]);
    const rings = prof.map(([y, rx, rz, oz]) => ({ y, rx: rx * W, rz, oz }));
    const radial = 18;
    const pos: number[] = [];
    const idx: number[] = [];
    rings.forEach((r) => {
      for (let s = 0; s <= radial; s++) {
        const a = (s / radial) * Math.PI * 2;
        // flatten the back a bit, round the chest
        const z = Math.cos(a) * r.rz * (Math.cos(a) < 0 ? 0.92 : 1);
        pos.push(Math.sin(a) * r.rx, r.y, z + r.oz);
      }
    });
    const row = radial + 1;
    for (let i = 0; i < rings.length - 1; i++)
      for (let s = 0; s < radial; s++) {
        const a = i * row + s;
        const b = a + row;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    // bottom cap
    const g = new THREE.BufferGeometry();
    const capC = pos.length / 3;
    pos.push(0, 0.81, 0);
    for (let s = 0; s < radial; s++) idx.push(capC, s + 1, s);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    add(
      clean(g),
      (p) => {
        if (p.y < hem - 0.035) return legs;
        if (p.y < hem) return hoodie ? topDark : new THREE.Color('#1a1a1a'); // hem band / belt
        return top;
      },
      torsoWeights,
    );
  }

  // ---- shoulders (deltoids) and arms
  for (const side of ['L', 'R'] as const) {
    const sx = side === 'L' ? 1 : -1;
    const up = `upperArm${side}` as BoneName;
    const fo = `forearm${side}` as BoneName;
    const ha = `hand${side}` as BoneName;
    const sh = v3(J[up]);
    const el = v3(J[fo]);
    const wr = v3(J[ha]);
    const r = bulk * 0.8;
    add(at(ellipsoid(0.05 + r, 0.054 + r, 0.053 + r, 14, 10), sh.x - sx * 0.005, sh.y - 0.005, sh.z), solid(top), limbWeights(up, 'chest', null, 0.09));
    add(
      limb(sh, el, [
        [0, 0.054 + r, 0.056 + r],
        [0.35, 0.05 + r, 0.052 + r, 0.003],
        [0.75, 0.043 + r, 0.045 + r],
        [1, 0.039 + r, 0.04 + r],
      ]),
      solid(top),
      limbWeights(up, 'chest', fo, 0.07),
    );
    add(
      limb(el, wr, [
        [0, 0.039 + r, 0.04 + r],
        [0.25, 0.043 + r, 0.041 + r, 0.004],
        [0.8, 0.033 + r, 0.03 + r],
        [1, 0.03 + r * 0.6, 0.027 + r * 0.6],
      ]),
      (p) => (p.y < wr.y + 0.035 ? topDark : top), // cuff
      limbWeights(fo, up, ha, 0.06),
    );
    // hand: palm faces the thigh (thin along x), thumb toward the front
    const hand = at(roundedBox(0.038, 0.1, 0.086, 0.017), wr.x + sx * 0.002, wr.y - 0.062, wr.z + 0.004);
    add(hand, solid(skin), limbWeights(ha, fo, null, 0.04));
    const fingers = at(roundedBox(0.033, 0.08, 0.08, 0.015), wr.x + sx * 0.008, wr.y - 0.135, wr.z + 0.006, 0, 0, sx * 0.12);
    add(fingers, solid(skin), only(ha));
    const thumb = limb(new THREE.Vector3(wr.x - sx * 0.004, wr.y - 0.03, wr.z + 0.035), new THREE.Vector3(wr.x - sx * 0.012, wr.y - 0.09, wr.z + 0.05), [
      [0, 0.017, 0.017],
      [1, 0.013, 0.013],
    ], 8);
    add(thumb, solid(skinShade), only(ha));
  }

  // ---- legs
  for (const side of ['L', 'R'] as const) {
    const th = `thigh${side}` as BoneName;
    const sn = `shin${side}` as BoneName;
    const ft = `foot${side}` as BoneName;
    const hip = v3(J[th]);
    const knee = v3(J[sn]);
    const ankle = v3(J[ft]);
    add(
      limb(hip, knee, [
        [0, 0.072 * W, 0.076],
        [0.1, 0.082 * W, 0.086, 0.003],
        [0.3, 0.08 * W, 0.083, 0.006],
        [0.75, 0.062, 0.064, 0.004],
        [1, 0.056, 0.058, 0.004],
      ]),
      solid(legs),
      limbWeights(th, 'hips', sn, 0.08),
    );
    add(
      limb(knee, ankle, [
        [0, 0.056, 0.058, 0.004],
        [0.28, 0.058, 0.064, -0.01], // calf at the back
        [0.7, 0.045, 0.047, -0.003],
        [1, 0.044, 0.046],
      ]),
      (p) => (p.y < ankle.y + 0.07 ? legsDark : legs),
      limbWeights(sn, th, ft, 0.07),
    );
    // shoe with sole and toe cap
    const shoe = at(roundedBox(0.1, 0.085, 0.265, 0.036), ankle.x, 0.044, ankle.z + 0.06);
    add(shoe, (p) => (p.y < 0.018 ? sole : p.z > ankle.z + 0.15 && p.y > 0.05 ? shoes.clone().multiplyScalar(0.9) : shoes), limbWeights(ft, sn, null, 0.05));
  }

  // ---- neck & head
  // Head parts are modelled around headC and then scaled up a little (HS)
  // and moved to headPos, so the head reads well from the game camera.
  const headC = new THREE.Vector3(0, 1.69, 0.008);
  const HS = 1.1;
  const headPos = new THREE.Vector3(0, 1.668, 0.008);
  const headStart = parts.length + 1; // index after the neck
  add(
    limb(new THREE.Vector3(0, 1.62, 0.0), new THREE.Vector3(0, 1.45, -0.012), [
      [0, 0.052, 0.054],
      [0.6, 0.056, 0.058],
      [1, 0.066, 0.064],
    ]),
    solid(skinShade),
    (p) => {
      const k = smooth(1.5, 1.6, p.y);
      return [
        [B.neck, 1 - k * 0.6],
        [B.head, k * 0.6],
      ];
    },
  );
  {
    // skull: an ellipsoid with a narrower jaw and a chin
    const g = new THREE.SphereGeometry(1, 26, 20);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i);
      let y = p.getY(i);
      let z = p.getZ(i);
      const lower = smooth(0.05, -0.75, y); // 0 above the cheekbones, 1 at the chin
      x *= 1 - 0.3 * lower;
      z *= 1 - 0.12 * lower;
      if (z > 0) z += 0.12 * lower * (1 - Math.abs(x)) * 0.6; // chin forward
      if (z < 0 && y > -0.2) z *= 1.06; // back of skull
      if (y < -0.85) y = -0.85 - (y + 0.85) * 0.4; // flatter chin bottom
      p.setXYZ(i, x * 0.084, y * 0.118, z * 0.1);
    }
    add(at(clean(g), headC.x, headC.y, headC.z), (q) => (q.y < headPos.y - 0.055 && q.z > 0 ? skin.clone().multiplyScalar(0.97) : skin), only('head'));
  }
  const face = (geo: THREE.BufferGeometry, color: THREE.Color | string) => add(geo, solid(color), only('head'));
  // ears
  for (const sx of [1, -1]) face(at(ellipsoid(0.012, 0.03, 0.02, 8, 6), headC.x + sx * 0.084, headC.y - 0.005, headC.z - 0.008, 0, 0, sx * 0.15), skinShade);
  // nose
  face(at(roundedBox(0.024, 0.042, 0.026, 0.01, 2), 0, headC.y - 0.012, headC.z + 0.098, -0.25), skin.clone().multiplyScalar(0.95));
  // eyes: whites + iris + brows
  for (const sx of [1, -1]) {
    face(at(ellipsoid(0.015, 0.011, 0.01, 10, 8), sx * 0.033, headC.y + 0.016, headC.z + 0.082), '#f6f3ee');
    face(at(ellipsoid(0.008, 0.009, 0.006, 8, 6), sx * 0.033, headC.y + 0.016, headC.z + 0.091), '#2d2118');
    face(at(roundedBox(0.04, 0.009, 0.012, 0.004, 1), sx * 0.035, headC.y + 0.04, headC.z + 0.088, 0, 0, sx * -0.1), hair.clone().multiplyScalar(0.8));
  }
  // mouth
  face(at(roundedBox(0.038, 0.009, 0.01, 0.004, 1), 0, headC.y - 0.058, headC.z + 0.088), lip);

  // hair (sides & back always visible), then headwear
  face(at(ellipsoid(0.089, 0.124, 0.106, 22, 12, 0, Math.PI * 0.42), headC.x, headC.y + 0.006, headC.z - 0.006, -0.38), hair);
  {
    const back = new THREE.SphereGeometry(1, 20, 10, Math.PI * 1.12, Math.PI * 0.76, Math.PI * 0.3, Math.PI * 0.33);
    back.scale(0.089, 0.123, 0.106);
    face(at(clean(back), headC.x, headC.y + 0.004, headC.z - 0.004), hair);
  }
  const hatC = new THREE.Color(outfit.hatColor);
  if (outfit.hat === 'beanie') {
    face(at(ellipsoid(0.094, 0.13, 0.111, 22, 12, 0, Math.PI * 0.45), headC.x, headC.y + 0.012, headC.z - 0.006, -0.3), hatC);
    face(
      at(
        limb(new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0, -0.02, 0), [
          [0, 0.097, 0.114],
          [1, 0.097, 0.114],
        ], 22),
        headC.x,
        headC.y + 0.034,
        headC.z - 0.012,
        -0.3,
      ),
      hatC.clone().multiplyScalar(0.85),
    );
    face(at(ellipsoid(0.024, 0.022, 0.024, 8, 6), headC.x, headC.y + 0.142, headC.z - 0.01), accent);
  } else if (outfit.hat === 'cap') {
    face(at(ellipsoid(0.093, 0.1, 0.11, 22, 10, 0, Math.PI * 0.5), headC.x, headC.y + 0.04, headC.z - 0.006, -0.15), hatC);
    face(at(ellipsoid(0.08, 0.008, 0.07, 18, 6), headC.x, headC.y + 0.048, headC.z + 0.125, 0.18), new THREE.Color('#14171f'));
    face(at(roundedBox(0.045, 0.024, 0.006, 0.003, 1), headC.x, headC.y + 0.088, headC.z + 0.102, -0.35), accent);
  }

  for (let i = headStart; i < parts.length; i++) {
    const part = parts[i]!;
    part.geo.translate(-headC.x, -headC.y, -headC.z).scale(HS, HS, HS).translate(headPos.x, headPos.y, headPos.z);
  }

  // ---- clothing details
  if (hoodie) {
    // hood bunched up behind the neck
    const hood = new THREE.TorusGeometry(0.075, 0.03, 8, 18, Math.PI * 1.35);
    hood.rotateX(Math.PI / 2);
    hood.rotateY(-Math.PI * 0.825);
    add(at(clean(hood), 0, 1.46, -0.03), solid(top.clone().multiplyScalar(0.92)), only('chest'));
    // drawstrings + kangaroo pocket
    for (const sx of [1, -1])
      add(at(roundedBox(0.006, 0.09, 0.006, 0.0029, 1), sx * 0.03, 1.375, 0.134), solid(accent), only('chest'));
    add(at(roundedBox(0.19 * W, 0.085, 0.016, 0.008, 2), 0, 1.03, 0.113), solid(topDark), torsoWeights);
  } else {
    // jacket: zipper line, badge, epaulettes
    add(at(roundedBox(0.008, 0.36, 0.008, 0.003, 1), 0, 1.2, 0.132), solid(topDark), torsoWeights);
    add(at(roundedBox(0.04, 0.045, 0.01, 0.004, 1), 0.08, 1.32, 0.14), solid(accent), only('chest'));
    // white shirt collar V
    for (const sx of [1, -1]) add(at(roundedBox(0.045, 0.085, 0.01, 0.004, 1), sx * 0.024, 1.43, 0.098, -0.35, 0, sx * 0.45), solid('#f2f2ee'), only('chest'));
    for (const sx of [1, -1]) add(at(roundedBox(0.07, 0.012, 0.05, 0.005, 1), sx * 0.15, 1.44, -0.005, 0, 0, sx * -0.35), solid(accent), only('chest'));
  }
  if (outfit.backpack) {
    add(at(roundedBox(0.28 * W, 0.36, 0.13, 0.045), 0, 1.22, -0.18), (p) => (p.y > 1.33 ? new THREE.Color('#232a3a') : new THREE.Color('#2b3245')), only('chest'));
    add(at(roundedBox(0.2, 0.12, 0.04, 0.02), 0, 1.12, -0.255), solid(accent.clone().multiplyScalar(0.8)), only('chest'));
    for (const sx of [1, -1])
      add(
        limb(new THREE.Vector3(sx * 0.1, 1.44, 0.0), new THREE.Vector3(sx * 0.11, 1.17, 0.142), [
          [0, 0.02, 0.008],
          [1, 0.02, 0.008],
        ], 6),
        solid('#1c2130'),
        torsoWeights,
      );
  }

  // ---- merge into one skinned geometry
  const geos: THREE.BufferGeometry[] = [];
  const v = new THREE.Vector3();
  for (const part of parts) {
    const g = part.geo.index ? part.geo.toNonIndexed() : part.geo;
    const p = g.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(p.count * 3);
    const si = new Uint16Array(p.count * 4);
    const sw = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const c = part.color(v);
      col.set([c.r, c.g, c.b], i * 3);
      const w = part.weights(v)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);
      const total = w.reduce((s, [, x]) => s + x, 0) || 1;
      w.forEach(([bi, x], k) => {
        si[i * 4 + k] = bi;
        sw[i * 4 + k] = x / total;
      });
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'skinIndex', 'skinWeight'].includes(name)) g.deleteAttribute(name);
    geos.push(g);
  }
  const geometry = mergeGeometries(geos, false);
  if (!geometry) throw new Error('humanoid merge failed');
  geos.forEach((g) => g.dispose());

  // ---- skeleton
  const bones = {} as HumanBones;
  for (const name of BONE_NAMES) {
    const b = new THREE.Bone();
    b.name = name;
    bones[name] = b;
  }
  for (const name of BONE_NAMES) {
    const parent = PARENT[name];
    const p = v3(J[name]);
    if (parent) {
      p.sub(v3(J[parent]));
      bones[parent].add(bones[name]);
    }
    bones[name].position.copy(p);
  }
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 });
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.add(bones.root);
  mesh.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(BONE_NAMES.map((n) => bones[n]));
  mesh.bind(skeleton);
  mesh.castShadow = true;
  mesh.frustumCulled = false;

  // ---- hand props (rigid, parented to the right hand bone)
  if (outfit.prop === 'phone') {
    const phone = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.012), new THREE.MeshStandardMaterial({ color: "#111", emissive: '#4a7bd0', emissiveIntensity: 0.5, roughness: 0.3 }));
    phone.position.set(0.03, -0.1, 0.02);
    phone.rotation.set(0, Math.PI / 2, 0);
    bones.handR.add(phone);
  } else if (outfit.prop === 'reader') {
    const reader = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.035), new THREE.MeshStandardMaterial({ color: '#2a2f38', roughness: 0.5 }));
    reader.position.set(-0.01, -0.12, 0.03);
    bones.handR.add(reader);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.06), new THREE.MeshBasicMaterial({ color: '#6fd08a' }));
    screen.position.set(-0.01, -0.09, 0.049);
    bones.handR.add(screen);
  }

  return { mesh, bones };
}

export function disposeHumanoid(mesh: THREE.SkinnedMesh) {
  mesh.geometry.dispose();
  (mesh.material as THREE.Material).dispose();
  mesh.skeleton.dispose();
  mesh.traverse((o) => {
    if (o instanceof THREE.Mesh && o !== mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
}
