import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../src/db/pool';
import { withTx } from '../src/db/pool';
import { auditCharacter, InsufficientError, takeItem, takeMoney } from '../src/economy/ledger';
import { commitTrade } from '../src/trade/commit';
import { buildApp, type App } from '../src/app';
import { loadConfig } from '../src/config';
import { dbAvailable, freshDb, makeCharacter, money, qty, TEST_DB_URL } from './helpers';

const ok = await dbAvailable();
const ORIGIN = 'http://localhost:5173';

describe.skipIf(!ok)('database', () => {
  let db: Db;
  let app: App;

  beforeAll(async () => {
    db = await freshDb();
    app = await buildApp({ ...loadConfig({ DATABASE_URL: TEST_DB_URL }), allowedOrigins: [ORIGIN], registerPerHour: 1000 }, db);
  });
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  describe('auth API', () => {
    const post = (url: string, payload: object, cookie?: string) =>
      app.http.inject({ method: 'POST', url, payload, headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}) } });

    it('registers, logs in, creates a character and reads /api/me', async () => {
      expect((await post('/api/auth/register', { email: 'Testi@Example.com', password: 'Keravan-Juna-2026', adult: true })).statusCode).toBe(201);
      expect((await post('/api/auth/register', { email: 'testi@example.com', password: 'Keravan-Juna-2026', adult: true })).statusCode).toBe(409);
      const login = await post('/api/auth/login', { email: 'testi@example.com', password: 'Keravan-Juna-2026' });
      expect(login.statusCode).toBe(200);
      const setCookie = String(login.headers['set-cookie']);
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/SameSite=Strict/i);
      const cookie = setCookie.split(';')[0]!;

      const created = await post('/api/characters', { name: 'Jönssi', color: '#ff0000' }, cookie);
      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({ name: 'Jönssi', money: 5000, level: 1 });
      expect((await post('/api/characters', { name: 'Toinen', color: '#ff0000' }, cookie)).statusCode).toBe(409);

      const me = await app.http.inject({ method: 'GET', url: '/api/me', headers: { cookie } });
      expect(me.json().characters).toHaveLength(1);
      // The starting money is explained by the ledger.
      expect(await auditCharacter(db, created.json().id)).toEqual([]);

      await post('/api/auth/logout', {}, cookie);
      expect((await app.http.inject({ method: 'GET', url: '/api/me', headers: { cookie } })).statusCode).toBe(401);
    });

    it('requires the 18+ confirmation and a decent password', async () => {
      expect((await post('/api/auth/register', { email: 'nuori@example.com', password: 'Keravan-Juna-2026', adult: false })).statusCode).toBe(400);
      expect((await post('/api/auth/register', { email: 'heikko@example.com', password: 'lyhyt', adult: true })).statusCode).toBe(400);
    });

    it('rejects cross-site requests', async () => {
      const res = await app.http.inject({ method: 'POST', url: '/api/auth/login', payload: {}, headers: { origin: 'https://evil.example' } });
      expect(res.statusCode).toBe(403);
    });

    it('locks login after repeated failures, with the same message as a wrong password', async () => {
      await post('/api/auth/register', { email: 'brute@example.com', password: 'Keravan-Juna-2026', adult: true });
      for (let i = 0; i < 5; i++) {
        const r = await post('/api/auth/login', { email: 'brute@example.com', password: 'vaara-salasana-x' });
        expect(r.statusCode).toBe(401);
      }
      const locked = await post('/api/auth/login', { email: 'brute@example.com', password: 'Keravan-Juna-2026' });
      expect(locked.statusCode).toBe(429);
      const unknown = await post('/api/auth/login', { email: 'eiole@example.com', password: 'Keravan-Juna-2026' });
      expect(unknown.statusCode).toBe(401);
    });
  });

  describe('ledger', () => {
    it('20 parallel spends of the same money: exactly as many succeed as the balance allows', async () => {
      const c = await makeCharacter(db); // 5000 cents
      const results = await Promise.allSettled(
        Array.from({ length: 20 }, () => withTx(db, (tx) => takeMoney(tx, c.id, 1000, 'npc_buy'))),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
      expect(results.filter((r) => r.status === 'rejected' && r.reason instanceof InsufficientError)).toHaveLength(15);
      expect(await money(db, c.id)).toBe(0);
      expect(await auditCharacter(db, c.id)).toEqual([]);
    });

    it('cannot take more items than owned and removes empty stacks', async () => {
      const c = await makeCharacter(db, { items: { perch: 3 } });
      await expect(withTx(db, (tx) => takeItem(tx, c.id, 'perch', 4, 'npc_sell'))).rejects.toBeInstanceOf(InsufficientError);
      await withTx(db, (tx) => takeItem(tx, c.id, 'perch', 3, 'npc_sell'));
      expect(await qty(db, c.id, 'perch')).toBe(0);
      expect(await auditCharacter(db, c.id)).toEqual([]);
    });

    it('audit catches balances changed outside the ledger', async () => {
      const c = await makeCharacter(db);
      await db.query('UPDATE characters SET money = money + 1 WHERE id = $1', [c.id]);
      expect(await auditCharacter(db, c.id)).toEqual([{ kind: 'money', balance: 5001, ledgerSum: 5000 }]);
    });
  });

  describe('trade commit', () => {
    const offerOf = (items: Record<string, number>, money = 0) => ({
      items: Object.entries(items).map(([itemId, quantity]) => ({ itemId, quantity })),
      money,
    });

    it('moves items and money atomically and records the trade', async () => {
      const a = await makeCharacter(db, { items: { perch: 10 } });
      const b = await makeCharacter(db);
      const r = await commitTrade(db, { tradeId: crypto.randomUUID(), a: { id: a.id, offer: offerOf({ perch: 4 }) }, b: { id: b.id, offer: offerOf({}, 1200) }, createdAt: Date.now() });
      expect(r).toEqual({ ok: true });
      expect(await qty(db, a.id, 'perch')).toBe(6);
      expect(await qty(db, b.id, 'perch')).toBe(4);
      expect(await money(db, a.id)).toBe(6200);
      expect(await money(db, b.id)).toBe(3800);
      for (const id of [a.id, b.id]) expect(await auditCharacter(db, id)).toEqual([]);
    });

    it('rolls back everything if one side no longer has the goods', async () => {
      const a = await makeCharacter(db, { items: { perch: 2 } });
      const b = await makeCharacter(db, { items: { coffee: 5 } });
      const r = await commitTrade(db, {
        tradeId: crypto.randomUUID(),
        a: { id: a.id, offer: offerOf({ perch: 2 }) },
        b: { id: b.id, offer: offerOf({ coffee: 6 }) }, // only has 5
        createdAt: Date.now(),
      });
      expect(r).toEqual({ ok: false, reason: 'items_changed' });
      expect(await qty(db, a.id, 'perch')).toBe(2);
      expect(await qty(db, b.id, 'perch')).toBe(0);
      expect(await qty(db, b.id, 'coffee')).toBe(5);
    });

    it('dupe attempt: the same 5 perch offered in two simultaneous trades goes out only once', async () => {
      const a = await makeCharacter(db, { items: { perch: 5 } });
      const b = await makeCharacter(db);
      const c = await makeCharacter(db);
      const [r1, r2] = await Promise.all([
        commitTrade(db, { tradeId: crypto.randomUUID(), a: { id: a.id, offer: offerOf({ perch: 5 }) }, b: { id: b.id, offer: offerOf({}) }, createdAt: Date.now() }),
        commitTrade(db, { tradeId: crypto.randomUUID(), a: { id: a.id, offer: offerOf({ perch: 5 }) }, b: { id: c.id, offer: offerOf({}) }, createdAt: Date.now() }),
      ]);
      expect([r1.ok, r2.ok].filter(Boolean)).toHaveLength(1);
      expect((await qty(db, b.id, 'perch')) + (await qty(db, c.id, 'perch'))).toBe(5);
      expect(await qty(db, a.id, 'perch')).toBe(0);
    });

    it('replaying a committed trade id never applies it twice', async () => {
      const a = await makeCharacter(db, { items: { perch: 10 } });
      const b = await makeCharacter(db);
      const input = { tradeId: crypto.randomUUID(), a: { id: a.id, offer: offerOf({ perch: 1 }) }, b: { id: b.id, offer: offerOf({}) }, createdAt: Date.now() };
      expect((await commitTrade(db, input)).ok).toBe(true);
      expect((await commitTrade(db, input)).ok).toBe(false);
      expect(await qty(db, b.id, 'perch')).toBe(1);
    });

    it('opposite trades between the same two players do not deadlock', async () => {
      const a = await makeCharacter(db, { items: { perch: 50 } });
      const b = await makeCharacter(db, { items: { coffee: 50 } });
      const runs = Array.from({ length: 10 }, (_, i) =>
        i % 2
          ? commitTrade(db, { tradeId: crypto.randomUUID(), a: { id: a.id, offer: offerOf({ perch: 1 }) }, b: { id: b.id, offer: offerOf({ coffee: 1 }) }, createdAt: Date.now() })
          : commitTrade(db, { tradeId: crypto.randomUUID(), a: { id: b.id, offer: offerOf({ coffee: 1 }) }, b: { id: a.id, offer: offerOf({ perch: 1 }) }, createdAt: Date.now() }),
      );
      const results = await Promise.all(runs);
      expect(results.every((r) => r.ok)).toBe(true);
      expect(await qty(db, a.id, 'perch')).toBe(40);
      expect(await qty(db, b.id, 'perch')).toBe(10);
    });

    it('new accounts can give only a limited value per day, but can always receive', async () => {
      const fresh = await makeCharacter(db, { veteran: false, items: { kerava_hoodie: 5 } }); // 60 € each
      const vet = await makeCharacter(db);
      const give = (n: number) =>
        commitTrade(db, { tradeId: crypto.randomUUID(), a: { id: fresh.id, offer: offerOf({ kerava_hoodie: n }) }, b: { id: vet.id, offer: offerOf({}) }, createdAt: Date.now() });
      expect((await give(3)).ok).toBe(true); // 180 €
      expect(await give(1)).toEqual({ ok: false, reason: 'not_allowed' }); // would be 240 € > 200 €
      const receive = await commitTrade(db, { tradeId: crypto.randomUUID(), a: { id: vet.id, offer: offerOf({}, 4000) }, b: { id: fresh.id, offer: offerOf({}) }, createdAt: Date.now() });
      expect(receive.ok).toBe(true);
    });

    it('trade-banned players cannot trade', async () => {
      const a = await makeCharacter(db, { items: { perch: 1 } });
      const b = await makeCharacter(db);
      await db.query(`UPDATE accounts SET status = 'trade_banned' WHERE id = $1`, [a.accountId]);
      const r = await commitTrade(db, { tradeId: crypto.randomUUID(), a: { id: a.id, offer: offerOf({ perch: 1 }) }, b: { id: b.id, offer: offerOf({}) }, createdAt: Date.now() });
      expect(r).toEqual({ ok: false, reason: 'not_allowed' });
    });

    it('street goods raise both players heat', async () => {
      const a = await makeCharacter(db, { items: { street_green: 3 } });
      const b = await makeCharacter(db);
      await commitTrade(db, { tradeId: crypto.randomUUID(), a: { id: a.id, offer: offerOf({ street_green: 3 }) }, b: { id: b.id, offer: offerOf({}, 100) }, createdAt: Date.now() });
      const { rows } = await db.query('SELECT heat FROM characters WHERE id = ANY($1)', [[a.id, b.id]]);
      expect(rows.map((r) => r.heat)).toEqual([8, 8]);
    });
  });
});
