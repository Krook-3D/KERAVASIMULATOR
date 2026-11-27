import * as THREE from 'three';
import { ITEMS, RARITY_COLORS, SPRAY_COLORS } from '../../../data/items';

/**
 * Small procedural 3D models for items. Each model is built in metres with
 * its grip at the origin and the business end pointing down (-y), so it can
 * hang straight from a hand bone or lie on the ground rotated flat.
 */
type Part = [geo: THREE.BufferGeometry, color: string, pos?: [number, number, number], rot?: [number, number, number], opts?: { metal?: number; rough?: number; emissive?: string }];

const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);
const cyl = (r: number, h: number, r2 = r, seg = 12) => new THREE.CylinderGeometry(r, r2, h, seg);
const STEEL = { metal: 0.85, rough: 0.3 };
const GOLD = { metal: 1, rough: 0.22 };
/** Plated plastic: a bit too yellow and not quite shiny. */
const FAKE_GOLD = { metal: 0.55, rough: 0.5 };
/** Wrist watch: case, dial and strap. */
const watch = (metal: string, dial: string, m: { metal: number; rough: number }): Part[] => [
  [cyl(0.024, 0.012, 0.024, 20), metal, [0, -0.05, 0], [Math.PI / 2, 0, 0], m],
  [cyl(0.019, 0.002, 0.019, 20), dial, [0, -0.05, 0.007], [Math.PI / 2, 0, 0], { metal: 0.3, rough: 0.1 }],
  [box(0.022, 0.12, 0.006), metal, [0, -0.05, -0.004], undefined, m],
];

const MODELS: Record<string, () => Part[]> = {
  ruuvimeisseli: () => [[cyl(0.016, 0.1), '#d8342c'], [cyl(0.004, 0.12), '#c0c4ca', [0, -0.11, 0], undefined, STEEL]],
  jakoavain: () => [[box(0.025, 0.2, 0.01), '#9aa0a8', [0, -0.08, 0], undefined, STEEL], [box(0.06, 0.04, 0.012), '#9aa0a8', [0, -0.2, 0], undefined, STEEL]],
  taskulamppu: () => [[cyl(0.018, 0.16), '#20242a', [0, -0.06, 0]], [cyl(0.026, 0.04, 0.02), '#30343a', [0, -0.16, 0]], [cyl(0.022, 0.005), '#fff6c8', [0, -0.182, 0], undefined, { emissive: '#fff1a8' }]],
  koysi: () => [[new THREE.TorusGeometry(0.09, 0.022, 8, 20), '#c9a46a', [0, -0.09, 0], [0, Math.PI / 2, 0], { rough: 1 }]],
  ketju: () => Array.from({ length: 7 }, (_, i): Part => [new THREE.TorusGeometry(0.02, 0.006, 6, 10), '#8a8f96', [0, -0.03 - i * 0.032, 0], [0, i % 2 ? Math.PI / 2 : 0, 0], STEEL]),
  spraymaali: () => [[cyl(0.032, 0.17), '#1b1d22', [0, -0.07, 0], undefined, { metal: 0.6, rough: 0.35 }], [cyl(0.02, 0.03), '#e23b6a', [0, 0.025, 0]], [box(0.05, 0.06, 0.066), '#e23b6a', [0, -0.07, 0]]],
  puukko: () => [[cyl(0.016, 0.1, 0.018), '#7a4a26', [0, -0.03, 0], undefined, { rough: 0.7 }], [box(0.006, 0.11, 0.024), '#d6dae0', [0, -0.13, 0.002], undefined, STEEL]],
  shankki: () => [[box(0.02, 0.08, 0.02), '#2a2d33', [0, -0.03, 0]], [new THREE.ConeGeometry(0.012, 0.13, 4), '#b8bcc2', [0, -0.135, 0], [Math.PI, 0, 0], STEEL]],
  sorkkarauta: () => [[cyl(0.012, 0.62), '#2d3a8c', [0, -0.25, 0], undefined, { metal: 0.6, rough: 0.4 }], [box(0.025, 0.06, 0.012), '#2d3a8c', [0, -0.56, 0.025], [0.6, 0, 0], { metal: 0.6 }]],
  pesapallomaila: () => [[cyl(0.018, 0.25, 0.02), '#2a1d14', [0, -0.06, 0]], [cyl(0.034, 0.5, 0.022), '#c49a5e', [0, -0.42, 0], undefined, { rough: 0.6 }]],
  voimapihdit: () => [
    [cyl(0.013, 0.5), '#c8282a', [-0.03, -0.18, 0]], [cyl(0.013, 0.5), '#c8282a', [0.03, -0.18, 0]],
    [box(0.09, 0.12, 0.03), '#5a5f66', [0, -0.49, 0], undefined, STEEL],
  ],
  rallakka: () => [[cyl(0.035, 0.24), '#1a8a4a', [0, -0.06, 0]], [cyl(0.045, 0.06), '#2a2d33', [0, -0.2, 0]], [cyl(0.07, 0.006, 0.07, 20), '#c0c4ca', [0, -0.2, 0.05], [Math.PI / 2, 0, 0], STEEL]],
  kiikarit: () => [[cyl(0.025, 0.11), '#22262c', [-0.03, -0.05, 0]], [cyl(0.025, 0.11), '#22262c', [0.03, -0.05, 0]], [box(0.04, 0.03, 0.03), '#22262c', [0, -0.03, 0]]],
  avainnippu: () => [[new THREE.TorusGeometry(0.025, 0.004, 6, 14), '#c0c4ca', [0, -0.02, 0], undefined, STEEL], ...[-0.3, 0, 0.3].map((r): Part => [box(0.012, 0.06, 0.003), '#d8b84a', [Math.sin(r) * 0.04, -0.07, 0], [0, 0, r], GOLD])],
  commandopipo: () => [[new THREE.SphereGeometry(0.1, 14, 10, 0, Math.PI * 2, 0, Math.PI / 1.6), '#16171a', [0, -0.08, 0], [Math.PI, 0, 0], { rough: 1 }]],
  lippis: () => [[new THREE.SphereGeometry(0.09, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#c8312b', [0, -0.06, 0], [Math.PI, 0, 0]], [box(0.12, 0.01, 0.09), '#c8312b', [0, -0.06, 0.08]]],
  aurinkolasit: () => [[box(0.05, 0.03, 0.008), '#1d2c3a', [-0.032, -0.04, 0], undefined, { metal: 0.9, rough: 0.05 }], [box(0.05, 0.03, 0.008), '#1d2c3a', [0.032, -0.04, 0], undefined, { metal: 0.9, rough: 0.05 }], [box(0.13, 0.006, 0.006), '#111', [0, -0.027, 0]]],
  tyomiehenliivi: () => [[box(0.22, 0.26, 0.03), '#e8f23a', [0, -0.13, 0], undefined, { emissive: '#3a3c00' }], [box(0.22, 0.03, 0.032), '#d6dae0', [0, -0.16, 0], undefined, { emissive: '#666' }]],
  kultaketju: () => [[new THREE.TorusGeometry(0.08, 0.012, 8, 24), '#ffc93c', [0, -0.08, 0], undefined, GOLD]],
  hopearasia: () => [[box(0.08, 0.1, 0.018), '#d0d4da', [0, -0.05, 0], undefined, { metal: 1, rough: 0.2 }]],
  nokka3310: () => [[box(0.05, 0.11, 0.022), '#2c4a7a', [0, -0.055, 0]], [box(0.034, 0.03, 0.002), '#9fc79a', [0, -0.035, 0.012], undefined, { emissive: '#2a3a20' }]],
  timanttisormus: () => [[new THREE.TorusGeometry(0.02, 0.004, 8, 18), '#ffc93c', [0, -0.03, 0], undefined, GOLD], [new THREE.OctahedronGeometry(0.012), '#e8f6ff', [0, -0.005, 0], undefined, { metal: 0.2, rough: 0, emissive: '#5a7a90' }]],
  kultakello: () => [[cyl(0.024, 0.012, 0.024, 20), '#ffc93c', [0, -0.05, 0], [Math.PI / 2, 0, 0], GOLD], [cyl(0.019, 0.002, 0.019, 20), '#10331f', [0, -0.05, 0.007], [Math.PI / 2, 0, 0], { metal: 0.3, rough: 0.1 }], [box(0.022, 0.12, 0.006), '#ffc93c', [0, -0.05, -0.004], undefined, GOLD]],
  kultaranneke: () => [[new THREE.TorusGeometry(0.035, 0.008, 8, 22), '#ffc93c', [0, -0.035, 0], [Math.PI / 2, 0, 0], GOLD]],
  terasrolux: () => watch('#c9ced6', '#14233a', STEEL),
  feikkiketju: () => [[new THREE.TorusGeometry(0.08, 0.01, 6, 20), '#e3c25a', [0, -0.08, 0], undefined, FAKE_GOLD]],
  feikkiranneke: () => [[new THREE.TorusGeometry(0.035, 0.007, 6, 18), '#e3c25a', [0, -0.035, 0], [Math.PI / 2, 0, 0], FAKE_GOLD]],
  feikkirolux: () => watch('#e3c25a', '#1f2a1f', FAKE_GOLD),
  kultaharkko: () => [[new THREE.CylinderGeometry(0.05, 0.065, 0.035, 4), '#ffc93c', [0, -0.03, 0], [0, Math.PI / 4, 0], GOLD]],
  tolkki: () => [[cyl(0.03, 0.11), '#3a8fd6', [0, -0.055, 0], undefined, { metal: 0.8, rough: 0.3 }]],
  pullo: () => [[cyl(0.032, 0.16), '#3f7a3a', [0, -0.1, 0], undefined, { rough: 0.1 }], [cyl(0.012, 0.05, 0.03), '#3f7a3a', [0, 0.0, 0], undefined, { rough: 0.1 }]],
  potkulautaakku: () => [[box(0.08, 0.26, 0.05), '#24282e', [0, -0.13, 0]], [box(0.05, 0.02, 0.052), '#3ad6a0', [0, -0.05, 0], undefined, { emissive: '#106a50' }]],
};

function partsFor(itemId: string): Part[] {
  const spray = SPRAY_COLORS[itemId];
  if (spray) return [[cyl(0.032, 0.17), '#c8ccd2', [0, -0.07, 0], undefined, { metal: 0.7, rough: 0.3 }], [cyl(0.033, 0.09), spray, [0, -0.06, 0]], [cyl(0.02, 0.03), spray, [0, 0.025, 0]]];
  const m = MODELS[itemId];
  if (m) return m();
  const def = ITEMS[itemId];
  const c = def ? RARITY_COLORS[def.rarity] : '#c8ccd2';
  // fallback: a small parcel / packet in the rarity colour
  if (def?.category === 'food') return [[box(0.1, 0.14, 0.06), '#e9e2d0', [0, -0.07, 0]], [box(0.102, 0.05, 0.062), c, [0, -0.06, 0]]];
  return [[box(0.08, 0.08, 0.04), c, [0, -0.04, 0]]];
}

const cache = new Map<string, THREE.Material>();
function material(color: string, o: Part[4] = {}): THREE.Material {
  const key = `${color}|${o.metal ?? 0}|${o.rough ?? 0.6}|${o.emissive ?? ''}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, metalness: o.metal ?? 0, roughness: o.rough ?? 0.6, emissive: o.emissive ?? '#000', emissiveIntensity: o.emissive ? 0.9 : 0 });
    cache.set(key, m);
  }
  return m;
}

/** Build a fresh model group. Geometries are owned by the group (dispose with disposeItemModel); materials are shared. */
export function buildItemModel(itemId: string): THREE.Group {
  const g = new THREE.Group();
  for (const [geo, color, pos, rot, opts] of partsFor(itemId)) {
    const mesh = new THREE.Mesh(geo, material(color, opts));
    if (pos) mesh.position.set(...pos);
    if (rot) mesh.rotation.set(...rot);
    mesh.castShadow = true;
    g.add(mesh);
  }
  g.name = `item:${itemId}`;
  return g;
}

export function disposeItemModel(g: THREE.Group) {
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}
