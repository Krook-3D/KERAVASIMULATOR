import type { SceneId } from '../../../../game/interiors/interiors';
import { BARBER_PRICE } from '../../../../game/player/appearance';
import { GymHud } from '../../gym/GymHud';
import { AppearanceEditor } from '../../../editor/AppearanceEditor';
import { AvatarPreview } from '../../../editor/AvatarPreview';
import { SWIM_ENERGY } from '../constants';
import { DRILLS } from '../../../../game/gym/drills';
import type { useTraining } from '../systems/useTraining';
import type { useBarber } from '../systems/useBarber';

/** Panels inside the gym, the swimming hall and the barber's. */
export function VenueHud({ scene, t, b, money }: { scene: SceneId; t: ReturnType<typeof useTraining>; b: ReturnType<typeof useBarber>; money: number }) {
  const { atStation, gymActive, carrying, energy } = t;
  return (
    <>
      {scene === 'gym' && atStation && !gymActive && (
        <GymHud
          lift={atStation}
          level={t.strength}
          pairs={t.gymPairs[atStation]}
          energy={energy}
          carrying={carrying?.plate ?? null}
          busy={t.busy}
          onFetch={t.fetchPlate}
          onRemove={t.removePair}
          onLift={t.startLift}
        />
      )}
      {scene === 'gym' && carrying && !atStation && <div className="gym-hud gym-hud--mini">Kannat 2 × {carrying.plate} kg levyjä tankoon…</div>}
      {scene === 'pool' && t.atPool && t.swimT0 === null && (
        <div className="gym-hud">
          <div className="gym-hud__title">Uintirata 1 <span className="muted">· 25 m</span></div>
          <p className="muted">Ui kymmenen allasmittaa. Kehittää kestävyyttä.</p>
          <div className="gym-hud__actions">
            <button type="button" className="btn" disabled={energy < SWIM_ENERGY} onClick={t.startSwim}>
              {energy < SWIM_ENERGY ? 'Liian väsynyt' : `Ui 10 × 25 m (−${SWIM_ENERGY} ⚡)`}
            </button>
          </div>
        </div>
      )}
      {scene === 'fightgym' && t.atDrill && !t.fightActive && (() => {
        const d = DRILLS[t.atDrill];
        const low = t.martial < d.level;
        return (
          <div className="gym-hud">
            <div className="gym-hud__title">{d.name} <span className="muted">· Kamppailu {t.martial}</span></div>
            <p className="muted">{low ? `Valmentaja: "Treenaa ensin perusteet. Tähän tarvitaan Kamppailu ${d.level}."` : d.blurb}</p>
            <div className="gym-hud__actions">
              <button type="button" className="btn" disabled={low || energy < d.energy || t.busy} onClick={t.startDrill}>
                {low ? `Vaatii Kamppailu ${d.level}` : energy < d.energy ? 'Liian väsynyt' : `Treenaa (−${d.energy} ⚡)`}
              </button>
            </div>
          </div>
        );
      })()}
      {scene === 'barber' && b.barberDraft && b.draftOutfit && (
        <div className="barber-hud">
          <div className="gym-hud__title">✂ Parturi Sakset <span className="muted">· {BARBER_PRICE} € · rahaa {money} €</span></div>
          <div className="barber-hud__body">
            <AvatarPreview outfit={b.draftOutfit} focus="head" />
            <AppearanceEditor value={b.barberDraft} onChange={b.setBarberDraft} only="hair" />
          </div>
          <div className="gym-hud__actions">
            <button type="button" className="btn btn--ghost" onClick={() => b.setBarberDraft(null)}>Ei sittenkään</button>
            <button type="button" className="btn" disabled={!b.barberChanged || money < BARBER_PRICE} onClick={b.payBarber}>
              {money < BARBER_PRICE ? 'Rahat ei riitä' : `Leikkaa (−${BARBER_PRICE} €)`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
