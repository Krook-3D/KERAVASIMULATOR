import { useEffect, useRef, type MutableRefObject } from 'react';
import type * as THREE from 'three';
import { distanceGain, setLoop, sfx, type SoundId } from '../../../../audio';
import { msSinceSfx } from '../../../../audio/sounds';
import type { PackageDrop } from '../../../../game/world/packageDrop';

export interface SoundscapeInput {
  scene: string;
  cutscene: boolean;
  toast: string | null;
  dialogueOpen: boolean;
  lifting: boolean;
  swimming: boolean;
  drilling: boolean;
  cooking: boolean;
  painting: boolean;
  policeComing: boolean;
  building: boolean;
  mash: { title: string; presses: number; result?: { escaped: boolean } } | null;
  gang: boolean;
  chase: boolean;
  drop: PackageDrop | null;
  busRiding: boolean;
  trainRide: boolean;
  chatCount: number;
  lastChatMine: boolean;
  tradeIncoming: boolean;
  clockRef: MutableRefObject<number>;
  positionRef: MutableRefObject<THREE.Vector3>;
}

/** Repeats `id` (or a list of ids, in turn) every `ms` while `on`. */
function useRepeat(on: boolean, ids: SoundId[], ms: number, firstMs = 200) {
  useEffect(() => {
    if (!on) return;
    let i = 0;
    const play = () => sfx(ids[i++ % ids.length]!);
    const first = window.setTimeout(play, firstMs);
    const id = window.setInterval(play, ms);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
}

/** Runs `fn` when `value` changes (not on the first render). */
function useOnChange<T>(value: T, fn: (now: T, before: T) => void) {
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    const before = prev.current;
    prev.current = value;
    fn(value, before);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
}

/**
 * Sound for what happens on screen: doors, notifications, training, cooking,
 * painting, building, chases, the package drop and transport. Action sounds
 * (buying, picking up, levelling) come from the game store instead.
 */
export function useSoundscape(i: SoundscapeInput) {
  useOnChange(i.scene, () => !i.cutscene && sfx('door'));
  // package drops: the announcement, then the landing if you are close enough to hear it
  const dropId = i.drop?.id ?? null;
  useOnChange(dropId, (id) => id && sfx('dropHorn'));
  useEffect(() => {
    const d = i.drop;
    if (!d) return;
    let landed = i.clockRef.current >= d.landsAt;
    const id = window.setInterval(() => {
      if (landed || i.clockRef.current < d.landsAt) return;
      landed = true;
      const p = i.positionRef.current;
      const k = i.scene === 'world' ? distanceGain(Math.hypot(p.x - d.x, p.z - d.z), 15, 300) : 0;
      if (k > 0.02) sfx('dropLand', { gain: k });
    }, 200);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropId, i.scene]);

  // a soft blip for notices, unless something else just made a sound
  useOnChange(i.toast, (t) => t && msSinceSfx() > 250 && sfx('toast'));
  useOnChange(i.dialogueOpen, (open) => open && msSinceSfx() > 150 && sfx('open'));

  useOnChange(i.swimming, (on) => on && sfx('splash'));
  useRepeat(i.lifting, ['clank'], 1300, 700);
  useRepeat(i.swimming, ['stroke'], 650, 500);
  useRepeat(i.drilling, ['punch', 'swing', 'punch', 'punch', 'swing'], 380, 300);
  useRepeat(i.building, ['hammer', 'hammer', 'hammer', 'saw'], 420, 150);

  useEffect(() => setLoop('sizzle', i.cooking), [i.cooking]);
  useEffect(() => {
    setLoop('spray', i.painting);
    if (i.painting) sfx('rattle');
  }, [i.painting]);
  useEffect(() => () => {
    setLoop('sizzle', false);
    setLoop('spray', false);
  }, []);
  useOnChange(i.policeComing, (on) => on && sfx('siren'));

  // escapes: who is after you, every press, and how it ended
  const mashTitle = i.mash?.title ?? null;
  useOnChange(mashTitle, (t) => {
    if (!t) return;
    const lower = t.toLowerCase();
    if (lower.includes('poliisi') || lower.includes('partio') || lower.includes('kyt')) sfx('siren');
    else if (lower.includes('vartija')) sfx('alarm');
    else sfx('threat');
  });
  useOnChange(i.mash?.presses ?? 0, (n, b) => n > b && sfx('tap'));
  useOnChange(i.mash?.result ? (i.mash.result.escaped ? 'ok' : 'fail') : null, (r) => r && sfx(r === 'ok' ? 'escape' : 'fail'));
  useOnChange(i.gang, (on) => on && sfx('threat'));
  useOnChange(i.chase, (on) => on && sfx('threat'));

  // transport
  useOnChange(i.busRiding, (on) => {
    if (on) {
      sfx('busBrake');
      sfx('busDoor', { delay: 1.1 });
    } else sfx('busDoor');
  });
  useOnChange(i.trainRide, (on) => on && sfx('trainHorn', { gain: 0.6 }));

  // online
  useOnChange(i.chatCount, (n, b) => n > b && !i.lastChatMine && sfx('chat'));
  useOnChange(i.tradeIncoming, (on) => on && sfx('open'));
}
