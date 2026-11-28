import type { IntroLine } from '../../../../game/world/intro';

/** Letterbox bars, subtitles and the skip button during the intro cutscene. */
export function IntroOverlay({ line, speaker, onSkip }: { line: IntroLine | null; speaker: string | null; onSkip: () => void }) {
  return (
    <>
      <div className="letterbox letterbox--top" />
      <div className="letterbox letterbox--bottom">
        {line && (
          <div className={`subtitle subtitle--${line.speaker}`}>
            {speaker && <span className="subtitle__speaker">{speaker}</span>}
            <span>{line.text}</span>
          </div>
        )}
      </div>
      <button type="button" className="skip-btn" onClick={onSkip}>
        Ohita ▶
      </button>
    </>
  );
}
