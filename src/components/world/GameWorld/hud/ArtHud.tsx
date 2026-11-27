import type { MutableRefObject } from 'react';
import { QUALITY_NAMES } from '../../../../game/art/graffiti';
import { GraffitiCanvas } from '../../art/GraffitiCanvas';
import type { useGraffiti } from '../systems/useGraffiti';

/** The "paint on the wall" button and the spray canvas with witness reactions. */
export function ArtHud({ g, inWorld, dialogueOpen, clockRef }: { g: ReturnType<typeof useGraffiti>; inWorld: boolean; dialogueOpen: boolean; clockRef: MutableRefObject<number> }) {
  const { nearWall, painting, policeAt } = g;
  return (
    <>
      {inWorld && nearWall && !painting && !dialogueOpen && (
        <button type="button" className="btn paint-btn" onClick={g.startPaint}>
          🎨 Maalaa seinään · {QUALITY_NAMES[g.qualityAt(nearWall.q, nearWall.n)]}
        </button>
      )}
      {painting && (
        <GraffitiCanvas
          palette={g.sprayPalette}
          onCancel={g.cancelPaint}
          onDone={g.finishPaint}
          info={
            <>
              <span className={painting.quality === 'nice' ? 'is-bad' : painting.quality === 'ugly' ? 'is-good' : ''}>{QUALITY_NAMES[painting.quality]}</span>
              {policeAt !== null && <span className="is-bad">📞 Joku soitti poliisit! Partio paikalla {Math.max(0, Math.ceil(policeAt - clockRef.current))} s kuluttua. Viimeistele tai lopeta!</span>}
              {g.witnessLog.map((w, i) => (
                <span key={i} className="muted">{w}</span>
              ))}
            </>
          }
        />
      )}
    </>
  );
}
