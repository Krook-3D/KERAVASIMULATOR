import type { QuestDef } from '../../types/game';
import { STASH_QUESTS } from './stashes';

/**
 * First quest, "Viilattu vapaus": the player gets jailed after holding a
 * stranger's bag near the station tunnel, receives a file hidden in a bun
 * during a visit, files through the cell bars while the guard is not
 * looking, and sneaks out past the guards.
 *
 * Steps (QuestProgress.objectiveIndex):
 *   0  talk to Jonne by the tunnel (quest not yet active)
 *   1  in jail: ask for the visit
 *   2  file through the bars without being seen
 *   3  sneak out of the cell block
 *   4  done
 */
export const JAILBREAK_ID = 'jailbreak';

export const JAILBREAK: QuestDef = {
  id: JAILBREAK_ID,
  title: 'Viilattu vapaus',
  description: 'Pidit tuntemattoman pussia ja päädyit linnaan. Nyt pitää päästä ulos ennen kuin kukaan ehtii kysellä enempää.',
  giverNpcId: 'jonne',
  objectives: [
    { type: 'talk', npcId: 'jonne', text: 'Juttele Jonnelle asematunnelin suulla.' },
    { type: 'talk', npcId: 'visitor', text: 'Pyydä tapaamista sellissä (serkku Pasi on tulossa).' },
    { type: 'activity', activityId: 'file-bars', text: 'Viilaa kalterit poikki, kun vartija ei katso.' },
    { type: 'visit', poiId: 'prison-exit', text: 'Hiivi ulos osastolta vartijoiden huomaamatta.' },
  ],
  rewards: { xp: 120, money: 0, skillXp: { evasion: 250, hustling: 40 } },
};

export const JAILBREAK_STEP = { notStarted: 0, visit: 1, file: 2, escape: 3, done: 4 } as const;

/** Seconds of filing needed to cut through the bars. */
export const FILE_TIME = 11;

export const QUESTS: Record<string, QuestDef> = { [JAILBREAK_ID]: JAILBREAK, ...STASH_QUESTS };
