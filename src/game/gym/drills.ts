/**
 * Kamppailu (martial) drills at Ahjo Training Center. Bag work is the safe
 * start, wrestling with the coach gives more and a bit of Voima, sparring in
 * the ring gives the most but needs some skill and can hurt.
 */
export type DrillId = 'bag' | 'wrestle' | 'spar';

export interface DrillDef {
  id: DrillId;
  name: string;
  blurb: string;
  energy: number;
  /** Kamppailu level needed. */
  level: number;
  /** Base Kamppailu XP per round (±15 %). */
  xp: number;
  strengthXp?: number;
  /** Chance to take a hit, and how much it hurts. */
  hurtChance?: number;
  hurt?: number;
}

export const DRILLS: Record<DrillId, DrillDef> = {
  bag: { id: 'bag', name: 'Säkkitreeni', blurb: 'Kolme erää säkkiä. Tekniikka ja iskuvoima.', energy: 8, level: 1, xp: 34 },
  wrestle: { id: 'wrestle', name: 'Paini valmentajan kanssa', blurb: 'Clinchiä ja kaatoja matolla. Kehittää myös Voimaa.', energy: 12, level: 3, xp: 50, strengthXp: 15 },
  spar: { id: 'spar', name: 'Sparri kehässä', blurb: 'Kevyt ottelu toisen treenaajan kanssa. Eniten oppia, mutta voi sattua.', energy: 15, level: 6, xp: 80, hurtChance: 0.45, hurt: 10 },
};

/** XP for one round: a bit more as you level, `roll` 0–1 adds ±15 %. */
export const drillXp = (d: DrillDef, martial: number, roll: number) => Math.round(d.xp * (1 + Math.min(1, martial / 40)) * (0.85 + roll * 0.3));
