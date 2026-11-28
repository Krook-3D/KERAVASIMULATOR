import { itemIcon, itemName } from '../../data/items';
import { RECIPES, burnChance, canCook, type Recipe } from '../../game/cooking/recipes';
import type { InventorySlot } from '../../types/game';

export function CookHud({ name, level, inventory, cooking, onCook, onClose }: {
  name: string;
  level: number;
  inventory: InventorySlot[];
  cooking: { recipe: Recipe; progress: number } | null;
  onCook: (r: Recipe) => void;
  onClose: () => void;
}) {
  return (
    <div className="gym-hud shop-hud">
      <div className="gym-hud__title">🍳 {name} <span className="muted">· Ruoanlaitto taso {level}</span></div>
      {cooking ? (
        <div className="cook-progress">
          <div>Valmistetaan: {cooking.recipe.name}…</div>
          <div className="alert-meter__bar"><div style={{ width: `${cooking.progress * 100}%`, background: '#ff9a4a' }} /></div>
        </div>
      ) : (
        <div className="cook-list">
          {RECIPES.map((r) => {
            const locked = level < r.level;
            const have = canCook(inventory, r);
            return (
              <button key={r.id} type="button" className={`cook-row${locked ? ' is-locked' : ''}`} disabled={locked || !have} onClick={() => onCook(r)}>
                <span className="cook-row__icon">{itemIcon(r.out)}</span>
                <span className="cook-row__main">
                  <strong>{r.name}</strong>
                  <span className="cook-row__ing">
                    {Object.entries(r.ingredients).map(([id, n]) => {
                      const ok = (inventory.find((s) => s.itemId === id)?.quantity ?? 0) >= n;
                      return (
                        <span key={id} className={ok ? 'is-ok' : 'is-missing'}>
                          {itemIcon(id)} {itemName(id)}{n > 1 ? ` ×${n}` : ''}
                        </span>
                      );
                    })}
                  </span>
                </span>
                <span className="cook-row__meta">
                  {locked ? `🔒 taso ${r.level}` : `+${r.xp} XP · palaa ${Math.round(burnChance(level, r) * 100)} %`}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="gym-hud__actions">
        <span className="muted">Raaka-aineet: Prisma ja Alepa (osta tai varasta)</span>
        <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>Sulje</button>
      </div>
    </div>
  );
}
