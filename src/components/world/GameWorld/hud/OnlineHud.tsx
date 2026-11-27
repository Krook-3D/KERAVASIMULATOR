import { useEffect, useRef, useState } from 'react';
import type { TradeItem, TradeOffer } from '../../../../../shared/protocol';
import { TRADE } from '../../../../../shared/economy';
import { canPlayerTrade } from '../../../../../shared/items';
import { euros } from '../../../../services/online';
import { itemLabel, type OnlineApi } from '../systems/useOnline';

/** Connection chip, local chat and the trade window for the shared world. */
export function OnlineHud({ online, playerCount }: { online: OnlineApi; playerCount: number }) {
  return (
    <>
      <StatusChip online={online} playerCount={playerCount} />
      {online.status === 'online' && <ChatBox online={online} />}
      {online.incoming && (
        <div className="trade-ask">
          <div>🤝 <b>{online.incoming.name}</b> haluaa käydä kauppaa.</div>
          <div className="trade-ask__row">
            <button type="button" onClick={() => online.respond(true)}>Avaa kauppa</button>
            <button type="button" onClick={() => online.respond(false)}>Ei kiitos</button>
          </div>
        </div>
      )}
      {online.trade && <TradeWindow online={online} />}
    </>
  );
}

function StatusChip({ online, playerCount }: { online: OnlineApi; playerCount: number }) {
  const s = online.status;
  if (!s) return null;
  const text =
    s === 'online' ? `Verkossa · ${playerCount} lähellä` : s === 'queued' ? `Jonossa: ${online.queue ?? '?'}.` : s === 'connecting' ? 'Yhdistetään…' : s === 'kicked' ? (online.note ?? 'Yhteys katkaistiin.') : 'Yhteys katkesi, yritetään uudelleen…';
  return (
    <div className={`net-chip net-chip--${s}`} title="Verkkopeli">
      <span className="net-chip__dot" /> {text}
    </div>
  );
}

function ChatBox({ online }: { online: OnlineApi }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Enter opens the chat (outside other inputs and dialogues)
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (document.querySelector('.dialogue, .trade-win')) return;
      e.preventDefault();
      if (document.pointerLockElement) document.exitPointerLock();
      setOpen(true);
      window.setTimeout(() => input.current?.focus(), 0);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [online.chat.length]);
  const recent = open ? online.chat : online.chat.slice(-5);
  return (
    <div className={`chat${open ? ' is-open' : ''}`}>
      <div className="chat__list" ref={list}>
        {recent.map((l) => (
          <div key={l.key} className={`chat__line${l.mine ? ' is-mine' : ''}`}>
            <b>{l.name}:</b> {l.text}
          </div>
        ))}
      </div>
      {open ? (
        <form
          className="chat__form"
          onSubmit={(e) => {
            e.preventDefault();
            online.sendChat(text);
            setText('');
            setOpen(false);
            input.current?.blur();
          }}
        >
          <input
            ref={input}
            className="chat__input"
            value={text}
            maxLength={200}
            placeholder="Sano jotain lähellä oleville…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
                input.current?.blur();
              }
            }}
            onBlur={() => !text && setOpen(false)}
          />
        </form>
      ) : (
        <button type="button" className="chat__hint" onClick={() => { setOpen(true); window.setTimeout(() => input.current?.focus(), 0); }}>
          <kbd>Enter</kbd> chat
        </button>
      )}
    </div>
  );
}

const offerItems = (o: TradeOffer) => new Map(o.items.map((i) => [i.itemId, i.quantity]));

function TradeWindow({ online }: { online: OnlineApi }) {
  const t = online.trade!;
  const wallet = online.wallet;
  const [money, setMoney] = useState(String(t.you.offer.money / 100));
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setMoney(String(t.you.offer.money / 100));
  }, [t.tradeId]);
  useEffect(() => {
    if (t.stage !== 'confirm') return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [t.stage]);

  const mine = offerItems(t.you.offer);
  const edit = t.stage === 'offer';
  const push = (items: TradeItem[], cents = t.you.offer.money) => online.offer({ items: items.filter((i) => i.quantity > 0), money: cents });
  const setQty = (itemId: string, q: number) => {
    const next = new Map(mine);
    next.set(itemId, q);
    push([...next].map(([itemId, quantity]) => ({ itemId, quantity })));
  };
  const commitMoney = () => {
    const cents = Math.max(0, Math.min(wallet?.money ?? 0, Math.round((Number(money.replace(',', '.')) || 0) * 100)));
    setMoney(String(cents / 100));
    if (cents !== t.you.offer.money) push(t.you.offer.items, cents);
  };
  const changed = new Set(t.changed ?? []);
  const wait = t.confirmableAt ? Math.max(0, Math.ceil((t.confirmableAt - now) / 1000)) : 0;
  const tradable = (wallet?.items ?? []).filter((i) => canPlayerTrade(i.itemId));

  const side = (o: TradeOffer, flash: boolean) => (
    <ul className="trade-win__offer">
      {o.money > 0 && <li className={flash && changed.has('money') ? 'is-changed' : ''}>💶 {euros(o.money)} €</li>}
      {o.items.map((i) => (
        <li key={i.itemId} className={flash && changed.has(i.itemId) ? 'is-changed' : ''}>
          {itemLabel(i.itemId)} ×{i.quantity}
        </li>
      ))}
      {o.money === 0 && o.items.length === 0 && <li className="muted">Ei mitään</li>}
    </ul>
  );

  return (
    <div className="trade-win" role="dialog">
      <div className="trade-win__title">🤝 Kauppa: {t.them.name}</div>
      <div className="trade-win__cols">
        <section>
          <h4>Sinä annat {t.you.accepted && <span className="ok">✓</span>}</h4>
          {side(t.you.offer, false)}
          {edit && (
            <div className="trade-win__edit">
              <label>
                Rahaa (€)
                <input inputMode="decimal" value={money} onChange={(e) => setMoney(e.target.value)} onBlur={commitMoney} onKeyDown={(e) => e.key === 'Enter' && commitMoney()} />
              </label>
              <div className="muted">Lompakko: {euros(wallet?.money ?? 0)} €</div>
              {tradable.length === 0 && <div className="muted">Verkkorepussa ei ole vaihdettavia tavaroita.</div>}
              {tradable.map((i) => {
                const q = mine.get(i.itemId) ?? 0;
                return (
                  <div key={i.itemId} className="trade-win__item">
                    <span>{itemLabel(i.itemId)} <span className="muted">({i.quantity})</span></span>
                    <button type="button" disabled={q <= 0} onClick={() => setQty(i.itemId, q - 1)}>−</button>
                    <b>{q}</b>
                    <button type="button" disabled={q >= i.quantity} onClick={() => setQty(i.itemId, q + 1)}>+</button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <section>
          <h4>{t.them.name} antaa {t.them.accepted && <span className="ok">✓</span>}</h4>
          {side(t.them.offer, true)}
        </section>
      </div>
      {t.stage === 'confirm' && <div className="trade-win__warn">Tarkista vielä: tätä kauppaa ei voi perua.</div>}
      <div className="trade-win__row">
        {t.stage === 'offer' ? (
          <button type="button" className="primary" disabled={t.you.accepted} onClick={() => online.accept('offer')}>
            {t.you.accepted ? 'Odotetaan toista…' : 'Hyväksy tarjous'}
          </button>
        ) : (
          <button type="button" className="primary" disabled={t.you.accepted || wait > 0} onClick={() => online.accept('confirm')}>
            {t.you.accepted ? 'Odotetaan toista…' : wait > 0 ? `Vahvista (${wait})` : 'Vahvista kauppa'}
          </button>
        )}
        <button type="button" onClick={online.cancel}>Peru</button>
      </div>
      <div className="muted trade-win__foot">Pysykää alle {TRADE.maxDistanceM} m päässä toisistanne. Muutos tarjoukseen nollaa hyväksynnät.</div>
    </div>
  );
}
