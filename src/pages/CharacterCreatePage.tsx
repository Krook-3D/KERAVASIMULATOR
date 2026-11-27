import { useMemo, useState, type FormEvent } from 'react';
import { useGame } from '../game/store/GameProvider';
import { STARTING_MONEY } from '../game/player/createPlayer';
import { defaultAppearance, randomAppearance, type Appearance } from '../game/player/appearance';
import { AppearanceEditor } from '../components/editor/AppearanceEditor';
import { AvatarPreview } from '../components/editor/AvatarPreview';
import { playerOutfit } from '../components/world/PlayerCharacter';

const NAME_MAX = 16;

export function CharacterCreatePage() {
  const { dispatch } = useGame();
  const [name, setName] = useState('');
  const [look, setLook] = useState<Appearance>(() => defaultAppearance());
  const [focus, setFocus] = useState<'body' | 'head'>('body');
  const [isAdult, setIsAdult] = useState(false);
  const trimmed = name.trim();
  const outfit = useMemo(() => playerOutfit(look.top, look), [look]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (trimmed && isAdult) dispatch({ type: 'createCharacter', name: trimmed, color: look.top, appearance: look });
  };

  return (
    <div className="create">
      <form className="card create__card create__card--wide" onSubmit={submit}>
        <h1 className="create__title create__title--sherwood">
          SHERWOOD<span>uusi hahmo</span>
        </h1>
        <p className="create__intro">
          Saavut Keravan asemalle. Taskussa {STARTING_MONEY} €, repussa ei mitään ja edessä koko kaupunki. Kuka olet? Kampausta ja partaa voi
          myöhemmin muuttaa vain parturissa.
        </p>
        <div className="create__grid">
          <div className="create__preview">
            <AvatarPreview outfit={outfit} focus={focus} />
            <button type="button" className="btn btn--ghost" onClick={() => setLook(randomAppearance())}>
              🎲 Satunnainen
            </button>
          </div>
          <div className="create__side">
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
            <AppearanceEditor value={look} onChange={setLook} onTab={(t) => setFocus(t === 'head' ? 'head' : 'body')} />
          </div>
        </div>

        <label className="create__age">
          <input type="checkbox" checked={isAdult} onChange={(e) => setIsAdult(e.target.checked)} />
          <span>Olen täyttänyt 18 vuotta. Peli on K18 ja sisältää fiktiivistä rikollisuutta ja aikuisten huumoria.</span>
        </label>

        <button type="submit" className="btn btn--primary" disabled={!trimmed || !isAdult}>
          Astu junasta ulos ▶
        </button>
      </form>
    </div>
  );
}
