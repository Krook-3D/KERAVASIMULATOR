import { useEffect, useRef, useState } from 'react';
import { escapeChance, MASH_TIME, type EscapeOpts } from '../../../../game/street/escape';
import type { DialogueView } from '../../quest/DialogueBox';

export interface MashState extends EscapeOpts {
  t0: number;
  presses: number;
  /** Set when time is up: the roll's outcome, shown for a moment. */
  result?: { escaped: boolean; chance: number };
}

/** Space-mash escapes: `start` closes the dialogue and runs the mash; the overlay reads `mash`. */
export function useEscapeMash(setDialogue: (d: DialogueView | null) => void) {
  const [mash, setMash] = useState<MashState | null>(null);
  const pressesRef = useRef(0);

  const start = (o: EscapeOpts) => {
    setDialogue(null);
    pressesRef.current = 0;
    setMash({ ...o, t0: performance.now(), presses: 0 });
  };
  const press = () => {
    if (!mash || mash.result) return;
    pressesRef.current++;
  };

  useEffect(() => {
    if (!mash || mash.result) return;
    const key = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      if (!e.repeat) pressesRef.current++;
    };
    window.addEventListener('keydown', key);
    const id = window.setInterval(() => {
      const t = (performance.now() - mash.t0) / 1000;
      if (t < MASH_TIME) {
        setMash((m) => (m && !m.result ? { ...m, presses: pressesRef.current } : m));
        return;
      }
      const chance = escapeChance(pressesRef.current, MASH_TIME, mash.skill, mash.difficulty);
      const escaped = Math.random() < chance;
      setMash((m) => (m ? { ...m, presses: pressesRef.current, result: { escaped, chance } } : m));
    }, 80);
    return () => {
      window.removeEventListener('keydown', key);
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mash?.t0, !!mash?.result]);

  // show the result for a moment, then hand it over
  useEffect(() => {
    if (!mash?.result) return;
    const { escaped, chance } = mash.result;
    const done = mash.onDone;
    const id = window.setTimeout(() => {
      setMash(null);
      done(escaped, chance);
    }, 1400);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mash?.result]);

  return { mash, start, press };
}
