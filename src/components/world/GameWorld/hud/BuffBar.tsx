import { ROINA, strainEffect, type ActiveBuff } from '../../../../game/gym/roina';
import { itemIcon } from '../../../../data/items';

/** Active roina buffs and the strain level. */
export function BuffBar({ buffs, strain }: { buffs: ActiveBuff[]; strain: number }) {
  if (buffs.length === 0 && strain < 5) return null;
  return (
    <div className="buff-bar">
      {buffs.map((b) => (
        <span key={b.id} className="buff" title={ROINA[b.id].blurb}>
          {itemIcon(b.id)} {Math.ceil(b.left / 60)} min
        </span>
      ))}
      {strain >= 5 && (
        <span className={`buff buff--strain${strain >= 55 ? ' is-high' : ''}`} title={strainEffect(strain).label}>
          🫀 Rasitus {Math.round(strain)}
        </span>
      )}
    </div>
  );
}
