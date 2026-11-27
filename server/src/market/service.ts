/**
 * Kerava-Pörssi on the database, plus the Torikauppias (NPC stall) next to it.
 *
 * Every order goes in with its escrow in one transaction under a per-item
 * advisory lock, and all its matches happen in that same transaction, so two
 * orders can never use the same resting order and nothing is ever matched
 * without cover. Filled goods and refunds go to the collect box; collecting
 * puts them back in the pack through the ledger. See docs/MULTIPLAYER.md 10–11.
 */
import type { Db, Tx } from '../db/pool';
import { withTx } from '../db/pool';
import { addItem, addMoney, InsufficientError, takeItem, takeMoney } from '../economy/ledger';
import { MARKET, MAX_MONEY_CENTS, NPC_SHOP } from '../../../shared/economy';
import { canListOnMarket, getItem, ITEMS } from '../../../shared/items';
import type { MarketBook, MarketItemSummary, MarketMine, MarketOrderView, MarketSide } from '../../../shared/market';
import { levelFromXp } from '../../../src/game/xp/xp';
import { guidePrice, matchOrder, priceInBand, type RestingOrder } from './matching';

export class MarketError extends Error {
  constructor(
    public code: 'not_found' | 'not_allowed' | 'invalid' | 'insufficient' | 'too_far' | 'limit',
    message: string,
  ) {
    super(message);
  }
}

export interface MarketDeps {
  db: Db;
  /** Is the character standing at the Pörssi counter right now (server-known position)? */
  atMarket: (characterId: string) => boolean;
  /** Tells an online owner that their order filled. */
  notify?: (characterId: string, msg: { itemId: string; side: MarketSide; quantity: number; price: number }) => void;
  /** Who may use the Pörssi (new accounts and low levels are kept out in production). */
  minLevel: number;
  minAccountAgeMs: number;
  now?: () => number;
}

export interface PlaceOrder {
  itemId: string;
  side: MarketSide;
  /** Cents per unit. */
  price: number;
  quantity: number;
  idempotencyKey?: string;
}

const lockItem = (tx: Tx, itemId: string) => tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`market:${itemId}`]);

export class MarketService {
  constructor(private deps: MarketDeps) {}

  private now(): number {
    return this.deps.now?.() ?? Date.now();
  }

  /** Default guide price for an item never traded: its NPC value. */
  private defaultGuide(itemId: string): number {
    return Math.max(1, getItem(itemId)?.valueCents ?? 1);
  }

  async guide(itemId: string, db: Pick<Db, 'query'> = this.deps.db): Promise<number> {
    const { rows } = await db.query<{ price: number }>('SELECT price FROM market_guide_prices WHERE item_id = $1', [itemId]);
    return rows[0]?.price ?? this.defaultGuide(itemId);
  }

  private requireHere(characterId: string): void {
    if (!this.deps.atMarket(characterId)) throw new MarketError('too_far', 'Mene Pörssin tiskille torilla.');
  }

  private async requireEligible(tx: Tx, characterId: string): Promise<void> {
    const { rows } = await tx.query<{ xp: number; created_at: Date; status: string }>(
      'SELECT c.xp, a.created_at, a.status FROM characters c JOIN accounts a ON a.id = c.account_id WHERE c.id = $1',
      [characterId],
    );
    const r = rows[0];
    if (!r) throw new MarketError('not_found', 'Hahmoa ei löydy.');
    if (r.status === 'banned' || r.status === 'trade_banned') throw new MarketError('not_allowed', 'Tililläsi ei voi käydä kauppaa.');
    if (levelFromXp(r.xp) < this.deps.minLevel || this.now() - r.created_at.getTime() < this.deps.minAccountAgeMs) {
      throw new MarketError('not_allowed', `Pörssi avautuu, kun tilisi on vuorokauden vanha ja hahmosi tasolla ${this.deps.minLevel}.`);
    }
  }

  /** Puts an order in the book (escrow first), matches it, and returns the order as it stands after matching. */
  async place(characterId: string, o: PlaceOrder): Promise<MarketOrderView> {
    this.requireHere(characterId);
    const item = getItem(o.itemId);
    if (!item || !canListOnMarket(o.itemId)) throw new MarketError('invalid', 'Tätä ei voi kaupata Pörssissä.');
    if (o.side !== 'buy' && o.side !== 'sell') throw new MarketError('invalid', 'Virheellinen tarjous.');
    if (!Number.isSafeInteger(o.price) || o.price <= 0 || !Number.isSafeInteger(o.quantity) || o.quantity <= 0) {
      throw new MarketError('invalid', 'Hinnan ja määrän pitää olla positiivisia kokonaislukuja.');
    }
    if (o.price * o.quantity > MAX_MONEY_CENTS) throw new MarketError('invalid', 'Liian iso tarjous.');

    if (o.idempotencyKey) {
      const prior = await this.orderByKey(characterId, o.idempotencyKey);
      if (prior) return prior;
    }
    const notes: { to: string; msg: { itemId: string; side: MarketSide; quantity: number; price: number } }[] = [];
    try {
      const view = await withTx(this.deps.db, async (tx) => {
        notes.length = 0;
        await this.requireEligible(tx, characterId);
        await lockItem(tx, o.itemId);
        const now = this.now();
        const guide = await this.guide(o.itemId, tx);
        if (!priceInBand(o.price, guide)) {
          const lo = Math.floor(guide * (1 - MARKET.priceBand)), hi = Math.ceil(guide * (1 + MARKET.priceBand));
          throw new MarketError('invalid', `Hinnan pitää olla ${cents(lo)}–${cents(hi)} (ohjehinta ${cents(guide)}).`);
        }
        const { rows: open } = await tx.query<{ n: number }>("SELECT count(*)::int AS n FROM market_orders WHERE character_id = $1 AND status = 'open'", [characterId]);
        if (open[0]!.n >= MARKET.orderSlots) throw new MarketError('limit', `Sinulla voi olla ${MARKET.orderSlots} tarjousta kerrallaan.`);
        if (o.side === 'buy') {
          const bought = await this.boughtRecently(tx, characterId, o.itemId, now);
          const limit = item.marketBuyLimit ?? 100;
          if (bought + o.quantity > limit) throw new MarketError('limit', `Ostoraja: ${limit} kpl / 4 h (jäljellä ${Math.max(0, limit - bought)}).`);
        }

        // escrow and the order row
        const { rows } = await tx.query<{ id: number }>(
          `INSERT INTO market_orders (character_id, item_id, side, price, quantity, remaining, idempotency_key, created_at, expires_at)
           VALUES ($1, $2, $3, $4, $5, $5, $6, to_timestamp($7 / 1000.0), to_timestamp($8 / 1000.0)) RETURNING id`,
          [characterId, o.itemId, o.side, o.price, o.quantity, o.idempotencyKey ?? null, now, now + MARKET.orderLifetimeMs],
        );
        const orderId = rows[0]!.id;
        const ref = { type: 'market_order', id: String(orderId) };
        if (o.side === 'buy') await takeMoney(tx, characterId, o.price * o.quantity, 'market_escrow', ref);
        else await takeItem(tx, characterId, o.itemId, o.quantity, 'market_escrow', ref);

        // match against the other side of the book
        const opposite = o.side === 'buy' ? 'sell' : 'buy';
        const { rows: book } = await tx.query<{ id: number; character_id: string; price: number; remaining: number }>(
          `SELECT id, character_id, price, remaining FROM market_orders
            WHERE item_id = $1 AND side = $2 AND status = 'open' AND expires_at > to_timestamp($3 / 1000.0)
              AND ${o.side === 'buy' ? 'price <= $4' : 'price >= $4'}
            ORDER BY price ${o.side === 'buy' ? 'ASC' : 'DESC'}, created_at, id
            LIMIT 200 FOR UPDATE`,
          [o.itemId, opposite, now, o.price],
        );
        const resting: RestingOrder[] = book.map((b, i) => ({ id: b.id, characterId: b.character_id, side: opposite, price: b.price, remaining: b.remaining, seq: i }));
        const result = matchOrder({ id: orderId, characterId, side: o.side, price: o.price, quantity: o.quantity }, resting);
        for (const f of result.fills) {
          const rest = resting.find((r) => r.id === f.restingOrderId)!;
          await tx.query(`UPDATE market_orders SET remaining = $2::bigint, status = CASE WHEN $2::bigint = 0 THEN 'filled' ELSE status END WHERE id = $1`, [rest.id, rest.remaining]);
          const buyOrder = o.side === 'buy' ? orderId : rest.id;
          const sellOrder = o.side === 'sell' ? orderId : rest.id;
          await tx.query('INSERT INTO market_trades (item_id, buy_order_id, sell_order_id, price, quantity, tax, created_at) VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0))', [
            o.itemId, buyOrder, sellOrder, f.price, f.quantity, f.tax, now,
          ]);
          await this.toCollect(tx, f.buyerId, o.itemId, f.quantity, buyOrder);
          if (f.buyerRefund > 0) await this.toCollect(tx, f.buyerId, null, f.buyerRefund, buyOrder);
          if (f.sellerProceeds > 0) await this.toCollect(tx, f.sellerId, null, f.sellerProceeds, sellOrder);
          notes.push({ to: rest.characterId, msg: { itemId: o.itemId, side: opposite, quantity: f.quantity, price: f.price } });
        }
        await tx.query(`UPDATE market_orders SET remaining = $2::bigint, status = CASE WHEN $2::bigint = 0 THEN 'filled' ELSE status END WHERE id = $1`, [orderId, result.remaining]);
        return (await this.orderById(tx, orderId))!;
      });
      for (const n of notes) this.deps.notify?.(n.to, n.msg);
      return view;
    } catch (err) {
      if (err instanceof InsufficientError) throw new MarketError('insufficient', err.what === 'money' ? 'Rahat eivät riitä.' : 'Sinulla ei ole tarpeeksi tätä tavaraa.');
      // the same idempotency key raced in twice: the first one won
      if ((err as { code?: string }).code === '23505' && o.idempotencyKey) {
        const prior = await this.orderByKey(characterId, o.idempotencyKey);
        if (prior) return prior;
      }
      throw err;
    }
  }

  private async boughtRecently(tx: Tx, characterId: string, itemId: string, now: number): Promise<number> {
    const since = now - MARKET.buyLimitWindowMs;
    const { rows } = await tx.query<{ n: number }>(
      `SELECT coalesce((SELECT sum(t.quantity) FROM market_trades t JOIN market_orders b ON b.id = t.buy_order_id
                         WHERE b.character_id = $1 AND t.item_id = $2 AND t.created_at > to_timestamp($3 / 1000.0)), 0)
            + coalesce((SELECT sum(remaining) FROM market_orders WHERE character_id = $1 AND item_id = $2 AND side = 'buy' AND status = 'open'), 0) AS n`,
      [characterId, itemId, since],
    );
    return Number(rows[0]!.n);
  }

  private async toCollect(tx: Tx, characterId: string, itemId: string | null, amount: number, orderId: number): Promise<void> {
    await tx.query('INSERT INTO market_collect (character_id, item_id, amount, order_id) VALUES ($1, $2, $3, $4)', [characterId, itemId, amount, orderId]);
  }

  /** Cancels an open order; what is left of the escrow goes to the collect box. */
  async cancel(characterId: string, orderId: number): Promise<void> {
    await withTx(this.deps.db, async (tx) => {
      const { rows } = await tx.query<{ item_id: string }>('SELECT item_id FROM market_orders WHERE id = $1 AND character_id = $2', [orderId, characterId]);
      if (!rows[0]) throw new MarketError('not_found', 'Tarjousta ei löydy.');
      await lockItem(tx, rows[0].item_id);
      const closed = await this.close(tx, orderId, 'cancelled');
      if (!closed) throw new MarketError('not_allowed', 'Tarjous on jo täyttynyt tai suljettu.');
    });
  }

  /** Closes an open order (cancel or expiry) and refunds its remaining escrow to the collect box. */
  private async close(tx: Tx, orderId: number, status: 'cancelled' | 'expired'): Promise<boolean> {
    const { rows } = await tx.query<{ character_id: string; item_id: string; side: MarketSide; price: number; remaining: number }>(
      `UPDATE market_orders SET status = $2 WHERE id = $1 AND status = 'open' RETURNING character_id, item_id, side, price, remaining`,
      [orderId, status],
    );
    const o = rows[0];
    if (!o) return false;
    if (o.remaining > 0) {
      if (o.side === 'buy') await this.toCollect(tx, o.character_id, null, o.price * o.remaining, orderId);
      else await this.toCollect(tx, o.character_id, o.item_id, o.remaining, orderId);
    }
    return true;
  }

  /** Expires old orders (run periodically). Returns how many. */
  async expire(): Promise<number> {
    const { rows } = await this.deps.db.query<{ id: number; item_id: string }>(
      "SELECT id, item_id FROM market_orders WHERE status = 'open' AND expires_at <= to_timestamp($1 / 1000.0) LIMIT 500",
      [this.now()],
    );
    let n = 0;
    for (const r of rows) {
      await withTx(this.deps.db, async (tx) => {
        await lockItem(tx, r.item_id);
        if (await this.close(tx, r.id, 'expired')) n++;
      });
    }
    return n;
  }

  /** Moves everything in the collect box into the pack and wallet. */
  async collect(characterId: string): Promise<{ money: number; items: { itemId: string; quantity: number }[] }> {
    this.requireHere(characterId);
    return withTx(this.deps.db, async (tx) => {
      const { rows } = await tx.query<{ item_id: string | null; amount: number }>('DELETE FROM market_collect WHERE character_id = $1 RETURNING item_id, amount', [characterId]);
      let money = 0;
      const items = new Map<string, number>();
      for (const r of rows) {
        if (r.item_id === null) money += r.amount;
        else items.set(r.item_id, (items.get(r.item_id) ?? 0) + r.amount);
      }
      const ref = { type: 'market_collect', id: characterId };
      if (money > 0) await addMoney(tx, characterId, money, 'market_collect', ref);
      for (const [itemId, q] of items) await addItem(tx, characterId, itemId, q, 'market_collect', ref);
      return { money, items: [...items].map(([itemId, quantity]) => ({ itemId, quantity })) };
    });
  }

  // ---------------------------------------------------------------- reads

  private async orderById(db: Pick<Db, 'query'>, id: number): Promise<MarketOrderView | null> {
    const { rows } = await db.query('SELECT * FROM market_orders WHERE id = $1', [id]);
    return rows[0] ? toView(rows[0]) : null;
  }

  private async orderByKey(characterId: string, key: string): Promise<MarketOrderView | null> {
    const { rows } = await this.deps.db.query('SELECT * FROM market_orders WHERE character_id = $1 AND idempotency_key = $2', [characterId, key]);
    return rows[0] ? toView(rows[0]) : null;
  }

  async mine(characterId: string): Promise<MarketMine> {
    const db = this.deps.db;
    const [orders, collect, recent] = await Promise.all([
      db.query("SELECT * FROM market_orders WHERE character_id = $1 AND status = 'open' ORDER BY created_at", [characterId]),
      db.query<{ item_id: string | null; amount: number }>('SELECT item_id, sum(amount)::bigint AS amount FROM market_collect WHERE character_id = $1 GROUP BY item_id', [characterId]),
      db.query("SELECT * FROM market_orders WHERE character_id = $1 AND status <> 'open' ORDER BY created_at DESC LIMIT 10", [characterId]),
    ]);
    return {
      orders: orders.rows.map(toView),
      recent: recent.rows.map(toView),
      collect: {
        money: collect.rows.filter((r) => r.item_id === null).reduce((s, r) => s + Number(r.amount), 0),
        items: collect.rows.filter((r) => r.item_id !== null).map((r) => ({ itemId: r.item_id!, quantity: Number(r.amount) })),
      },
      slots: MARKET.orderSlots,
    };
  }

  /** One item: 5 price levels each side (no names), last trades, daily candles for 30 days. */
  async book(itemId: string): Promise<MarketBook> {
    if (!canListOnMarket(itemId)) throw new MarketError('not_found', 'Tätä ei kaupata Pörssissä.');
    const db = this.deps.db;
    const now = this.now();
    const level = (side: MarketSide) =>
      db.query<{ price: number; quantity: number; orders: number }>(
        `SELECT price, sum(remaining)::bigint AS quantity, count(*)::int AS orders FROM market_orders
          WHERE item_id = $1 AND side = $2 AND status = 'open' AND expires_at > to_timestamp($3 / 1000.0)
          GROUP BY price ORDER BY price ${side === 'buy' ? 'DESC' : 'ASC'} LIMIT 5`,
        [itemId, side, now],
      );
    const [bids, asks, trades, candles, guide] = await Promise.all([
      level('buy'),
      level('sell'),
      db.query<{ price: number; quantity: number; at: Date }>('SELECT price, quantity, created_at AS at FROM market_trades WHERE item_id = $1 ORDER BY id DESC LIMIT 15', [itemId]),
      db.query<{ day: Date; open: number; high: number; low: number; close: number; volume: number }>(
        `SELECT date_trunc('day', created_at) AS day,
                (array_agg(price ORDER BY id))[1] AS open, max(price) AS high, min(price) AS low,
                (array_agg(price ORDER BY id DESC))[1] AS close, sum(quantity)::bigint AS volume
           FROM market_trades WHERE item_id = $1 AND created_at > to_timestamp($2 / 1000.0)
          GROUP BY 1 ORDER BY 1`,
        [itemId, now - 30 * 86400_000],
      ),
      this.guide(itemId),
    ]);
    return {
      itemId,
      guide,
      band: [Math.floor(guide * (1 - MARKET.priceBand)), Math.ceil(guide * (1 + MARKET.priceBand))],
      bids: bids.rows.map((r) => ({ price: r.price, quantity: Number(r.quantity), orders: r.orders })),
      asks: asks.rows.map((r) => ({ price: r.price, quantity: Number(r.quantity), orders: r.orders })),
      trades: trades.rows.map((r) => ({ price: r.price, quantity: r.quantity, at: r.at.getTime() })),
      candles: candles.rows.map((r) => ({ day: r.day.getTime(), open: Number(r.open), high: Number(r.high), low: Number(r.low), close: Number(r.close), volume: Number(r.volume) })),
    };
  }

  /** The price board: every Pörssi item with guide, best bid/ask and 24 h volume. */
  async overview(): Promise<MarketItemSummary[]> {
    const db = this.deps.db;
    const now = this.now();
    const [best, vol, guides] = await Promise.all([
      db.query<{ item_id: string; bid: number | null; ask: number | null }>(
        `SELECT item_id, max(price) FILTER (WHERE side = 'buy') AS bid, min(price) FILTER (WHERE side = 'sell') AS ask
           FROM market_orders WHERE status = 'open' AND expires_at > to_timestamp($1 / 1000.0) GROUP BY item_id`,
        [now],
      ),
      db.query<{ item_id: string; volume: number; last: number }>(
        `SELECT item_id, sum(quantity)::bigint AS volume, (array_agg(price ORDER BY id DESC))[1] AS last
           FROM market_trades WHERE created_at > to_timestamp($1 / 1000.0) GROUP BY item_id`,
        [now - 86400_000],
      ),
      db.query<{ item_id: string; price: number }>('SELECT item_id, price FROM market_guide_prices'),
    ]);
    const b = new Map(best.rows.map((r) => [r.item_id, r]));
    const v = new Map(vol.rows.map((r) => [r.item_id, r]));
    const g = new Map(guides.rows.map((r) => [r.item_id, r.price]));
    return ITEMS.filter((i) => canListOnMarket(i.id)).map((i) => ({
      itemId: i.id,
      guide: g.get(i.id) ?? this.defaultGuide(i.id),
      bid: b.get(i.id)?.bid ?? null,
      ask: b.get(i.id)?.ask ?? null,
      last: v.get(i.id)?.last ?? null,
      volume24h: Number(v.get(i.id)?.volume ?? 0),
    }));
  }

  /** Hourly: guide price = 24 h volume-weighted median, moving at most 5 % per update. */
  async updateGuidePrices(): Promise<void> {
    const db = this.deps.db;
    const { rows } = await db.query<{ item_id: string; price: number; quantity: number }>(
      'SELECT item_id, price, quantity FROM market_trades WHERE created_at > to_timestamp($1 / 1000.0)',
      [this.now() - 86400_000],
    );
    const byItem = new Map<string, { price: number; quantity: number }[]>();
    for (const r of rows) (byItem.get(r.item_id) ?? byItem.set(r.item_id, []).get(r.item_id)!).push({ price: r.price, quantity: Number(r.quantity) });
    for (const [itemId, trades] of byItem) {
      const next = guidePrice(trades, await this.guide(itemId));
      await db.query(
        'INSERT INTO market_guide_prices (item_id, price, updated_at) VALUES ($1, $2, now()) ON CONFLICT (item_id) DO UPDATE SET price = EXCLUDED.price, updated_at = now()',
        [itemId, next],
      );
    }
  }

  // ---------------------------------------------------------------- Torikauppias (NPC stall)

  /** Buy from the NPC at its shop price (money sink). */
  async npcBuy(characterId: string, itemId: string, quantity: number): Promise<void> {
    this.requireHere(characterId);
    const item = getItem(itemId);
    if (!item?.npcPriceCents) throw new MarketError('invalid', 'Kauppias ei myy tätä.');
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > NPC_SHOP.maxPerPurchase) throw new MarketError('invalid', 'Virheellinen määrä.');
    try {
      await withTx(this.deps.db, async (tx) => {
        const ref = { type: 'npc_shop', id: 'tori' };
        await takeMoney(tx, characterId, item.npcPriceCents! * quantity, 'npc_buy', ref);
        await addItem(tx, characterId, itemId, quantity, 'npc_buy', ref);
      });
    } catch (err) {
      if (err instanceof InsufficientError) throw new MarketError('insufficient', 'Rahat eivät riitä.');
      throw err;
    }
  }

  /** Sell to the NPC at a fraction of the value, with a daily cap per item (money faucet). */
  async npcSell(characterId: string, itemId: string, quantity: number): Promise<number> {
    this.requireHere(characterId);
    const item = getItem(itemId);
    if (!item || item.tradeability !== 'free' || item.valueCents <= 0) throw new MarketError('invalid', 'Kauppias ei osta tätä.');
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new MarketError('invalid', 'Virheellinen määrä.');
    const unit = npcSellPrice(item.valueCents);
    try {
      return await withTx(this.deps.db, async (tx) => {
        const { rows } = await tx.query<{ n: number }>(
          `SELECT coalesce(-sum(delta), 0)::bigint AS n FROM ledger
            WHERE character_id = $1 AND kind = 'item' AND item_id = $2 AND reason = 'npc_sell' AND created_at > now() - interval '24 hours'`,
          [characterId, itemId],
        );
        const sold = Number(rows[0]!.n);
        if (sold + quantity > NPC_SHOP.dailySellCap) throw new MarketError('limit', `Kauppias ostaa tätä enintään ${NPC_SHOP.dailySellCap} kpl päivässä (jäljellä ${Math.max(0, NPC_SHOP.dailySellCap - sold)}).`);
        const ref = { type: 'npc_shop', id: 'tori' };
        await takeItem(tx, characterId, itemId, quantity, 'npc_sell', ref);
        if (unit * quantity > 0) await addMoney(tx, characterId, unit * quantity, 'npc_sell', ref);
        return unit * quantity;
      });
    } catch (err) {
      if (err instanceof InsufficientError) throw new MarketError('insufficient', 'Sinulla ei ole tarpeeksi tätä tavaraa.');
      throw err;
    }
  }
}

export const npcSellPrice = (valueCents: number) => Math.floor(valueCents * NPC_SHOP.buybackRate);

const cents = (c: number) => `${(c / 100).toFixed(2).replace('.', ',')} €`;

function toView(r: Record<string, any>): MarketOrderView {
  return {
    id: Number(r.id),
    itemId: r.item_id,
    side: r.side,
    price: Number(r.price),
    quantity: Number(r.quantity),
    remaining: Number(r.remaining),
    status: r.status,
    createdAt: new Date(r.created_at).getTime(),
    expiresAt: new Date(r.expires_at).getTime(),
  };
}
