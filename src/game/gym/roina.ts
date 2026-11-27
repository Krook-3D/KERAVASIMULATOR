/**
 * Gym "roina" economy (K18, fully fictional). Parody products with
 * game-abstract effects: timed boosts to training and a "rasitus" (strain)
 * meter that brings side effects when it runs high. Nothing here models real
 * substances, doses or cycles.
 *
 * Bought from Pumppi-Pete in the gym's locker corner. Carrying them counts as
 * drug units: it raises the alert level in public places and in shops.
 */
export type RoinaId = 'tankkioljy' | 'massamix' | 'kuivatin' | 'palautin' | 'tuplaus' | 'leikkuri';

export interface RoinaDef {
  id: RoinaId;
  /** Buff length in game seconds. */
  duration: number;
  /** Multipliers while active. */
  strengthXp?: number;
  enduranceXp?: number;
  maxLift?: number;
  energyRegen?: number;
  /** Strain added (0–100 scale); negative lowers it. */
  strain: number;
  price: number;
  karma: number;
  blurb: string;
}

export const ROINA: Record<RoinaId, RoinaDef> = {
  tankkioljy: { id: 'tankkioljy', duration: 600, strengthXp: 1.5, strain: 22, price: 40, karma: -2, blurb: 'Voima-XP +50 % 10 min. Rasitus +22.' },
  massamix: { id: 'massamix', duration: 900, maxLift: 1.12, strengthXp: 1.25, strain: 32, price: 70, karma: -3, blurb: 'Maksimikuorma +12 % ja Voima-XP +25 % 15 min. Rasitus +32.' },
  kuivatin: { id: 'kuivatin', duration: 600, enduranceXp: 1.4, strain: 18, price: 35, karma: -2, blurb: 'Kestävyys-XP +40 % 10 min. Rasitus +18.' },
  palautin: { id: 'palautin', duration: 600, energyRegen: 2, strain: 8, price: 30, karma: -1, blurb: 'Energia palautuu tuplanopeudella 10 min. Rasitus +8.' },
  tuplaus: { id: 'tuplaus', duration: 900, strengthXp: 1.2, enduranceXp: 1.2, energyRegen: 1.5, strain: 26, price: 95, karma: -3, blurb: 'Kaikki treeni-XP +20 % ja energia +50 % 15 min. Rasitus +26.' },
  leikkuri: { id: 'leikkuri', duration: 0, strain: -40, price: 45, karma: 0, blurb: 'Laskee rasitusta 40. Ei muuta vaikutusta.' },
};

export interface ActiveBuff {
  id: RoinaId;
  /** Game-clock second when it ends (clock restarts each session, so stored as remaining on save). */
  left: number;
}

/** Combined multipliers of the active buffs. */
export function buffMultipliers(buffs: ActiveBuff[]) {
  const m = { strengthXp: 1, enduranceXp: 1, maxLift: 1, energyRegen: 1 };
  for (const b of buffs) {
    const d = ROINA[b.id];
    if (b.left <= 0) continue;
    m.strengthXp *= d.strengthXp ?? 1;
    m.enduranceXp *= d.enduranceXp ?? 1;
    m.maxLift *= d.maxLift ?? 1;
    m.energyRegen *= d.energyRegen ?? 1;
  }
  return m;
}

/** Side effects by strain level. */
export function strainEffect(strain: number): { label: string; healthPerMin: number } {
  if (strain >= 80) return { label: 'Vakava rasitus: sydän hakkaa, päänsärky, ärtymys', healthPerMin: -6 };
  if (strain >= 55) return { label: 'Kova rasitus: unettomuus ja finnit', healthPerMin: -2 };
  if (strain >= 30) return { label: 'Lievä rasitus', healthPerMin: 0 };
  return { label: 'Ei sivuvaikutuksia', healthPerMin: 0 };
}

/** Strain falls by itself over time (per game minute). */
export const STRAIN_DECAY_PER_MIN = 3;

export const ROINA_SPOT: [number, number] = [8.2, 6.3];
