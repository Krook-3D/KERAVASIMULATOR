import { BAR_KG, LIFTS, MAX_PAIRS, PLATES, SET_ENERGY, barWeight, carryLevel, liftChance, maxCarryPlate, maxLift, type LiftId } from '../../../game/gym/lifting';
import { PLATE_LOOK } from '../interiors/GymInterior';

interface GymHudProps {
  lift: LiftId;
  level: number;
  pairs: readonly number[];
  energy: number;
  /** A plate pair is being fetched from the plate tree. */
  carrying: number | null;
  busy: boolean;
  onFetch: (plate: number) => void;
  onRemove: () => void;
  onLift: () => void;
}

/** Panel at a lifting station: load the bar plate by plate, then lift. */
export function GymHud({ lift, level, pairs, energy, carrying, busy, onFetch, onRemove, onLift }: GymHudProps) {
  const kg = barWeight(pairs);
  const chance = liftChance(lift, level, kg);
  const carry = maxCarryPlate(level);
  const full = pairs.length >= MAX_PAIRS;
  const verdict = chance >= 1 ? 'Kevyt – nousee varmasti' : chance > 0 ? `Raskas – onnistuu n. ${Math.round(chance * 100)} %` : 'Liian raskas – tanko ei liiku';
  return (
    <div className="gym-hud">
      <div className="gym-hud__title">
        {LIFTS[lift].name} <span className="muted">· Voima {level}</span>
      </div>
      <div className="gym-hud__bar">
        <span className="gym-hud__kg">{kg % 1 ? kg.toFixed(2) : kg} kg</span>
        <span className="gym-hud__plates">
          {pairs.length === 0 ? <em className="muted">Tyhjä tanko ({BAR_KG} kg)</em> : pairs.map((p, i) => (
            <span key={i} className="gym-plate" style={{ background: PLATE_LOOK[p]?.c }} title={`${p} kg`}>
              {p}
            </span>
          ))}
        </span>
      </div>
      <div className={`gym-hud__verdict ${chance >= 1 ? 'is-safe' : chance > 0 ? 'is-warn' : 'is-danger'}`}>{verdict}</div>
      <div className="gym-hud__label">Hae levypari telineestä (kannat enintään {carry} kg levyjä):</div>
      <div className="gym-hud__plate-row">
        {PLATES.map((p) => {
          const tooHeavy = p > carry;
          return (
            <button
              key={p}
              type="button"
              className="gym-plate-btn"
              disabled={busy || carrying !== null || full || tooHeavy}
              title={tooHeavy ? `Vaatii Voima ${carryLevel(p)}` : `Hae 2 × ${p} kg`}
              onClick={() => onFetch(p)}
              style={{ borderColor: PLATE_LOOK[p]?.c }}
            >
              {tooHeavy ? '🔒' : ''}
              {p}
            </button>
          );
        })}
      </div>
      {carrying !== null && <div className="muted">Kannat 2 × {carrying} kg levyjä…</div>}
      <div className="gym-hud__actions">
        <button type="button" className="btn btn--ghost" disabled={busy || carrying !== null || !pairs.length} onClick={onRemove}>
          Poista uloin pari
        </button>
        <button type="button" className="btn" disabled={busy || carrying !== null || energy < SET_ENERGY} onClick={onLift}>
          {energy < SET_ENERGY ? 'Liian väsynyt' : `Nosta sarja (−${SET_ENERGY} ⚡)`}
        </button>
      </div>
      <div className="gym-hud__foot muted">
        Ennätyksesi tällä tasolla: n. {Math.floor(maxLift(lift, level))} kg
      </div>
    </div>
  );
}
