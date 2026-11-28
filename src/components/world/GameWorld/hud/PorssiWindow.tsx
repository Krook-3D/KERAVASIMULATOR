import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MarketBook, MarketItemSummary, MarketMine, MarketSide } from '../../../../../shared/market';
import { MARKET, marketTax, NPC_SHOP } from '../../../../../shared/economy';
import { getItem, NPC_STOCK } from '../../../../../shared/items';
import { itemIcon } from '../../../../data/items';
import { euros, onlineApi } from '../../../../services/online';
import { itemLabel, type OnlineApi } from '../systems/useOnline';

type Tab = 'board' | 'mine' | 'npc';
const e = (c: number | null) => (c === null ? '–' : `${euros(c)} €`);
const toCents = (s: string) => Math.round((Number(s.replace(',', '.').replace(/\s/g, '')) || 0) * 100);

/**
 * Kerava-Pörssi at the tori: the price board, one item's order book with a
 * buy/sell form, your orders and collect box, and the Torikauppias (NPC).
 * Uses the online wallet; actions only work at the counter (server checks).
 */
export function PorssiWindow({ online, tab: startTab, onClose }: { online: OnlineApi; tab: Tab; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>(startTab);
  const [items, setItems] = useState<MarketItemSummary[]>([]);
  const [mine, setMine] = useState<(MarketMine & { here: boolean }) | null>(null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const loggedIn = !!online.character;

  const reload = useCallback(async () => {
    try {
      setItems((await onlineApi.market()).items);
      if (loggedIn) setMine(await onlineApi.marketMine());
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : 'Pörssi ei vastaa.', bad: true });
    }
  }, [loggedIn]);
  useEffect(() => {
    void reload();
  }, [reload, online.marketTick]);
  // keep "are you at the counter" and the board fresh while the window is open
  useEffect(() => {
    const id = window.setInterval(() => void reload(), 5000);
    return () => window.clearInterval(id);
  }, [reload]);
  useEffect(() => {
    const key = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const act = async (f: () => Promise<string | void>) => {
    setMsg(null);
    try {
      const text = await f();
      if (text) setMsg({ text });
      await Promise.all([reload(), online.refreshWallet()]);
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : 'Virhe.', bad: true });
    }
  };

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return items
      .filter((i) => !f || itemLabel(i.itemId).toLowerCase().includes(f))
      .sort((a, b) => b.volume24h - a.volume24h || Number(b.bid !== null || b.ask !== null) - Number(a.bid !== null || a.ask !== null) || itemLabel(a.itemId).localeCompare(itemLabel(b.itemId), 'fi'));
  }, [items, filter]);
  const collectCount = (mine?.collect.money ? 1 : 0) + (mine?.collect.items.length ?? 0);

  return (
    <div className="porssi" role="dialog">
      <header className="porssi__head">
        <div>
          <div className="porssi__title">📈 Kerava-Pörssi</div>
          <div className="porssi__sub">
            {loggedIn ? <>Lompakko {e(online.wallet?.money ?? null)} · {mine?.here ? 'olet tiskillä' : 'tarjoukset vain tiskillä torilla'}</> : 'Kirjaudu verkkopeliin päävalikosta, niin voit käydä kauppaa.'}
          </div>
        </div>
        <button type="button" className="porssi__x" onClick={onClose} aria-label="Sulje">✕</button>
      </header>
      <nav className="porssi__tabs">
        <button type="button" className={tab === 'board' ? 'is-on' : ''} onClick={() => setTab('board')}>Hintataulu</button>
        <button type="button" className={tab === 'mine' ? 'is-on' : ''} onClick={() => setTab('mine')} disabled={!loggedIn}>
          Omat {collectCount > 0 && <span className="porssi__badge">{collectCount}</span>}
        </button>
        <button type="button" className={tab === 'npc' ? 'is-on' : ''} onClick={() => setTab('npc')} disabled={!loggedIn}>Torikauppias</button>
      </nav>
      {msg && <div className={`porssi__msg${msg.bad ? ' is-bad' : ''}`}>{msg.text}</div>}

      {tab === 'board' && !itemId && (
        <>
          <input className="porssi__search" placeholder="Hae tavaraa…" value={filter} onChange={(ev) => setFilter(ev.target.value)} />
          <table className="porssi__table">
            <thead>
              <tr><th>Tavara</th><th>Ohje</th><th>Osto</th><th>Myynti</th><th>24 h</th></tr>
            </thead>
            <tbody>
              {shown.map((i) => (
                <tr key={i.itemId} onClick={() => setItemId(i.itemId)}>
                  <td>{itemIcon(i.itemId)} {itemLabel(i.itemId)}</td>
                  <td>{e(i.guide)}</td>
                  <td className="bid">{e(i.bid)}</td>
                  <td className="ask">{e(i.ask)}</td>
                  <td>{i.volume24h || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {tab === 'board' && itemId && <ItemView itemId={itemId} online={online} mine={mine} onBack={() => setItemId(null)} act={act} />}

      {tab === 'mine' && mine && (
        <div className="porssi__mine">
          <section>
            <h4>Noutolaatikko</h4>
            {collectCount === 0 ? (
              <div className="muted">Tyhjä. Täyttyneet kaupat ja perutut tarjoukset tulevat tänne.</div>
            ) : (
              <>
                <ul>
                  {mine.collect.money > 0 && <li>💶 {e(mine.collect.money)}</li>}
                  {mine.collect.items.map((i) => <li key={i.itemId}>{itemIcon(i.itemId)} {itemLabel(i.itemId)} ×{i.quantity}</li>)}
                </ul>
                <button type="button" className="primary" disabled={!mine.here} onClick={() => act(async () => { await onlineApi.collect(); return 'Noudettu verkkoreppuun.'; })}>
                  {mine.here ? 'Nouda kaikki' : 'Nouda tiskillä'}
                </button>
              </>
            )}
          </section>
          <section>
            <h4>Avoimet tarjoukset ({mine.orders.length}/{mine.slots})</h4>
            {mine.orders.length === 0 && <div className="muted">Ei avoimia tarjouksia.</div>}
            {mine.orders.map((o) => (
              <div key={o.id} className="porssi__order">
                <span className={o.side}>{o.side === 'buy' ? 'OSTO' : 'MYYNTI'}</span>
                <span>{itemIcon(o.itemId)} {itemLabel(o.itemId)}</span>
                <span>{o.quantity - o.remaining}/{o.quantity} kpl à {e(o.price)}</span>
                <button type="button" onClick={() => act(async () => { await onlineApi.cancelOrder(o.id); return 'Tarjous peruttu, loput noutolaatikossa.'; })}>Peru</button>
              </div>
            ))}
          </section>
          {mine.recent.length > 0 && (
            <section>
              <h4>Viimeisimmät</h4>
              {mine.recent.map((o) => (
                <div key={o.id} className="porssi__order is-done">
                  <span className={o.side}>{o.side === 'buy' ? 'OSTO' : 'MYYNTI'}</span>
                  <span>{itemLabel(o.itemId)}</span>
                  <span>{o.quantity - o.remaining}/{o.quantity} à {e(o.price)}</span>
                  <span className="muted">{{ filled: 'täyttyi', cancelled: 'peruttu', expired: 'vanheni', open: '' }[o.status]}</span>
                </div>
              ))}
            </section>
          )}
        </div>
      )}

      {tab === 'npc' && <NpcStall online={online} here={!!mine?.here} act={act} />}
      <footer className="porssi__foot muted">
        Vero {Math.round(MARKET.taxRate * 100)} % myyjältä · hinta ±{Math.round(MARKET.priceBand * 100)} % ohjehinnasta · {MARKET.orderSlots} tarjousta · vanhenee 7 pv
      </footer>
    </div>
  );
}

function ItemView({ itemId, online, mine, onBack, act }: {
  itemId: string;
  online: OnlineApi;
  mine: (MarketMine & { here: boolean }) | null;
  onBack: () => void;
  act: (f: () => Promise<string | void>) => Promise<void>;
}) {
  const [book, setBook] = useState<MarketBook | null>(null);
  const [side, setSide] = useState<MarketSide>('buy');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  useEffect(() => {
    let live = true;
    onlineApi.marketItem(itemId).then((b) => {
      if (!live) return;
      setBook(b);
      setPrice((b.guide / 100).toFixed(2).replace('.', ','));
    }).catch(() => {});
    return () => {
      live = false;
    };
  }, [itemId, online.marketTick, mine?.orders.length]);
  const have = online.wallet?.items.find((i) => i.itemId === itemId)?.quantity ?? 0;
  const p = toCents(price), q = Math.max(0, Math.floor(Number(qty) || 0));
  const total = p * q;
  const inBand = !!book && p >= book.band[0] && p <= book.band[1];
  const can = !!online.character && !!mine?.here && inBand && q > 0 && (side === 'buy' ? total <= (online.wallet?.money ?? 0) : q <= have);

  return (
    <div className="porssi__item">
      <button type="button" className="porssi__back" onClick={onBack}>← Hintataulu</button>
      <h3>{itemIcon(itemId)} {itemLabel(itemId)}</h3>
      {!book ? (
        <div className="muted">Ladataan…</div>
      ) : (
        <>
          <div className="porssi__stats">
            <span>Ohjehinta <b>{e(book.guide)}</b></span>
            <span>Sallittu {e(book.band[0])}–{e(book.band[1])}</span>
            <span>NPC-arvo {e(getItem(itemId)?.valueCents ?? 0)}</span>
          </div>
          <Chart book={book} />
          <div className="porssi__book">
            <div>
              <h4>Ostotarjoukset</h4>
              {book.bids.length === 0 && <div className="muted">–</div>}
              {book.bids.map((l) => <div key={l.price} className="bid" onClick={() => { setSide('sell'); setPrice(String(l.price / 100).replace('.', ',')); }}>{e(l.price)} × {l.quantity}</div>)}
            </div>
            <div>
              <h4>Myyntitarjoukset</h4>
              {book.asks.length === 0 && <div className="muted">–</div>}
              {book.asks.map((l) => <div key={l.price} className="ask" onClick={() => { setSide('buy'); setPrice(String(l.price / 100).replace('.', ',')); }}>{e(l.price)} × {l.quantity}</div>)}
            </div>
          </div>
          <form
            className="porssi__form"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (!can) return;
              void act(async () => {
                const o = await onlineApi.placeOrder({ itemId, side, price: p, quantity: q });
                const done = o.quantity - o.remaining;
                return done === o.quantity ? `Kauppa täyttyi heti: ${done} kpl. Nouda noutolaatikosta.` : done > 0 ? `${done}/${o.quantity} kpl täyttyi heti, loput jäi kirjaan.` : 'Tarjous jätetty kirjaan.';
              });
            }}
          >
            <div className="porssi__side">
              <button type="button" className={side === 'buy' ? 'is-on buy' : ''} onClick={() => setSide('buy')}>Osta</button>
              <button type="button" className={side === 'sell' ? 'is-on sell' : ''} onClick={() => setSide('sell')}>Myy</button>
            </div>
            <label>Hinta €/kpl <input inputMode="decimal" value={price} onChange={(ev) => setPrice(ev.target.value)} /></label>
            <label>Määrä <input inputMode="numeric" value={qty} onChange={(ev) => setQty(ev.target.value)} /></label>
            <div className="muted">
              {side === 'buy'
                ? `Yhteensä ${e(total)} varataan heti. Jos joku myy halvemmalla, erotus palautuu.`
                : `Sinulla ${have} kpl. Saat ${e(total - marketTax(total))} (vero ${e(marketTax(total))}).`}
              {!inBand && book && ' Hinta ei ole sallitulla välillä.'}
            </div>
            <button type="submit" className="primary" disabled={!can}>
              {!online.character ? 'Kirjaudu ensin' : !mine?.here ? 'Mene tiskille' : side === 'buy' ? 'Jätä ostotarjous' : 'Jätä myyntitarjous'}
            </button>
          </form>
          {book.trades.length > 0 && (
            <div className="porssi__trades">
              <h4>Viimeiset kaupat</h4>
              {book.trades.slice(0, 6).map((t, i) => (
                <div key={i}>{new Date(t.at).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })} · {t.quantity} kpl à {e(t.price)}</div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** 30-day closing price line with the guide price as a dashed line. */
function Chart({ book }: { book: MarketBook }) {
  const pts = book.candles;
  if (pts.length < 2) return <div className="porssi__chart muted">Hintahistoria kertyy, kun kauppoja tehdään.</div>;
  const W = 320, H = 70;
  const vals = [...pts.flatMap((c) => [c.high, c.low]), book.guide];
  const lo = Math.min(...vals), hi = Math.max(...vals), span = Math.max(1, hi - lo);
  const x = (i: number) => (i / (pts.length - 1)) * W;
  const y = (v: number) => H - 4 - ((v - lo) / span) * (H - 8);
  return (
    <svg className="porssi__chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Hintahistoria 30 päivää">
      <line x1={0} x2={W} y1={y(book.guide)} y2={y(book.guide)} stroke="#7a6a4a" strokeDasharray="4 4" strokeWidth={1} />
      <polyline fill="none" stroke="#2e7d4f" strokeWidth={2} points={pts.map((c, i) => `${x(i)},${y(c.close)}`).join(' ')} />
    </svg>
  );
}

function NpcStall({ online, here, act }: { online: OnlineApi; here: boolean; act: (f: () => Promise<string | void>) => Promise<void> }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const sellable = (online.wallet?.items ?? []).filter((i) => {
    const d = getItem(i.itemId);
    return d && d.tradeability === 'free' && d.valueCents > 0;
  });
  const n = (id: string) => qty[id] ?? 1;
  return (
    <div className="porssi__npc">
      <p className="muted">Torikauppias myy tavallisia tarvikkeita kaupan hintaan ja ostaa tavaraa {Math.round(NPC_SHOP.buybackRate * 100)} %:lla arvosta (enintään {NPC_SHOP.dailySellCap} kpl / tavara / vrk). Pörssissä saat yleensä paremman hinnan.</p>
      <h4>Myytävänä</h4>
      <div className="porssi__grid">
        {NPC_STOCK.map((i) => (
          <div key={i.id} className="porssi__npcitem">
            <span>{itemIcon(i.id)} {i.name}</span>
            <span>{e(i.npcPriceCents!)}</span>
            <input inputMode="numeric" value={n(i.id)} onChange={(ev) => setQty({ ...qty, [i.id]: Math.max(1, Math.min(NPC_SHOP.maxPerPurchase, Math.floor(Number(ev.target.value) || 1))) })} />
            <button type="button" disabled={!here || (online.wallet?.money ?? 0) < i.npcPriceCents! * n(i.id)} onClick={() => act(async () => { await onlineApi.npcBuy(i.id, n(i.id)); return `Ostit: ${i.name} ×${n(i.id)}.`; })}>Osta</button>
          </div>
        ))}
      </div>
      <h4>Myy kauppiaalle</h4>
      {sellable.length === 0 && <div className="muted">Verkkorepussa ei ole myytävää.</div>}
      <div className="porssi__grid">
        {sellable.map((i) => {
          const unit = Math.floor(getItem(i.itemId)!.valueCents * NPC_SHOP.buybackRate);
          return (
            <div key={i.itemId} className="porssi__npcitem">
              <span>{itemIcon(i.itemId)} {itemLabel(i.itemId)} ({i.quantity})</span>
              <span>{e(unit)}</span>
              <span />
              <button type="button" disabled={!here} onClick={() => act(async () => { const r = await onlineApi.npcSell(i.itemId, 1); return `Myit 1 kpl: +${e(r.money)}`; })}>Myy 1</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
