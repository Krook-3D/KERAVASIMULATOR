import { useState } from 'react';
import type { EquipmentSlot, Player } from '../../types/game';
import { levelFromXp, levelProgress, xpForLevel } from '../../game/xp/xp';
import { MAX_ENERGY, MAX_HEALTH } from '../../game/player/createPlayer';
import { useGame } from '../../game/store/GameProvider';
import { ProgressBar } from '../ProgressBar';
import { itemIcon, itemName } from '../../data/items';
import { bodyLabel, bodyShape, START_BODY } from '../../game/player/body';

const SLOTS: { id: EquipmentSlot; label: string }[] = [
  { id: 'head', label: 'Pää' },
  { id: 'body', label: 'Keho' },
  { id: 'legs', label: 'Jalat' },
  { id: 'feet', label: 'Kengät' },
  { id: 'handL', label: 'Vasen käsi' },
  { id: 'handR', label: 'Oikea käsi' },
  { id: 'accessory', label: 'Asuste' },
  { id: 'backpack', label: 'Reppu' },
];

export function CharacterPanel({ player }: { player: Player }) {
  const { dispatch } = useGame();
  const [confirmReset, setConfirmReset] = useState(false);
  const level = levelFromXp(player.xp);

  return (
    <div className="stack">
      <div className="char-head">
        <div className="char-head__avatar" style={{ background: player.color }} />
        <div>
          <div className="char-head__name">{player.name}</div>
          <div className="muted">Character level {level}</div>
        </div>
      </div>

      <div className="stat">
        <div className="stat__row"><span>XP</span><span>{player.xp} / {xpForLevel(level + 1)}</span></div>
        <ProgressBar value={levelProgress(player.xp)} label="XP" />
      </div>
      <div className="stat">
        <div className="stat__row"><span>❤️ Health</span><span>{player.health} / {MAX_HEALTH}</span></div>
        <ProgressBar value={player.health / MAX_HEALTH} color="var(--red)" label="Health" />
      </div>
      <div className="stat">
        <div className="stat__row"><span>⚡ Energia</span><span>{player.energy} / {MAX_ENERGY}</span></div>
        <ProgressBar value={player.energy / MAX_ENERGY} color="var(--yellow)" label="Energia" />
      </div>
      <div className="stat__row"><span>💰 Raha</span><strong>{player.money} €</strong></div>
      {(() => {
        const shape = bodyShape(player.body, levelFromXp(player.skills.strength?.xp ?? 0));
        const b = player.body ?? START_BODY;
        return (
          <>
            <h3 className="section-title">Kroppa: {bodyLabel(shape)}</h3>
            <div className="stat">
              <div className="stat__row"><span>🍔 Rasva</span><span>{Math.round(shape.fat * 100)} %</span></div>
              <ProgressBar value={shape.fat} color="var(--yellow)" label="Rasva" />
            </div>
            <div className="stat">
              <div className="stat__row"><span>💪 Lihas</span><span>{Math.round(shape.muscle * 100)} %</span></div>
              <ProgressBar value={shape.muscle} color="var(--red)" label="Lihas" />
            </div>
            <p className="muted">Maastavedon ennätys {b.deadlift} kg{b.roina > 0 ? ` · roinaa käytetty ${Math.round(b.roina * 100)} rasituspistettä` : ''}. Syöminen täydellä energialla lihottaa, treeni polttaa.</p>
          </>
        );
      })()}

      <h3 className="section-title">Varusteet</h3>
      <div className="equip-grid">
        {SLOTS.map((slot) => (
          <div key={slot.id} className="equip-slot">
            <span className="muted">{slot.label}</span>
            <span>{player.equipment[slot.id] ? `${itemIcon(player.equipment[slot.id]!)} ${itemName(player.equipment[slot.id]!)}` : '—'}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        className={`btn btn--ghost${confirmReset ? ' btn--danger' : ''}`}
        onClick={() => (confirmReset ? dispatch({ type: 'resetGame' }) : setConfirmReset(true))}
        onBlur={() => setConfirmReset(false)}
      >
        {confirmReset ? 'Varmasti? Kaikki edistys katoaa' : 'Aloita alusta'}
      </button>
    </div>
  );
}
