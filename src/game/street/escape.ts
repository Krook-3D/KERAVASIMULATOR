/**
 * Escapes: mash Space for a few seconds. The faster you press, the better the
 * odds; Kyttien pakoilu / Juoksu add a little on top, and some pursuers are
 * harder to shake (a police patrol more than a shop guard).
 */
export const MASH_TIME = 3;

/** Escape chance (0.03–0.95) for `presses` in `seconds`, with a skill level and difficulty (0.5 easy … 1.5 hard). */
export function escapeChance(presses: number, seconds: number, skill: number, difficulty = 1): number {
  const rate = presses / Math.max(0.5, seconds);
  const p = 0.04 + (rate - 2 - difficulty * 1.5) * 0.11 + skill * 0.015;
  return Math.max(0.03, Math.min(0.95, p));
}

export interface EscapeOpts {
  /** Who is after you, e.g. "Vartija". */
  title: string;
  /** Skill level that helps (max of Kyttien pakoilu and Juoksu). */
  skill: number;
  difficulty?: number;
  /** Called once with the result after the mash and the result flash. */
  onDone: (escaped: boolean, chance: number) => void;
}
