import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { Client } from './wsClient';
import type { AddressInfo } from 'node:net';
import type { Db } from '../src/db/pool';
import { buildApp, type App } from '../src/app';
import { loadConfig } from '../src/config';
import { dbAvailable, freshDb, qty, money, TEST_DB_URL } from './helpers';
import { withTx } from '../src/db/pool';
import { addItem } from '../src/economy/ledger';
import { TRADE } from '../../shared/economy';

const ok = await dbAvailable();
const ORIGIN = 'http://localhost:5173';

describe.skipIf(!ok)('websocket gateway (end to end)', () => {
  let db: Db;
  let app: App;
  let url: string;

  beforeAll(async () => {
    db = await freshDb();
    app = await buildApp({ ...loadConfig({ DATABASE_URL: TEST_DB_URL }), allowedOrigins: [ORIGIN], registerPerHour: 1000 }, db);
    app.gateway.start();
    await app.http.listen({ port: 0, host: '127.0.0.1' });
    url = `ws://127.0.0.1:${(app.http.server.address() as AddressInfo).port}/ws`;
  });
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  async function signup(name: string): Promise<{ cookie: string; id: string }> {
    const email = `${name.toLowerCase()}@example.com`;
    const h = { origin: ORIGIN };
    await app.http.inject({ method: 'POST', url: '/api/auth/register', headers: h, payload: { email, password: 'Keravan-Juna-2026', adult: true } });
    const login = await app.http.inject({ method: 'POST', url: '/api/auth/login', headers: h, payload: { email, password: 'Keravan-Juna-2026' } });
    const cookie = String(login.headers['set-cookie']).split(';')[0]!;
    const c = await app.http.inject({ method: 'POST', url: '/api/characters', headers: { ...h, cookie }, payload: { name, color: '#3366ff' } });
    const id = c.json().id as string;
    await db.query('UPDATE characters SET xp = 1000, play_seconds = 100000 WHERE id = $1', [id]);
    return { cookie, id };
  }

  function connect(cookie: string, origin = ORIGIN): Promise<Client> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, { headers: { cookie, origin } });
      const client = new Client(ws);
      ws.once('open', () => resolve(client));
      ws.once('unexpected-response', (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)));
      ws.once('error', reject);
    });
  }

  it('refuses unauthenticated and cross-origin connections', async () => {
    await expect(connect('ks_session=nope')).rejects.toThrow('HTTP 401');
    const { cookie } = await signup('Ulkopuoli');
    await expect(connect(cookie, 'https://evil.example')).rejects.toThrow('HTTP 403');
  });

  it('players see each other, move, chat, and trade with double confirmation', async () => {
    const alice = await signup('Aliisa');
    const bob = await signup('Pertti');
    await withTx(db, (tx) => addItem(tx, alice.id, 'kahvi', 10, 'admin_restore'));

    const a = await connect(alice.cookie);
    const welcomeA = await a.next('welcome');
    expect(welcomeA.you).toMatchObject({ id: alice.id, name: 'Aliisa' });
    const b = await connect(bob.cookie);
    expect((await b.next('snapshot')).players.map((p) => p.id)).toContain(alice.id);
    await a.next('player.join', (m) => m.player.id === bob.id);

    await new Promise((r) => setTimeout(r, 300)); // walk for a moment (speed check)
    a.send({ t: 'move', x: 2, z: 1, anim: 'walk' });
    const move = await b.next('player.move');
    expect(move.moves[0]).toMatchObject({ id: alice.id, x: 2, z: 1 });

    a.send({ t: 'chat', text: 'Moi Pertti, ahvenia?' });
    expect((await b.next('chat')).text).toBe('Moi Pertti, ahvenia?');

    // Trade: request → accept → offers → accept → confirm (after delay) → commit.
    a.send({ t: 'trade.request', targetId: bob.id });
    const req = await b.next('trade.requested');
    b.send({ t: 'trade.respond', tradeId: req.tradeId, accept: true });
    await a.next('trade.update');
    await b.next('trade.update');

    a.send({ t: 'trade.offer', tradeId: req.tradeId, offer: { items: [{ itemId: 'kahvi', quantity: 4 }], money: 0 } });
    expect((await b.next('trade.update', (m) => m.trade.them.offer.items.length > 0)).trade.changed).toEqual(['kahvi']);
    b.send({ t: 'trade.offer', tradeId: req.tradeId, offer: { items: [], money: 2000 } });
    await a.next('trade.update', (m) => m.trade.them.offer.money === 2000);

    // Offering more than you own is refused up front.
    b.send({ t: 'trade.offer', tradeId: req.tradeId, offer: { items: [], money: 999_999 }, rid: 'r1' });
    expect(await b.next('error', (m) => m.rid === 'r1')).toMatchObject({ code: 'insufficient' });

    a.send({ t: 'trade.accept', tradeId: req.tradeId, stage: 'offer' });
    b.send({ t: 'trade.accept', tradeId: req.tradeId, stage: 'offer' });
    const confirm = await a.next('trade.update', (m) => m.trade.stage === 'confirm');
    expect(confirm.trade.you.offer.items).toEqual([{ itemId: 'kahvi', quantity: 4 }]);

    // Too early: refused (anti-misclick delay).
    a.send({ t: 'trade.accept', tradeId: req.tradeId, stage: 'confirm', rid: 'early' });
    expect(await a.next('error', (m) => m.rid === 'early')).toMatchObject({ code: 'not_allowed' });

    await new Promise((r) => setTimeout(r, TRADE.confirmDelayMs + 50));
    a.send({ t: 'trade.accept', tradeId: req.tradeId, stage: 'confirm' });
    b.send({ t: 'trade.accept', tradeId: req.tradeId, stage: 'confirm' });
    const doneA = await a.next('trade.completed');
    expect(doneA.received.money).toBe(2000);
    await b.next('trade.completed');

    expect(await qty(db, bob.id, 'kahvi')).toBe(4);
    expect(await money(db, alice.id)).toBe(7000);
    expect(await money(db, bob.id)).toBe(3000);

    a.close();
    await b.next('player.leave', (m) => m.id === alice.id);
    b.close();
  }, 15_000);

  it('a trade is cancelled when a party disconnects or walks away', async () => {
    const p1 = await signup('Kalle');
    const p2 = await signup('Ville');
    const c1 = await connect(p1.cookie);
    const c2 = await connect(p2.cookie);
    await c1.next('welcome');
    await c2.next('welcome');
    c1.send({ t: 'trade.request', targetId: p2.id });
    const req = await c2.next('trade.requested');
    c2.send({ t: 'trade.respond', tradeId: req.tradeId, accept: true });
    await c1.next('trade.update');
    c1.close();
    expect((await c2.next('trade.cancelled')).reason).toBe('disconnected');
    c2.close();
  });

  it('a second login kicks the first connection (no two-tab dupes)', async () => {
    const p = await signup('Tuplis');
    const first = await connect(p.cookie);
    await first.next('welcome');
    const second = await connect(p.cookie);
    expect((await first.next('kicked')).reason).toBe('logged_in_elsewhere');
    await second.next('welcome');
    expect(app.world.players.has(p.id)).toBe(true);
    second.close();
  });

  it('answers bad messages with errors and rate limits floods', async () => {
    const p = await signup('Spammaaja');
    const c = await connect(p.cookie);
    await c.next('welcome');
    c.send({ t: 'give.money', amount: 1_000_000 });
    expect((await c.next('error')).code).toBe('bad_message');
    for (let i = 0; i < 8; i++) c.send({ t: 'chat', text: `viesti ${i}` });
    expect((await c.next('error', (m) => m.code === 'rate_limited')).code).toBe('rate_limited');
    c.close();
  });
});
