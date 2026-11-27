/**
 * Builds the HTTP app and wires modules together. index.ts only starts it.
 */
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import { z } from 'zod';
import type { Config } from './config';
import type { Db } from './db/pool';
import { AuthError, AuthService, type Account } from './auth/service';
import { SESSION_COOKIE } from './auth/tokens';
import { CharacterError, CharacterService } from './characters/service';
import { World } from './presence/world';
import { TradeManager } from './trade/manager';
import { Gateway } from './ws/gateway';
import { TokenBucket } from './ws/rateLimit';

export interface App {
  http: FastifyInstance;
  gateway: Gateway;
  world: World;
  trades: TradeManager;
  auth: AuthService;
  characters: CharacterService;
  close(): Promise<void>;
}

declare module 'fastify' {
  interface FastifyRequest {
    account?: Account;
  }
}

const registerBody = z.object({ email: z.string().max(254), password: z.string().max(200), adult: z.boolean() });
const loginBody = z.object({ email: z.string().max(254), password: z.string().max(200) });
const characterBody = z.object({ name: z.string().max(40), color: z.string().max(7) });

/** Simple per-key limiter for REST endpoints (single process). */
function keyedLimiter(rate: number, burst: number) {
  const buckets = new Map<string, TokenBucket>();
  return (key: string): boolean => {
    let b = buckets.get(key);
    if (!b) {
      if (buckets.size > 50_000) buckets.clear();
      buckets.set(key, (b = new TokenBucket(rate, burst)));
    }
    return b.take();
  };
}

export async function buildApp(config: Config, db: Db): Promise<App> {
  const http = Fastify({ logger: false, bodyLimit: 16 * 1024, trustProxy: true });
  await http.register(cookie);

  const auth = new AuthService(db, { sessionTtlMs: config.sessionTtlMs, termsVersion: config.termsVersion });
  const characters = new CharacterService(db, config.maxCharacters);
  const world = new World('Kerava 1', undefined, (id, reason) => http.log.warn({ id, reason }, 'player flagged'));
  // Gateway is created below; trade permission checks go through it.
  let gateway: Gateway;
  const trades = new TradeManager({ db, world, canTrade: (id) => gateway.canTrade(id) });
  gateway = new Gateway({ auth, characters, world, trades, allowedOrigins: config.allowedOrigins, log: (m, e) => http.log.error({ err: e }, m) });

  const registerLimit = keyedLimiter(config.registerPerHour / 3600, config.registerPerHour);

  // CSRF: state-changing requests must come from an allowed origin (cookies are SameSite=Strict too).
  http.addHook('onRequest', async (req, reply) => {
    if (req.method === 'GET' || req.method === 'HEAD') return;
    const origin = req.headers.origin;
    if (!origin || !config.allowedOrigins.includes(origin)) return reply.code(403).send({ error: 'forbidden_origin' });
  });

  const requireAccount = async (req: FastifyRequest, reply: FastifyReply) => {
    const account = await auth.authenticate(req.cookies[SESSION_COOKIE]);
    if (!account) return reply.code(401).send({ error: 'unauthorized' });
    req.account = account;
  };

  http.setErrorHandler((err, _req, reply) => {
    if (err instanceof z.ZodError) return reply.code(400).send({ error: 'bad_request' });
    if (err instanceof AuthError) {
      const status = { invalid: 400, taken: 409, rate_limited: 429, banned: 403, weak_password: 400, not_adult: 400 }[err.code];
      return reply.code(err.code === 'invalid' && _req.url.endsWith('/login') ? 401 : status).send({ error: err.code, message: err.message });
    }
    if (err instanceof CharacterError) {
      return reply.code(err.code === 'name_taken' || err.code === 'limit' ? 409 : 400).send({ error: err.code, message: err.message });
    }
    if ((err as { statusCode?: number }).statusCode && (err as { statusCode: number }).statusCode < 500) {
      return reply.code((err as { statusCode: number }).statusCode).send({ error: 'bad_request' });
    }
    http.log.error(err);
    return reply.code(500).send({ error: 'internal' });
  });

  http.get('/api/health', async () => ({ ok: true, online: gateway.online, trades: trades.openCount }));

  http.post('/api/auth/register', async (req, reply) => {
    if (!registerLimit(req.ip)) return reply.code(429).send({ error: 'rate_limited' });
    const body = registerBody.parse(req.body);
    const account = await auth.register(body);
    return reply.code(201).send({ id: account.id });
  });

  http.post('/api/auth/login', async (req, reply) => {
    const body = loginBody.parse(req.body);
    const { token } = await auth.login({ ...body, ip: req.ip, userAgent: req.headers['user-agent'] });
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: 'strict',
      path: '/',
      maxAge: Math.floor(config.sessionTtlMs / 1000),
    });
    return { ok: true };
  });

  http.post('/api/auth/logout', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await auth.logout(token);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  http.get('/api/me', { preHandler: requireAccount }, async (req) => {
    const account = req.account!;
    const chars = await characters.listForAccount(account.id);
    return { account: { id: account.id, email: account.email, status: account.status }, characters: chars };
  });

  http.post('/api/characters', { preHandler: requireAccount }, async (req, reply) => {
    const body = characterBody.parse(req.body);
    const character = await characters.create(req.account!.id, body);
    return reply.code(201).send(character);
  });

  http.get<{ Params: { id: string } }>('/api/characters/:id/inventory', { preHandler: requireAccount }, async (req, reply) => {
    const owned = await characters.listForAccount(req.account!.id);
    if (!owned.some((c) => c.id === req.params.id)) return reply.code(404).send({ error: 'not_found' });
    return { items: await characters.inventory(req.params.id) };
  });

  http.server.on('upgrade', (req, socket, head) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/ws') return socket.destroy();
    void gateway.handleUpgrade(req, socket, head);
  });

  return {
    http,
    gateway,
    world,
    trades,
    auth,
    characters,
    async close() {
      await gateway.stop();
      await http.close();
    },
  };
}
