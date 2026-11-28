import { sfx } from './sounds';

/** What the player walks on; the sound director sets it from the scene. */
export const SURFACE = { value: 'soft' as 'soft' | 'hard' | 'wet' };

export function playFootstep() {
  sfx(SURFACE.value === 'hard' ? 'stepHard' : SURFACE.value === 'wet' ? 'stepWet' : 'stepSoft', { gain: 0.8 });
}
