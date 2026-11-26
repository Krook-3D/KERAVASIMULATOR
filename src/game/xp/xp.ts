/**
 * Kerava Simulator XP curve (own curve, not RuneScape's table).
 * Cumulative XP needed to reach level L: 50 · (L − 1) · (L + 2) / 2
 * L1: 0, L2: 100, L3: 250, L4: 450, L5: 700, L10: 2700, L20: 10450
 */
export const MAX_LEVEL = 50;

export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.min(level, MAX_LEVEL));
  return (50 * (l - 1) * (l + 2)) / 2;
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++;
  return level;
}

/** Progress inside the current level, 0–1. */
export function levelProgress(xp: number): number {
  const level = levelFromXp(xp);
  if (level >= MAX_LEVEL) return 1;
  const start = xpForLevel(level);
  return (xp - start) / (xpForLevel(level + 1) - start);
}
