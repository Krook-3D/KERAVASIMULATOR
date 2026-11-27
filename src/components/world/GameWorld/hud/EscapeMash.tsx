import { escapeChance, MASH_TIME } from '../../../../game/street/escape';
import type { MashState } from '../systems/useEscapeMash';

/** "Rämpytä Spacea!" overlay: time left, presses and the live escape chance. */
export function EscapeMash({ mash, onPress }: { mash: MashState; onPress: () => void }) {
  const t = Math.min(MASH_TIME, (performance.now() - mash.t0) / 1000);
  const chance = mash.result?.chance ?? escapeChance(mash.presses, Math.max(t, 0.8), mash.skill, mash.difficulty);
  const pct = Math.round(chance * 100);
  return (
    <div className={`mash${mash.result ? (mash.result.escaped ? ' is-free' : ' is-caught') : ''}`}>
      <div className="mash__who">{mash.title} lähtee perään!</div>
      {mash.result ? (
        <div className="mash__big">{mash.result.escaped ? '🏃 PÄÄSIT KARKUUN!' : '🫷 JÄIT KIINNI'}</div>
      ) : (
        <button type="button" className="mash__big mash__btn" onPointerDown={(e) => { e.preventDefault(); onPress(); }}>
          RÄMPYTÄ <kbd>SPACE</kbd>!
        </button>
      )}
      <div className="mash__time"><span style={{ width: `${(1 - t / MASH_TIME) * 100}%` }} /></div>
      <div className="mash__meter"><span style={{ width: `${pct}%` }} /></div>
      <div className="mash__stats">
        {mash.presses} painallusta · karkuunpääsy {pct} %{mash.skill ? ` · pakoilu/juoksu ${mash.skill}` : ''}
      </div>
    </div>
  );
}
