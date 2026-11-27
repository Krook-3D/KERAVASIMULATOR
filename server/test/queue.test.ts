import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import type { AddressInfo } from 'node:net';
import type { Db } from '../src/db/pool';
import { buildApp, type App } from '../src/app';
import { loadConfig } from '../src/config';
import { dbAvailable, freshDb, TEST_DB_URL } from './helpers';
import { Client } from './wsClient';

const ok = await dbAvailable();
const ORIGIN = 'http://localhost:5173';

describe.skipIf(!ok)('world capacity and queue', () => {
  let db: Db;
  let app: App;
  let url: string;

  beforeAll(async () => {
    db = await freshDb();
    app = await buildApp(
      { ...loadConfig({ DATABASE_URL: TEST_DB_URL }), allowedOrigins: [ORIGIN], registerPerHour: 1000, maxPlayers: 2, maxQueue: 1 },
      db,
    );
    await app.http.listen({ port: 0, host: '127.0.0.1' });
    url = `ws://127.0.0.1:${(app.http.server.address() as AddressInfo).port}/ws`;
  });
  afterAll(async () => {
    await app?.close();
    await db?.end();
  });

  async function signup(name: string): Promise<string> {
    const h = { origin: ORIGIN };
    const email = `${name.toLowerCase()}@example.com`;
    await app.http.inject({ method: 'POST', url: '/api/auth/register', headers: h, payload: { email, password: 'Keravan-Juna-2026', adult: true } });
    const login = await app.http.inject({ method: 'POST', url: '/api/auth/login', headers: h, payload: { email, password: 'Keravan-Juna-2026' } });
    const cookie = String(login.headers['set-cookie']).split(';')[0]!;
    await app.http.inject({ method: 'POST', url: '/api/characters', headers: { ...h, cookie }, payload: { name, color: '#3366ff' } });
    return cookie;
  }

  const connect = (cookie: string) =>
    new Promise<Client>((resolve, reject) => {
      const ws = new WebSocket(url, { headers: { cookie, origin: ORIGIN } });
      const c = new Client(ws);
      ws.once('open', () => resolve(c));
      ws.once('unexpected-response', (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)));
    });

  it('admits up to the cap, queues the next, refuses when the queue is full, and lets the queue in', async () => {
    const cookies = await Promise.all(['Eka', 'Toka', 'Kolmas', 'Neljas'].map(signup));
    const p1 = await connect(cookies[0]!);
    expect((await p1.next('welcome')).world).toEqual({ name: 'Kerava 1', online: 1, capacity: 2, queued: 0 });
    const p2 = await connect(cookies[1]!);
    await p2.next('welcome');

    const p3 = await connect(cookies[2]!);
    expect(await p3.next('queue')).toMatchObject({ position: 1, world: { online: 2, capacity: 2 } });
    // Queued players cannot act in the world.
    p3.send({ t: 'chat', text: 'päästäkää sisään' });
    expect((await p3.next('error')).code).toBe('not_allowed');

    await expect(connect(cookies[3]!)).rejects.toThrow('HTTP 503');
    expect((await app.http.inject({ method: 'GET', url: '/api/worlds' })).json()).toEqual({
      worlds: [{ name: 'Kerava 1', online: 2, capacity: 2, queued: 1 }],
    });

    p1.close();
    const welcome = await p3.next('welcome');
    expect(welcome.world.online).toBe(2);
    expect(app.world.size).toBe(2);
    p2.close();
    p3.close();
  });

  it('a reconnect of an online character keeps its slot instead of queueing', async () => {
    const cookies = await Promise.all(['Viides', 'Kuudes'].map(signup));
    const a = await connect(cookies[0]!);
    await a.next('welcome');
    const b = await connect(cookies[1]!);
    await b.next('welcome');
    const a2 = await connect(cookies[0]!);
    expect((await a.next('kicked')).reason).toBe('logged_in_elsewhere');
    await a2.next('welcome');
    expect(app.world.size).toBe(2);
    a2.close();
    b.close();
  });
});
