import type { Player } from '../types/game';

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
    return save.player;
  } catch {
    return null;
  }
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
