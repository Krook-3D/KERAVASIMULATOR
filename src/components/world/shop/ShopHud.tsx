import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { itemIcon, itemName } from '../../../data/items';
import { basketTotal, priceOf, type Shelf } from '../../../game/shop/shop';

const eur = (v: number) => `${v.toFixed(2).replace('.', ',')} €`;

function AlertMeter({ alert }: { alert: number }) {
  const tone = alert >= 60 ? 'is-high' : alert >= 30 ? 'is-mid' : 'is-low';
  return (
    <div className={`alert-meter ${tone}`} title="Hälytystaso: varastetut tavarat taskussa ja kaupan varkaudet nostavat sitä">
      <span>👁 Hälytystaso</span>
      <div className="alert-meter__bar"><div style={{ width: `${alert}%` }} /></div>
      <strong>{alert}</strong>
    </div>
  );
}

/** A shelf: left click puts a product in the basket, right click asks Buy or Steal. */
export function ShelfHud({ shelf, basket, alert, onBasket, onSteal, onClose }: {
  shelf: Shelf;
  basket: Record<string, number>;
  alert: number;
  onBasket: (itemId: string) => void;
  onSteal: (itemId: string) => void;
  onClose: () => void;
}) {
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  useEffect(() => {
    if (!menu) return;
    const off = () => setMenu(null);
    window.addEventListener('click', off);
    return () => window.removeEventListener('click', off);
  }, [menu]);
  const count = Object.values(basket).reduce((a, b) => a + b, 0);
  return (
    <div className="gym-hud shop-hud" onContextMenu={(e) => e.preventDefault()}>
      <div className="gym-hud__title">🛒 {shelf.name}</div>
      <div className="gym-hud__label">Klikkaa: koriin · <b>hiiren oikea</b>: Osta tai Varasta</div>
      <div className="shop-hud__items">
        {shelf.items.map((id) => (
          <button
            key={id}
            type="button"
            className="shop-item"
            onClick={() => onBasket(id)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenu({ id, x: e.clientX, y: e.clientY });
            }}
          >
            <span className="shop-item__icon">{itemIcon(id)}</span>
            <span className="shop-item__name">{itemName(id)}</span>
            <span className="shop-item__price">{eur(priceOf(id))}</span>
            {basket[id] ? <span className="shop-item__qty">×{basket[id]}</span> : null}
          </button>
        ))}
      </div>
      <AlertMeter alert={alert} />
      <div className="gym-hud__actions">
        <span className="muted">Korissa {count} kpl · {eur(basketTotal(basket))}</span>
        <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>Sulje</button>
      </div>
      {menu && createPortal(
        <div className="ctx-menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
          <div className="ctx-menu__title">{itemName(menu.id)}</div>
          <button type="button" onClick={() => { onBasket(menu.id); setMenu(null); }}>🧺 Osta koriin <span className="muted">({eur(priceOf(menu.id))})</span></button>
          <button type="button" className="is-danger" onClick={() => { onSteal(menu.id); setMenu(null); }}>🫳 Varasta taskuun</button>
        </div>,
        document.body,
      )}
    </div>
  );
}

/** The till: pay for the basket. */
export function TillHud({ basket, money, onPay, onRemove, onClose }: {
  basket: Record<string, number>;
  money: number;
  onPay: () => void;
  onRemove: (itemId: string) => void;
  onClose: () => void;
}) {
  const total = basketTotal(basket);
  const rows = Object.entries(basket);
  return (
    <div className="gym-hud shop-hud">
      <div className="gym-hud__title">🧾 Kassa</div>
      {rows.length === 0 ? (
        <div className="gym-hud__label">Kori on tyhjä. Hae tuotteita hyllyistä.</div>
      ) : (
        <div className="till-rows">
          {rows.map(([id, n]) => (
            <div key={id} className="till-row">
              <span>{itemIcon(id)} {itemName(id)} ×{n}</span>
              <span>{eur(priceOf(id) * n)}</span>
              <button type="button" className="till-row__x" title="Poista korista" onClick={() => onRemove(id)}>✕</button>
            </div>
          ))}
          <div className="till-row till-row--total"><span>Yhteensä</span><span>{eur(total)}</span><span /></div>
        </div>
      )}
      <div className="gym-hud__actions">
        <span className="muted">Rahaa {eur(money)}</span>
        <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>Sulje</button>
        <button type="button" className="btn btn--small" disabled={!rows.length || money < total} onClick={onPay}>
          {money < total ? 'Rahat ei riitä' : `Maksa ${eur(total)}`}
        </button>
      </div>
    </div>
  );
}

export { AlertMeter };
