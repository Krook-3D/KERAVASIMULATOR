import type { WorldXZ } from './projection';
import { createRng } from './random';

/**
 * Buyable building plots on empty land. Close to the station (the world
 * origin) plots are small and expensive; out towards the edge of town they are
 * big and cheap. Placement is deterministic for a given world.
 */
export interface Plot {
  id: string;
  /** Centre of the (square) plot. */
  at: WorldXZ;
  /** Side length in metres. */
  size: number;
  /** Unit axis pointing from the centre to the street-side edge. */
  front: WorldXZ;
  /** Where the sign stands and you use the plot. */
  sign: WorldXZ;
  price: number;
  zone: PlotZone;
}

export type PlotZone = 'Keskusta' | 'Kantakaupunki' | 'Laitakaupunki';

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Side length (m) of a plot this far from the centre. */
export const plotSize = (d: number) => Math.round(lerp(14, 40, smooth(200, 1500, d)));
/**
 * Plot price: the whole plot costs most in the centre (about 2 200 € for a
 * 14 m plot, ~11 €/m²) and least at the edge (about 500 € for a 40 m plot,
 * ~0.3 €/m²), so the price per square metre drops much faster than the size grows.
 */
export const plotPrice = (d: number) => Math.round(lerp(2200, 500, smooth(150, 1500, d)) / 10) * 10;
export const pricePerM2 = (d: number) => plotPrice(d) / plotSize(d) ** 2;
export const plotZone = (d: number): PlotZone => (d < 400 ? 'Keskusta' : d < 900 ? 'Kantakaupunki' : 'Laitakaupunki');

/** How many plots one player may own at once. */
export const MAX_PLOTS = 3;

const SPACING = 70;
const MAX_DIST = 1700;
/** Plots per distance band, so there's a choice in every part of town. */
const BANDS: { upTo: number; count: number }[] = [
  { upTo: 400, count: 10 },
  { upTo: 900, count: 14 },
  { upTo: MAX_DIST, count: 18 },
];

export interface PlotChecks {
  /** The point is free land (no building, water, track, station or square). */
  free: (p: WorldXZ) => boolean;
  /** The point is on or right next to a road. */
  road: (p: WorldXZ, margin: number) => boolean;
  /** Ground height, to skip steep slopes. */
  height: (p: WorldXZ) => number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const AXES: WorldXZ[] = [[0, 1], [1, 0], [0, -1], [-1, 0]];

/** Finds the plots: a jittered grid of candidates, each checked across its whole area. */
export function placePlots(c: PlotChecks, seed = 7331): Plot[] {
  const rng = createRng(seed);
  const cands: Plot[] = [];
  const { minX, maxX, minZ, maxZ } = c.bounds;
  for (let gx = Math.ceil(minX / SPACING); gx * SPACING < maxX; gx++)
    for (let gz = Math.ceil(minZ / SPACING); gz * SPACING < maxZ; gz++) {
      const at: WorldXZ = [gx * SPACING + (rng() - 0.5) * 30, gz * SPACING + (rng() - 0.5) * 30];
      const d = Math.hypot(at[0], at[1]);
      const roll = rng();
      if (d < 90 || d > MAX_DIST) continue;
      const size = plotSize(d);
      const p = checkPlot(c, at, size);
      if (!p) continue;
      cands.push({ id: `tontti_${gx}_${gz}`, at, size, front: p.front, sign: p.sign, price: plotPrice(d), zone: plotZone(d) });
      (cands[cands.length - 1] as Plot & { roll?: number }).roll = roll;
    }
  // spread out: shuffle (seeded), then take per band
  const out: Plot[] = [];
  let lo = 0;
  for (const band of BANDS) {
    const inBand = cands.filter((p) => {
      const d = Math.hypot(p.at[0], p.at[1]);
      return d >= lo && d < band.upTo;
    });
    inBand.sort((a, b) => ((a as Plot & { roll: number }).roll - (b as Plot & { roll: number }).roll));
    let n = 0;
    for (const p of inBand) {
      if (n >= band.count) break;
      if (out.some((q) => Math.hypot(q.at[0] - p.at[0], q.at[1] - p.at[1]) < (q.size + p.size) / 2 + 30)) continue;
      out.push(p);
      n++;
    }
    lo = band.upTo;
  }
  for (const p of out) delete (p as Plot & { roll?: number }).roll;
  return out;
}

/** The plot is usable when its whole area is free, flat-ish and off the road, with a road close by. */
function checkPlot(c: PlotChecks, at: WorldXZ, size: number): { front: WorldXZ; sign: WorldXZ } | null {
  const h = size / 2;
  const heights: number[] = [];
  for (let i = -2; i <= 2; i++)
    for (let j = -2; j <= 2; j++) {
      const p: WorldXZ = [at[0] + (i / 2) * h, at[1] + (j / 2) * h];
      if (!c.free(p) || c.road(p, 1.5)) return null;
      heights.push(c.height(p));
    }
  if (Math.max(...heights) - Math.min(...heights) > 2.5) return null;
  // the street side: the edge with a road closest to it
  for (const margin of [6, 14, 26]) {
    for (const ax of AXES) {
      const edge: WorldXZ = [at[0] + ax[0] * (h + margin * 0.5), at[1] + ax[1] * (h + margin * 0.5)];
      if (c.road(edge, margin * 0.5)) return { front: ax, sign: [at[0] + ax[0] * (h - 0.8), at[1] + ax[1] * (h - 0.8)] };
    }
  }
  return null;
}

// ------------------------------------------------------------ building a house

export interface BuildStage {
  name: string;
  /** Materials used (item id → amount). */
  needs: Record<string, number>;
  /** Rakentaminen level needed. */
  level: number;
  energy: number;
  xp: number;
  /** Work time in seconds. */
  time: number;
}

/** A house goes up in four stages; each one shows on the plot. */
export const BUILD_STAGES: BuildStage[] = [
  { name: 'Perustus', needs: { sementti: 4 }, level: 1, energy: 15, xp: 90, time: 6 },
  { name: 'Runko ja seinät', needs: { lauta: 10 }, level: 3, energy: 18, xp: 160, time: 7 },
  { name: 'Katto', needs: { kattopelti: 6 }, level: 5, energy: 20, xp: 280, time: 7 },
  { name: 'Ikkunat ja ovi', needs: { ikkuna: 4 }, level: 8, energy: 15, xp: 420, time: 6 },
];
/** Practice carpentry at your own plot: a few boards for a bit of XP. */
export const PRACTICE = { name: 'Puutyöt', needs: { lauta: 2 }, energy: 8, xp: 45, time: 4 };

export interface PlotState {
  /** Stages built so far (0–4). */
  stage: number;
}

export const houseDone = (s: PlotState | undefined) => (s?.stage ?? 0) >= BUILD_STAGES.length;

/** What the plot sells back for: 80 % of the land plus the materials in the house, and a bonus for a finished house. */
export function plotResale(plot: Plot, s: PlotState, matPrice: (id: string) => number): number {
  let v = plot.price * 0.8;
  for (let i = 0; i < s.stage; i++) for (const [id, n] of Object.entries(BUILD_STAGES[i]!.needs)) v += matPrice(id) * n;
  if (houseDone(s)) v += 400 + plot.size * 20;
  return Math.round(v / 10) * 10;
}

/** Footprint (half width, half depth) of the house on a plot of this size. */
export const houseHalf = (size: number): [number, number] => [Math.min(7, size * 0.3), Math.min(5.5, size * 0.24)];

/** Missing materials for a stage, as "lauta ×3" style pairs; empty when all is there. */
export function missingFor(needs: Record<string, number>, count: (id: string) => number): [string, number][] {
  return Object.entries(needs).flatMap(([id, n]) => (count(id) >= n ? [] : [[id, n - count(id)] as [string, number]]));
}
