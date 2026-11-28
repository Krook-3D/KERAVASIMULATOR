/**
 * Street fights against crew members ("roadmanit"), levels 3–15. Your fight
 * power comes from Voima (gym) and Kamppailu (Ahjo Training Center), with
 * Kamppailu counting more: technique beats raw muscle.
 */
export const ROADMAN_MIN = 3;
export const ROADMAN_MAX = 15;

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 2166136261);

/** A crew member's level (3–15), stable per NPC id. */
export const roadmanLevel = (id: string) => ROADMAN_MIN + (hash(`lv:${id}`) % (ROADMAN_MAX - ROADMAN_MIN + 1));

/** Your fighting power on the same scale as a roadman's level. */
export const fightPower = (strength: number, martial: number) => 1 + strength * 0.45 + martial * 0.75;

/**
 * How tough a group is: the strongest one, plus a bit for each extra body.
 */
export const gangPower = (levels: number[]) => (levels.length ? Math.max(...levels) + (levels.length - 1) * 1.6 : 0);

/** Chance to win a fight against these foes (3 %–95 %). */
export function fightChance(strength: number, martial: number, foes: number[]): number {
  const d = fightPower(strength, martial) - gangPower(foes);
  return Math.min(0.95, Math.max(0.03, 1 / (1 + Math.exp(-d * 0.45))));
}
