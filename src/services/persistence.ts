import type { Player } from '../types/game';
import { SKILL_IDS } from '../game/player/createPlayer';
import { defaultAppearance } from '../game/player/appearance';

/**
 * Save storage. MVP uses localStorage; later this module is swapped for REST
 * calls without touching the game logic.
 */
const SAVE_KEY = 'kerava-sim:save';
const SAVE_VERSION = 1;

interface SaveFile {
  version: number;
  player: Player;
}

export function loadPlayer(): Player | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw) as SaveFile;
    if (save.version !== SAVE_VERSION || !save.player?.id) return null;
    return migrate(save.player);
  } catch {
    return null;
  }
}

/** Fills in fields added after the save was written (e.g. new skills). */
function migrate(player: Player): Player {
  const skills = { ...player.skills };
  for (const id of SKILL_IDS) skills[id] ??= { xp: 0 };
  return { ...player, skills, appearance: suitUp(player) };
}

/** The old starting outfit (hoodie, backpack, beanie) became a suit; your face and hair stay as they were. */
function suitUp(player: Player): Player['appearance'] {
  const a = player.appearance;
  const suit = defaultAppearance();
  if (!a) return suit;
  if (a.topStyle !== 'hoodie' || a.hat !== 'beanie' || !a.backpack) return a;
  return { ...a, top: suit.top, topStyle: suit.topStyle, legs: suit.legs, shoes: suit.shoes, hat: 'none', accent: suit.accent, backpack: false };
}

export function savePlayer(player: Player | null): void {
  try {
    if (!player) {
      localStorage.removeItem(SAVE_KEY);
      return;
    }
    const save: SaveFile = { version: SAVE_VERSION, player };
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage full or blocked (private mode): the game keeps running unsaved.
  }
}
