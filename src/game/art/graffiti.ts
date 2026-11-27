import type { WorldXZ } from '../world/projection';
import type { Building } from '../world/worldData';

/**
 * Graffiti (Art skill). Hold a spray can, stand by any wall and paint freehand
 * with the mouse. Run-down spots (tunnels, rails, industrial yards) reward
 * karma, nice areas cost karma. People nearby may not care, get angry or call
 * the police; get caught still painting and you go to the holding cell.
 */
export interface WallHit {
  /** Closest point on the wall. */
  q: WorldXZ;
  /** Unit normal pointing away from the building (towards the painter). */
  n: WorldXZ;
  /** Unit vector along the wall. */
  t: WorldXZ;
  /** Usable wall length around q (metres) and the building height. */
  len: number;
  height: number;
  dist: number;
}

/** Nearest building wall within `max` metres. */
export function nearestWall(buildings: Building[], p: WorldXZ, max = 3.2): WallHit | null {
  let best: WallHit | null = null;
  for (const b of buildings) {
    const fp = b.footprint;
    const f0 = fp[0];
    if (!f0 || Math.abs(f0[0] - p[0]) > 200 || Math.abs(f0[1] - p[1]) > 200) continue;
    // polygon centroid (for the outward side)
    let cx = 0, cz = 0;
    for (const [x, z] of fp) { cx += x; cz += z; }
    cx /= fp.length; cz /= fp.length;
    for (let i = 0; i < fp.length; i++) {
      const a = fp[i]!, c = fp[(i + 1) % fp.length]!;
      const dx = c[0] - a[0], dz = c[1] - a[1];
      const l2 = dx * dx + dz * dz;
      if (l2 < 4) continue; // tiny edges are not walls
      const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2));
      const q: WorldXZ = [a[0] + dx * k, a[1] + dz * k];
      const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (d > max || (best && d >= best.dist)) continue;
      const l = Math.sqrt(l2);
      const t: WorldXZ = [dx / l, dz / l];
      let n: WorldXZ = [-t[1], t[0]];
      if ((q[0] - cx) * n[0] + (q[1] - cz) * n[1] < 0) n = [-n[0], -n[1]];
      // keep the piece on the wall: slide q so ±len/2 fits
      const len = Math.min(4, l - 0.4);
      if (len < 1.5) continue;
      const along = Math.max(len / 2 + 0.2, Math.min(l - len / 2 - 0.2, k * l));
      best = { q: [a[0] + t[0] * along, a[1] + t[1] * along], n, t, len, height: b.height, dist: d };
    }
  }
  return best;
}

export type SpotQuality = 'ugly' | 'neutral' | 'nice';
export const QUALITY_KARMA: Record<SpotQuality, number> = { ugly: 3, neutral: 0, nice: -4 };
export const QUALITY_NAMES: Record<SpotQuality, string> = {
  ugly: 'Rähjäinen mesta: graffiti piristää (+karma)',
  neutral: 'Tavallinen seinä',
  nice: 'Siisti alue: töhriminen suututtaa (−karma)',
};

/** How run-down a spot is, from lists of known ugly and nice places. */
export function spotQuality(p: WorldXZ, ugly: WorldXZ[], nice: WorldXZ[]): SpotQuality {
  const near = (list: WorldXZ[], r: number) => list.some((u) => Math.hypot(u[0] - p[0], u[1] - p[1]) < r);
  if (near(ugly, 90)) return 'ugly';
  if (near(nice, 130)) return 'nice';
  return 'neutral';
}

export type WitnessReaction = 'ignore' | 'angry' | 'police' | 'respect';
/** Each person reacts the same way every time (seeded by their id). */
export function witnessReaction(id: string, crew: boolean): WitnessReaction {
  if (crew) return 'respect';
  const h = [...id].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381) % 100;
  return h < 45 ? 'ignore' : h < 78 ? 'angry' : 'police';
}

export const WITNESS_LINES: Record<WitnessReaction, string[]> = {
  ignore: ['Ihan siisti, jatka vaan.', 'Ei mun seinä.', '*kävelee ohi*'],
  angry: ['Hei! Lopeta toi töhriminen!', 'Mitä sä teet?! Tää on jonkun koti!', 'Hävytöntä!'],
  police: ['Mä soitan poliisit!', 'Haloo, hätäkeskus? Täällä töhritään!'],
  respect: ['Wallah, sairaan hieno!', 'Bro, sä oot artisti!', 'Lisää värii!'],
};

/** Seconds from the call until the patrol arrives. */
export const POLICE_RESPONSE = 14;

/** Art XP for a piece: coverage 0–1 and number of colours used. */
export function artXp(coverage: number, colours: number, level: number): number {
  return Math.round(8 + Math.min(1, coverage * 1.6) * 90 + Math.max(0, colours - 1) * 10 + level * 1.5);
}

export interface SavedPiece {
  id: string;
  /** Wall point, normal, tangent and size in metres. */
  q: WorldXZ;
  n: WorldXZ;
  t: WorldXZ;
  w: number;
  h: number;
  /** Ground height at the wall. */
  y: number;
  img: string;
}

const KEY = 'kerava-sim:graffiti';
export const MAX_PIECES = 16;

export function loadPieces(): SavedPiece[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedPiece[]) : [];
  } catch {
    return [];
  }
}

export function savePieces(list: SavedPiece[]): SavedPiece[] {
  let out = list.slice(-MAX_PIECES);
  for (;;) {
    try {
      localStorage.setItem(KEY, JSON.stringify(out));
      return out;
    } catch {
      if (!out.length) return out;
      out = out.slice(1); // storage full: drop the oldest
    }
  }
}

export function clearPieces() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
