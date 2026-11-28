/**
 * Annoying a crew on purpose: they put up with it a couple of times, then on
 * a random 3rd–5th provocation the whole crew comes at you.
 */
export interface CrewMood {
  /** Provocations since the crew last attacked. */
  count: number;
  /** The provocation number that sets them off (3–5). */
  attackAt: number;
}

export const ATTACK_MIN = 3;
export const ATTACK_MAX = 5;

export const freshMood = (roll: number): CrewMood => ({ count: 0, attackAt: ATTACK_MIN + Math.floor(Math.min(0.9999, Math.max(0, roll)) * (ATTACK_MAX - ATTACK_MIN + 1)) });

/** One more provocation. On an attack the mood starts over with a new random limit. */
export function provoke(mood: CrewMood | undefined, roll: number, nextRoll: number): { mood: CrewMood; attack: boolean } {
  const m = mood ?? freshMood(roll);
  const count = m.count + 1;
  if (count >= m.attackAt) return { mood: freshMood(nextRoll), attack: true };
  return { mood: { ...m, count }, attack: false };
}

/** How the crew answers as their patience runs out (0 = first warning). */
export const WARNINGS = [
  'Mitä sä just sanoit? Mee nyt vaan.',
  'Bro, sä alat oikeesti ärsyttää. Viimenen varotus.',
  'Wallah, vielä kerran ja sä katut.',
  'Okei. Sä et tajua. Pojat, katsokaa tätä tyyppiä.',
];

export const INSULTS = [
  'Mitä te luuserit tässä notkutte koko päivän?',
  'Teidän jengin nimi on ihan cringe.',
  'Mun mummo on kovempi ku te kaikki yhteensä.',
  'Ootteks te jotain kaupungin koristeita vai?',
  'Kuka teille ostaa noi vaatteet, äiti?',
];
