import { useState, type FormEvent } from 'react';
import { useGame } from '../game/store/GameProvider';
import { STARTING_MONEY } from '../game/player/createPlayer';

const COLORS = ['#ffd23f', '#3a7bd5', '#ff6b6b', '#5ee07a', '#c084fc', '#ff9f43'];
const NAME_MAX = 16;

export function CharacterCreatePage() {
  const { dispatch } = useGame();
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]!);
  const [isAdult, setIsAdult] = useState(false);
  const trimmed = name.trim();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (trimmed && isAdult) dispatch({ type: 'createCharacter', name: trimmed, color });
  };

  return (
    <div className="create">
      <form className="card create__card" onSubmit={submit}>
        <h1 className="create__title">
          KERAVA<span>SIMULATOR</span>
        </h1>
        <p className="create__intro">
          Saavut Keravan asemalle. Taskussa {STARTING_MONEY} €, repussa ei mitään ja edessä koko kaupunki.
          Kuka olet?
        </p>

        <label className="create__label" htmlFor="char-name">
          Hahmon nimi
        </label>
        <input
          id="char-name"
          className="create__input"
          value={name}
          maxLength={NAME_MAX}
          placeholder="esim. Kerava-Kalle"
          autoFocus
          onChange={(e) => setName(e.target.value)}
        />

        <span className="create__label">Tunnusväri</span>
        <div className="create__colors" role="radiogroup" aria-label="Tunnusväri">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === color}
              aria-label={c}
              className={`create__swatch${c === color ? ' is-selected' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>

        <label className="create__age">
          <input type="checkbox" checked={isAdult} onChange={(e) => setIsAdult(e.target.checked)} />
          <span>
            Olen täyttänyt 18 vuotta. Peli on K18 ja sisältää fiktiivistä rikollisuutta ja aikuisten huumoria.
          </span>
        </label>

        <button type="submit" className="btn btn--primary" disabled={!trimmed || !isAdult}>
          Astu junasta ulos ▶
        </button>
      </form>
    </div>
  );
}
