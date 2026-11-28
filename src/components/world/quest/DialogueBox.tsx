export interface DialogueOptionView {
  text: string;
  onPick: () => void;
}

export interface DialogueView {
  speaker: string;
  text: string;
  /** Small note under the line, e.g. a failed skill check. */
  note?: string;
  options: DialogueOptionView[];
}

/** RuneScape-style chat box at the bottom of the screen with numbered options. */
export function DialogueBox({ view }: { view: DialogueView }) {
  return (
    <div className="dialogue" role="dialog" aria-label={view.speaker}>
      <div className="dialogue__speaker">{view.speaker}</div>
      <p className="dialogue__text">{view.text}</p>
      {view.note && <p className="dialogue__note">{view.note}</p>}
      <ol className="dialogue__options">
        {view.options.map((o, i) => (
          <li key={i}>
            <button type="button" onClick={o.onPick}>
              {i + 1}. {o.text}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
