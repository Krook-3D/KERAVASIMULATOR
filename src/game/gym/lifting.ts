/**
 * Gym lifting rules (pure functions, easy to test).
 *
 * You load the bar yourself, a pair of plates at a time. How heavy a plate
 * you can carry from the rack and how heavy a bar you can lift both grow
 * with Voima (strength). At level 1 only very light weights go up.
 */
export type LiftId = 'bench' | 'squat' | 'deadlift';

export interface LiftDef {
  id: LiftId;
  name: string;
  /** Max weight (kg, bar included) you can lift at level L: base + perLevel · (L − 1). */
  base: number;
  perLevel: number;
  /** XP per kilogram lifted in a successful set. */
  xpPerKg: number;
}

export const BAR_KG = 20;
export const PLATES = [1.25, 2.5, 5, 10, 15, 20, 25] as const;
export type Plate = (typeof PLATES)[number];
/** Most plate pairs that fit on one bar. */
export const MAX_PAIRS = 6;
export const SET_ENERGY = 6;

export const LIFTS: Record<LiftId, LiftDef> = {
  bench: { id: 'bench', name: 'Penkkipunnerrus', base: 30, perLevel: 3.5, xpPerKg: 0.55 },
  squat: { id: 'squat', name: 'Kyykky', base: 35, perLevel: 4.5, xpPerKg: 0.5 },
  deadlift: { id: 'deadlift', name: 'Maastaveto', base: 40, perLevel: 5.5, xpPerKg: 0.45 },
};

/** Heaviest single plate you can carry from the rack. */
export function maxCarryPlate(level: number): number {
  if (level >= 18) return 25;
  if (level >= 13) return 20;
  if (level >= 9) return 15;
  if (level >= 5) return 10;
  if (level >= 2) return 5;
  return 2.5;
}

/** Strength level needed to carry a plate. */
export function carryLevel(plate: number): number {
  for (let l = 1; l <= 50; l++) if (maxCarryPlate(l) >= plate) return l;
  return 50;
}

export function maxLift(lift: LiftId, level: number): number {
  const d = LIFTS[lift];
  return d.base + d.perLevel * (Math.max(1, level) - 1);
}

export function barWeight(pairs: readonly number[]): number {
  return BAR_KG + pairs.reduce((s, p) => s + 2 * p, 0);
}

/**
 * Chance that a set goes up. Comfortable up to 80 % of your max, then the
 * chance falls to 35 % at your max; above it the bar does not move.
 */
export function liftChance(lift: LiftId, level: number, kg: number): number {
  const max = maxLift(lift, level);
  if (kg > max) return 0;
  const easy = max * 0.8;
  if (kg <= easy) return 1;
  return 1 - ((kg - easy) / (max - easy)) * 0.65;
}

/** XP for a set; heavier relative to your max gives a little bonus. */
export function liftXp(lift: LiftId, level: number, kg: number, success: boolean): number {
  const d = LIFTS[lift];
  const rel = Math.min(1, kg / maxLift(lift, level));
  const xp = kg * d.xpPerKg * (0.6 + rel * 0.6);
  return Math.max(1, Math.round(success ? xp : xp * 0.15));
}
