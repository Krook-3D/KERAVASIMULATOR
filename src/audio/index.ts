import { useSyncExternalStore } from 'react';
import { getAudioSettings, onAudioSettings, toggleMute, unlockAudio } from './engine';
import { sfx, sfxLog } from './sounds';
import type { GameAction } from '../game/store/gameReducer';
import type { Player } from '../types/game';
import { levelFromXp } from '../game/xp/xp';

export { sfx } from './sounds';
export type { SoundId } from './sounds';
export { setLoop, updateAmbience } from './ambience';
export { getAudioSettings, setAudioSettings, toggleMute, distanceGain } from './engine';

/** React view of the volume settings. */
export const useAudioSettings = () => useSyncExternalStore(onAudioSettings, getAudioSettings, getAudioSettings);

let installed = false;
/**
 * Once per page: unlock audio on the first gesture, click sounds for every
 * button, and M to mute. Safe to call more than once.
 */
export function installAudio() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const unlock = () => unlockAudio();
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
  document.addEventListener(
    'click',
    (e) => {
      const el = e.target instanceof Element ? e.target.closest('button, [role="button"], select') : null;
      if (el && !(el as HTMLButtonElement).disabled) sfx('click');
    },
    { capture: true },
  );
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.repeat) return;
    if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey && !e.altKey) toggleMute();
  });
  if (new URLSearchParams(window.location.search).has('debug')) (window as unknown as { __keravaSfx: string[] }).__keravaSfx = sfxLog;
}

/** The sound for one game action, played as it is dispatched. */
export function soundForAction(a: GameAction) {
  switch (a.type) {
    case 'buyBasket':
    case 'sellPlot':
    case 'buyCar':
    case 'sellCar':
      return sfx('register');
    case 'stealItem':
      return sfx('steal');
    case 'caughtStealing':
      return sfx('caught');
    case 'pickupLoot':
      return sfx(a.lootId.startsWith('drop:') ? 'crate' : 'pickup');
    case 'addItem':
      return sfx('pickup');
    case 'equipItem':
    case 'unequip':
      return sfx('equip');
    case 'eatItem':
      return sfx('eat');
    case 'useRoina':
      return sfx('rattle');
    case 'cook':
      return sfx('ding');
    case 'buyPlot':
      return sfx('stamp');
    case 'buildStage':
      return sfx('build');
    case 'setPlot':
      return a.money && a.money > 0 ? sfx('coin') : undefined;
    case 'setAppearance':
      return sfx('snip');
    case 'confiscateDrugs':
      return sfx('fail');
    case 'setQuestStep':
      return a.completed ? sfx('quest') : undefined;
    case 'adjustStats':
      if (a.health && a.health < 0) return sfx('hurt');
      if (a.money && a.money > 0) return sfx('coin');
      return undefined;
    case 'grantReward':
      return a.reward.money && a.reward.money > 0 ? sfx('coin') : sfx('xp');
    default:
      return undefined;
  }
}

/** Fanfare when any skill (or the total level) went up between two saves. */
export function soundForProgress(prev: Player | null, next: Player | null) {
  if (!prev || !next || prev === next) return;
  if (levelFromXp(next.xp) > levelFromXp(prev.xp)) return sfx('levelup');
  for (const [id, s] of Object.entries(next.skills)) {
    if (levelFromXp(s?.xp ?? 0) > levelFromXp(prev.skills[id as keyof Player['skills']]?.xp ?? 0)) return sfx('levelup', { delay: 0.15 });
  }
}
