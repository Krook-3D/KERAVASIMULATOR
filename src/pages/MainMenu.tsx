import { useState } from 'react';
import { MenuBackdrop } from '../components/world/MenuBackdrop';
import { useGame } from '../game/store/GameProvider';
import { levelFromXp } from '../game/xp/xp';
import { loadGraphicsQuality, saveGraphicsQuality, type GraphicsQuality } from '../services/settings';

type Modal = 'settings' | 'character' | 'controls' | 'credits' | null;

/** Start screen: big title over an aerial view of our 3D Kerava. */
export function MainMenu({ onPlay }: { onPlay: () => void }) {
  const { state, dispatch } = useGame();
  const player = state.player;
  const [modal, setModal] = useState<Modal>(null);
  const [gfx, setGfx] = useState<GraphicsQuality>(loadGraphicsQuality);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="menu">
      <MenuBackdrop />
      <div className="menu__shade" />
      <header className="menu__head">
        <h1 className="menu__title">SHERWOOD</h1>
        <p className="menu__tagline">Keravan kaduilta legendaksi · K18 roolipeli</p>
      </header>

      <section className="menu__panel">
        <div className="menu__panel-title">{player ? `Tervetuloa takaisin, ${player.name}` : 'Uusi tarina alkaa asemalta'}</div>
        <button type="button" className="menu__play" onClick={onPlay}>
          {player ? 'Jatka peliä' : 'Pelaa'}
        </button>
        {player && (
          <div className="menu__save">
            Taso {levelFromXp(player.xp)} · {player.money} € · tallennettu tälle laitteelle
          </div>
        )}
        <div className="menu__login">
          <input className="menu__input" placeholder="Käyttäjätunnus" disabled />
          <input className="menu__input" placeholder="Salasana" type="password" disabled />
          <button type="button" className="menu__btn" disabled title="Tulossa myöhemmin">
            Kirjaudu (tulossa)
          </button>
        </div>
      </section>

      <nav className="menu__buttons">
        <button type="button" className="menu__btn" onClick={() => setModal('settings')}>⚙ Asetukset</button>
        <button type="button" className="menu__btn" onClick={() => setModal('character')}>🧍 Hahmo</button>
        <button type="button" className="menu__btn" onClick={() => setModal('controls')}>🎮 Ohjaimet</button>
        <button type="button" className="menu__btn" onClick={() => setModal('credits')}>📜 Tekijät</button>
      </nav>
      <footer className="menu__foot">Kartta © OpenStreetMap contributors · Kaikki hahmot ja tapahtumat ovat keksittyjä</footer>

      {modal && (
        <div className="menu__modal" role="dialog" onClick={() => setModal(null)}>
          <div className="menu__modal-card" onClick={(e) => e.stopPropagation()}>
            {modal === 'settings' && (
              <>
                <h2>Asetukset</h2>
                <label className="menu__row">
                  <span>Grafiikka</span>
                  <select
                    value={gfx}
                    onChange={(e) => {
                      const v = e.target.value as GraphicsQuality;
                      saveGraphicsQuality(v);
                      setGfx(v);
                    }}
                  >
                    <option value="high">Korkea (jälkikäsittely, terävät varjot)</option>
                    <option value="low">Kevyt (heikommille koneille)</option>
                  </select>
                </label>
                {player && (
                  <div className="menu__row">
                    <span>Tallennus</span>
                    {confirmReset ? (
                      <button type="button" className="menu__btn menu__btn--danger" onClick={() => { dispatch({ type: 'resetGame' }); setConfirmReset(false); setModal(null); }}>
                        Varmasti? Poista hahmo
                      </button>
                    ) : (
                      <button type="button" className="menu__btn" onClick={() => setConfirmReset(true)}>Aloita alusta</button>
                    )}
                  </div>
                )}
              </>
            )}
            {modal === 'character' && (
              <>
                <h2>Hahmo</h2>
                {player ? (
                  <p>
                    <b>{player.name}</b>, taso {levelFromXp(player.xp)}. Ulkonäköä voi myöhemmin muuttaa parturissa kaupungilla.
                  </p>
                ) : (
                  <p>Hahmo luodaan kun painat Pelaa.</p>
                )}
              </>
            )}
            {modal === 'controls' && (
              <>
                <h2>Ohjaimet</h2>
                <ul className="menu__list">
                  <li><b>Klikkaa peliä</b>: hiiri lukittuu ruudun keskelle</li>
                  <li><b>Nuolinäppäimet / WASD</b>: liiku</li>
                  <li><b>Hiiri</b>: käännä kameraa hahmon takana</li>
                  <li><b>Tähtää ja klikkaa</b>: käytä ovea tai puhu ihmiselle, kun seisot vieressä</li>
                  <li><b>Hiiren oikea</b>: näytä kohteen toiminnot (käytä, puhu, tarkastele)</li>
                  <li><b>E</b>: käytä lähintä kohdetta</li>
                  <li><b>Rulla</b>: zoomaa · <b>Esc</b>: vapauta hiiri</li>
                  <li><b>Välilyönti</b>: viilaa (vankilassa)</li>
                </ul>
              </>
            )}
            {modal === 'credits' && (
              <>
                <h2>Tekijät</h2>
                <p>Sherwood · Kerava Simulator. Idea ja ohjaus: Sherwood-tiimi. Ohjelmointi ja grafiikka: Claude.</p>
                <p className="muted">Karttadata © OpenStreetMap contributors (ODbL). Kolmiulotteinen kaupunki on rakennettu itse koodilla; pelissä ei ole kopioituja assetteja.</p>
              </>
            )}
            <button type="button" className="menu__btn" onClick={() => setModal(null)}>Sulje</button>
          </div>
        </div>
      )}
    </div>
  );
}
