import type { SceneId } from '../../../../game/interiors/interiors';
import { basketTotal } from '../../../../game/shop/shop';
import { ShelfHud, TillHud, AlertMeter } from '../../shop/ShopHud';
import type { useShop } from '../systems/useShop';

/** Shop shelves and till, the basket / alert strip, the holding-cell timer and the street alert meter. */
export function ShopOverlay({ s, scene, inWorld, dialogueOpen, money }: { s: ReturnType<typeof useShop>; scene: SceneId; inWorld: boolean; dialogueOpen: boolean; money: number }) {
  const { shop, atShelf, atTill, basket, alert } = s;
  return (
    <>
      {shop && atShelf && !dialogueOpen && (
        <ShelfHud shelf={atShelf} basket={basket} alert={alert} onBasket={s.toBasket} onSteal={s.stealItem} onClose={() => s.setAtShelf(null)} />
      )}
      {shop && atTill && !dialogueOpen && (
        <TillHud basket={basket} money={money} onPay={s.payBasket} onRemove={s.fromBasket} onClose={() => s.setAtTill(false)} />
      )}
      {shop && !atShelf && !atTill && (Object.keys(basket).length > 0 || alert > 10) && (
        <div className="gym-hud gym-hud--mini shop-mini">
          {Object.keys(basket).length > 0 && <span>🧺 Kori: {Object.values(basket).reduce((a, b) => a + b, 0)} kpl · {basketTotal(basket).toFixed(2).replace('.', ',')} € · maksa kassalla</span>}
          <AlertMeter alert={alert} />
        </div>
      )}
      {scene === 'police' && s.putkaUntil !== null && (
        <div className="gym-hud gym-hud--mini putka-hud">🔒 Putkassa · vapautus {s.putkaLeft} s kuluttua</div>
      )}
      {inWorld && alert >= 20 && (
        <div className="gym-hud gym-hud--mini shop-mini"><AlertMeter alert={alert} /></div>
      )}
    </>
  );
}
