import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool';
import { auditCharacter } from '../src/economy/ledger';
import { MarketError, MarketService, npcSellPrice } from '../src/market/service';
import { getItem } from '../../shared/items';
import { marketTax, NPC_SHOP } from '../../shared/economy';
import { buildApp, type App } from '../src/app';
import { loadConfig } from '../src/config';
import { dbAvailable, freshDb, makeCharacter, money, qty, TEST_DB_URL } from './helpers';

const ok = await dbAvailable();
// kahvi: value 2,00 € → guide 200 c, band 140–260 c
const ITEM = 'kahvi';

describe.skipIf(!ok)('Kerava-Pörssi', () => {
  let db: Db;
  let market: MarketService;
  const away = new Set<string>();

  beforeAll(async () => {
    db = await freshDb();
    market = new MarketService({ db, atMarket: (id) => !away.has(id), minLevel: 0, minAccountAgeMs: 0 });
  });
  afterAll(async () => {
    await db?.end();
  });

  const clean = async (...ids: string[]) => {
    for (const id of ids) expect(await auditCharacter(db, id)).toEqual([]);
  };

  it('escrows, fills at the resting price, refunds the difference and taxes the seller', async () => {
    const seller = await makeCharacter(db, { items: { [ITEM]: 10 } });
    const buyer = await makeCharacter(db);
    const sell = await market.place(seller.id, { itemId: ITEM, side: 'sell', price: 180, quantity: 10 });
    expect(sell).toMatchObject({ status: 'open', remaining: 10 });
    expect(await qty(db, seller.id, ITEM)).toBe(0); // in escrow

    const before = await money(db, buyer.id);
    const buy = await market.place(buyer.id, { itemId: ITEM, side: 'buy', price: 220, quantity: 4 });
    expect(buy).toMatchObject({ status: 'filled', remaining: 0 });
    expect(await money(db, buyer.id)).toBe(before - 220 * 4);

    const b = await market.mine(buyer.id);
    expect(b.collect).toEqual({ money: (220 - 180) * 4, items: [{ itemId: ITEM, quantity: 4 }] });
    const s = await market.mine(seller.id);
    expect(s.collect.money).toBe(180 * 4 - marketTax(180 * 4));
    expect(s.orders[0]).toMatchObject({ remaining: 6 });

    await market.collect(buyer.id);
    expect(await qty(db, buyer.id, ITEM)).toBe(4);
    expect(await money(db, buyer.id)).toBe(before - 180 * 4);
    await clean(seller.id, buyer.id);
  });

  it('cancelling returns the unfilled escrow to the collect box', async () => {
    const buyer = await makeCharacter(db);
    const start = await money(db, buyer.id);
    const o = await market.place(buyer.id, { itemId: ITEM, side: 'buy', price: 150, quantity: 5 });
    expect(await money(db, buyer.id)).toBe(start - 750);
    await market.cancel(buyer.id, o.id);
    await expect(market.cancel(buyer.id, o.id)).rejects.toBeInstanceOf(MarketError);
    expect((await market.mine(buyer.id)).collect.money).toBe(750);
    await market.collect(buyer.id);
    expect(await money(db, buyer.id)).toBe(start);
    await clean(buyer.id);
  });

  it('enforces the price band, slots, presence and cover', async () => {
    const p = await makeCharacter(db, { items: { [ITEM]: 20 } });
    await expect(market.place(p.id, { itemId: ITEM, side: 'sell', price: 500, quantity: 1 })).rejects.toMatchObject({ code: 'invalid' });
    await expect(market.place(p.id, { itemId: ITEM, side: 'sell', price: 200, quantity: 21 })).rejects.toMatchObject({ code: 'insufficient' });
    await expect(market.place(p.id, { itemId: 'viila', side: 'sell', price: 1, quantity: 1 })).rejects.toMatchObject({ code: 'invalid' });
    await expect(market.place(p.id, { itemId: 'jokivihrea', side: 'sell', price: 1, quantity: 1 })).rejects.toMatchObject({ code: 'invalid' });
    for (let i = 0; i < 6; i++) await market.place(p.id, { itemId: ITEM, side: 'sell', price: 250 + i, quantity: 1 });
    await expect(market.place(p.id, { itemId: ITEM, side: 'sell', price: 255, quantity: 1 })).rejects.toMatchObject({ code: 'limit' });
    away.add(p.id);
    await expect(market.collect(p.id)).rejects.toMatchObject({ code: 'too_far' });
    away.delete(p.id);
    await clean(p.id);
  });

  it('never matches your own orders', async () => {
    const p = await makeCharacter(db, { items: { [ITEM]: 2 } });
    await market.place(p.id, { itemId: ITEM, side: 'sell', price: 150, quantity: 2 });
    const buy = await market.place(p.id, { itemId: ITEM, side: 'buy', price: 160, quantity: 2 });
    expect(buy.remaining).toBe(2);
  });

  it('idempotency key: the same order sent twice is placed once', async () => {
    const p = await makeCharacter(db);
    const start = await money(db, p.id);
    const [a, b] = await Promise.all([
      market.place(p.id, { itemId: 'maito', side: 'buy', price: 50, quantity: 2, idempotencyKey: 'k1' }),
      market.place(p.id, { itemId: 'maito', side: 'buy', price: 50, quantity: 2, idempotencyKey: 'k1' }),
    ]);
    expect(a.id).toBe(b.id);
    expect(await money(db, p.id)).toBe(start - 100);
    await clean(p.id);
  });

  it('dupe attempt: 20 buyers race for 5 units, exactly 5 change hands', async () => {
    const seller = await makeCharacter(db, { items: { leipa: 5 } });
    await market.place(seller.id, { itemId: 'leipa', side: 'sell', price: 80, quantity: 5 });
    const buyers = await Promise.all(Array.from({ length: 20 }, () => makeCharacter(db)));
    const orders = await Promise.all(buyers.map((b) => market.place(b.id, { itemId: 'leipa', side: 'buy', price: 80, quantity: 1 })));
    expect(orders.filter((o) => o.status === 'filled')).toHaveLength(5);
    const book = await market.book('leipa');
    expect(book.asks).toEqual([]);
    expect(book.bids[0]).toMatchObject({ price: 80, quantity: 15 });
    expect(book.trades.reduce((s, t) => s + t.quantity, 0)).toBe(5);
    await clean(seller.id, ...buyers.map((b) => b.id));
  });

  it('expired orders go back to the collect box', async () => {
    const p = await makeCharacter(db, { items: { omena: 3 } });
    const o = await market.place(p.id, { itemId: 'omena', side: 'sell', price: 20, quantity: 3 });
    await db.query("UPDATE market_orders SET expires_at = now() - interval '1 minute' WHERE id = $1", [o.id]);
    expect(await market.expire()).toBeGreaterThanOrEqual(1);
    expect((await market.mine(p.id)).collect.items).toEqual([{ itemId: 'omena', quantity: 3 }]);
  });

  it('guide price follows trades but at most 5 % per update', async () => {
    await market.updateGuidePrices();
    const g = await market.guide(ITEM);
    expect(g).toBeLessThan(200);
    expect(g).toBeGreaterThanOrEqual(190);
  });

  it('Torikauppias sells at the shop price and buys back at 40 % with a daily cap', async () => {
    const p = await makeCharacter(db);
    const start = await money(db, p.id);
    const lauta = getItem('lauta')!;
    await market.npcBuy(p.id, 'lauta', 3);
    expect(await money(db, p.id)).toBe(start - lauta.npcPriceCents! * 3);
    expect(await qty(db, p.id, 'lauta')).toBe(3);
    const got = await market.npcSell(p.id, 'lauta', 2);
    expect(got).toBe(npcSellPrice(lauta.valueCents) * 2);
    await expect(market.npcBuy(p.id, 'kultaharkko', 1)).rejects.toMatchObject({ code: 'invalid' });
    const rich = await makeCharacter(db, { items: { omena: NPC_SHOP.dailySellCap + 5 } });
    await market.npcSell(rich.id, 'omena', NPC_SHOP.dailySellCap);
    await expect(market.npcSell(rich.id, 'omena', 1)).rejects.toMatchObject({ code: 'limit' });
    await clean(p.id, rich.id);
  });

  it('overview lists every Pörssi item with guide and best prices', async () => {
    const items = await market.overview();
    const leipa = items.find((i) => i.itemId === 'leipa')!;
    expect(leipa).toMatchObject({ bid: 80, ask: null, last: 80, volume24h: 5 });
    expect(items.some((i) => i.itemId === 'jokivihrea')).toBe(false);
  });
});

describe.skipIf(!ok)('Pörssi REST', () => {
  let db: Db;
  let app: App;
  const ORIGIN = 'http://localhost:5173';
  beforeAll(async () => {
    db = await freshDb();
    app = await buildApp({ ...loadConfig({ DATABASE_URL: TEST_DB_URL }), allowedOrigins: [ORIGIN], registerPerHour: 1000 }, db);
  });
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  it('reads work without login, orders need you at the counter', async () => {
    const board = await app.http.inject({ method: 'GET', url: '/api/market' });
    expect(board.statusCode).toBe(200);
    expect(board.json().items.length).toBeGreaterThan(20);
    const anon = await app.http.inject({ method: 'POST', url: '/api/market/orders', headers: { origin: ORIGIN }, payload: { itemId: ITEM, side: 'buy', price: 200, quantity: 1 } });
    expect(anon.statusCode).toBe(401);
    // logged in but not in the world: too far
    await app.http.inject({ method: 'POST', url: '/api/auth/register', headers: { origin: ORIGIN }, payload: { email: 'porssi@example.com', password: 'oikein-hyva-salasana', adult: true } });
    const login = await app.http.inject({ method: 'POST', url: '/api/auth/login', headers: { origin: ORIGIN }, payload: { email: 'porssi@example.com', password: 'oikein-hyva-salasana' } });
    const cookie = String(login.headers['set-cookie']).split(';')[0]!;
    await app.http.inject({ method: 'POST', url: '/api/characters', headers: { origin: ORIGIN, cookie }, payload: { name: 'Porssari', color: '#ffd23f' } });
    const far = await app.http.inject({ method: 'POST', url: '/api/market/orders', headers: { origin: ORIGIN, cookie }, payload: { itemId: ITEM, side: 'buy', price: 200, quantity: 1 } });
    expect(far.statusCode).toBe(409);
    expect(far.json().error).toBe('too_far');
    const me = await app.http.inject({ method: 'GET', url: '/api/market/me', headers: { cookie } });
    expect(me.json()).toMatchObject({ orders: [], here: false, slots: 6 });
  });
});
