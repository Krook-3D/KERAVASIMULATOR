import type { Player } from '../../types/game';
import { ITEMS, itemName } from '../../data/items';

export const INVENTORY_SIZE = 20;

export function InventoryPanel({ player }: { player: Player }) {
  const slots = Array.from({ length: INVENTORY_SIZE }, (_, i) => player.inventory[i] ?? null);
  return (
    <div className="stack">
      <div className="inv-grid">
        {slots.map((slot, i) => (
          <div key={i} className={`inv-slot${slot ? '' : ' is-empty'}`} title={slot ? ITEMS[slot.itemId]?.description ?? slot.itemId : undefined}>
            {slot && (
              <>
                <span className="inv-slot__name">{itemName(slot.itemId)}</span>
                {slot.quantity > 1 && <span className="inv-slot__qty">{slot.quantity}</span>}
              </>
            )}
          </div>
        ))}
      </div>
      {player.inventory.length === 0 && (
        <p className="muted">Reppu on tyhjä. Tavarat, saaliit ja kuitit päätyvät tänne.</p>
      )}
    </div>
  );
}
