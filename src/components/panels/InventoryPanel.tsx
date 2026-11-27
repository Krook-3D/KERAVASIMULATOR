import { useState } from 'react';
import type { EquipmentSlot, Player } from '../../types/game';
import { ITEMS, RARITY_COLORS, RARITY_NAMES, itemIcon, itemName } from '../../data/items';
import { INVENTORY_SIZE } from '../../game/store/gameReducer';
import { useGame } from '../../game/store/GameProvider';
import { ROINA, type RoinaId } from '../../game/gym/roina';

export { INVENTORY_SIZE };

/** Hands strip: what you're holding, click to put it back in the backpack. */
export function HandsStrip({ player }: { player: Player }) {
  const { dispatch } = useGame();
  const { handL, handR } = player.equipment;
  const twoHanded = !!handR && handR === handL && ITEMS[handR]?.hands === 2;
  const hand = (slot: EquipmentSlot, label: string, id?: string) => (
    <button
      type="button"
      className={`hand-slot${id ? '' : ' is-empty'}`}
      style={id ? { borderColor: RARITY_COLORS[ITEMS[id]?.rarity ?? 'common'] } : undefined}
      disabled={!id}
      title={id ? `${itemName(id)}: laita reppuun` : label}
      onClick={() => dispatch({ type: 'unequip', slot })}
    >
      <span className="hand-slot__icon">{id ? itemIcon(id) : '✋'}</span>
      <span className="hand-slot__label">{id ? itemName(id) : label}</span>
    </button>
  );
  return (
    <div className={`hands${twoHanded ? ' is-two' : ''}`}>
      {twoHanded ? hand('handR', 'Molemmat kädet', handR) : (
        <>
          {hand('handL', 'Vasen käsi', handL)}
          {hand('handR', 'Oikea käsi', handR)}
        </>
      )}
    </div>
  );
}

export function InventoryPanel({ player }: { player: Player }) {
  const { dispatch } = useGame();
  const [sel, setSel] = useState<string | null>(null);
  const slots = Array.from({ length: INVENTORY_SIZE }, (_, i) => player.inventory[i] ?? null);
  const def = sel ? ITEMS[sel] : undefined;
  const has = !!sel && player.inventory.some((s) => s.itemId === sel);
  return (
    <div className="stack">
      <HandsStrip player={player} />
      <div className="muted inv-count">
        Reppu {player.inventory.length} / {INVENTORY_SIZE}
      </div>
      <div className="inv-grid">
        {slots.map((slot, i) => {
          const d = slot ? ITEMS[slot.itemId] : undefined;
          return (
            <button
              type="button"
              key={i}
              className={`inv-slot${slot ? '' : ' is-empty'}${slot && slot.itemId === sel ? ' is-selected' : ''}`}
              style={d ? { borderColor: RARITY_COLORS[d.rarity] } : undefined}
              title={slot ? itemName(slot.itemId) : undefined}
              disabled={!slot}
              onClick={() => slot && setSel(slot.itemId === sel ? null : slot.itemId)}
            >
              {slot && (
                <>
                  <span className="inv-slot__icon">{itemIcon(slot.itemId)}</span>
                  <span className="inv-slot__name">{itemName(slot.itemId)}</span>
                  {slot.quantity > 1 && <span className="inv-slot__qty">{slot.quantity}</span>}
                </>
              )}
            </button>
          );
        })}
      </div>
      {def && has && (
        <div className="inv-detail" style={{ borderColor: RARITY_COLORS[def.rarity] }}>
          <div className="inv-detail__head">
            <span className="inv-detail__icon">{itemIcon(def.id)}</span>
            <div>
              <strong>{def.name}</strong>
              <div style={{ color: RARITY_COLORS[def.rarity] }} className="inv-detail__rarity">
                {RARITY_NAMES[def.rarity]}
                {def.hands === 2 ? ' · kahden käden' : def.hands === 1 ? ' · yhden käden' : ''}
              </div>
            </div>
          </div>
          <p className="muted">{def.description}</p>
          {def.value > 0 && <div className="muted">Arvo noin {def.value} €</div>}
          {def.hands === 1 && (
            <div className="row">
              <button type="button" className="btn btn--small" onClick={() => dispatch({ type: 'equipItem', itemId: def.id, hand: 'handL' })}>Vasempaan käteen</button>
              <button type="button" className="btn btn--small" onClick={() => dispatch({ type: 'equipItem', itemId: def.id, hand: 'handR' })}>Oikeaan käteen</button>
            </div>
          )}
          {def.category === 'drug' && def.id in ROINA && (
            <>
              <div className="muted">{ROINA[def.id as RoinaId].blurb}</div>
              <button type="button" className="btn btn--small" onClick={() => dispatch({ type: 'useRoina', id: def.id as RoinaId })}>Käytä</button>
            </>
          )}
          {def.effects && (
            <button type="button" className="btn btn--small" onClick={() => dispatch({ type: 'eatItem', itemId: def.id })}>
              Syö (+{def.effects.energy ?? 0} ⚡)
            </button>
          )}
          {def.hands === 2 && (
            <button type="button" className="btn btn--small" onClick={() => dispatch({ type: 'equipItem', itemId: def.id })}>Ota molempiin käsiin</button>
          )}
        </div>
      )}
      {player.inventory.length === 0 && <p className="muted">Reppu on tyhjä. Etsi tavaraa maastosta, kaduilta ja puistoista.</p>}
    </div>
  );
}
