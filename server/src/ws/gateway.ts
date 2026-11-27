/**
 * WebSocket gateway: authenticates the upgrade, owns one connection per
 * character, validates and rate-limits every message, and dispatches it to
 * the world and trade modules.
 */
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket, type RawData } from 'ws';
import { PROTOCOL_VERSION, type ClientMessage, type ErrorCode, type ServerMessage } from '../../../shared/protocol';
import type { AuthService, Account } from '../auth/service';
import { SESSION_COOKIE } from '../auth/tokens';
import type { CharacterService } from '../characters/service';
import type { World } from '../presence/world';
import { TradeError, type TradeManager } from '../trade/manager';
import { ConnectionLimiter } from './rateLimit';
import { clientMessageSchema, cleanChat, MAX_MESSAGE_BYTES } from './schemas';

export const TICK_MS = 100;
const HEARTBEAT_MS = 15_000;
const MAX_VIOLATIONS = 50;
const MAX_BAD_MESSAGES = 10;

interface Conn {
  ws: WebSocket;
  account: Account;
  characterId: string;
  limiter: ConnectionLimiter;
  badMessages: number;
  alive: boolean;
  connectedAt: number;
  lastChat?: string;
}

export interface GatewayDeps {
  auth: AuthService;
  characters: CharacterService;
  world: World;
  trades: TradeManager;
  allowedOrigins: string[];
  log?: (msg: string, extra?: unknown) => void;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export class Gateway {
  private wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  private conns = new Map<string, Conn>();
  private tickTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(private deps: GatewayDeps) {}

  start(): void {
    this.tickTimer = setInterval(() => {
      this.deps.world.tick();
      this.deps.trades.sweep();
    }, TICK_MS);
    this.heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
  }

  async stop(): Promise<void> {
    clearInterval(this.tickTimer);
    clearInterval(this.heartbeatTimer);
    this.deps.trades.cancelAll('server_shutdown');
    await Promise.all([...this.conns.values()].map((c) => this.disconnect(c, 1001, 'server shutdown')));
    this.wss.close();
  }

  get online(): number {
    return this.conns.size;
  }

  canTrade(characterId: string): boolean {
    const c = this.conns.get(characterId);
    return !!c && c.account.status !== 'trade_banned' && c.account.status !== 'banned';
  }

  /** Hook for node's http 'upgrade' event. */
  async handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    const reject = (code: number, text: string) => {
      socket.write(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\n\r\n`);
      socket.destroy();
    };
    try {
      const origin = req.headers.origin;
      if (!origin || !this.deps.allowedOrigins.includes(origin)) return reject(403, 'Forbidden');
      const account = await this.deps.auth.authenticate(parseCookies(req.headers.cookie)[SESSION_COOKIE]);
      if (!account) return reject(401, 'Unauthorized');
      const url = new URL(req.url ?? '/', 'http://localhost');
      const wanted = url.searchParams.get('character');
      const chars = await this.deps.characters.listForAccount(account.id);
      const character = wanted ? chars.find((c) => c.id === wanted) : chars[0];
      if (!character) return reject(404, 'Not Found');
      this.wss.handleUpgrade(req, socket, head, (ws) => this.onConnect(ws, account, character));
    } catch (err) {
      this.deps.log?.('upgrade failed', err);
      reject(500, 'Internal Server Error');
    }
  }

  private async onConnect(ws: WebSocket, account: Account, character: Awaited<ReturnType<CharacterService['get']>> & {}): Promise<void> {
    // One connection per character: a new login replaces the old one.
    const previous = this.conns.get(character.id);
    if (previous) {
      this.send(previous, { t: 'kicked', reason: 'logged_in_elsewhere' });
      await this.disconnect(previous, 4001, 'logged in elsewhere');
    }
    const conn: Conn = { ws, account, characterId: character.id, limiter: new ConnectionLimiter(), badMessages: 0, alive: true, connectedAt: Date.now() };
    this.conns.set(character.id, conn);

    const player = this.deps.world.join({
      id: character.id,
      name: character.name,
      color: character.color,
      level: character.level,
      x: character.x,
      z: character.z,
      anim: 'idle',
      send: (msg) => this.send(conn, msg),
    });
    this.send(conn, { t: 'welcome', protocol: PROTOCOL_VERSION, you: this.deps.world.publicOf(player), tickRate: 1000 / TICK_MS });

    ws.on('pong', () => (conn.alive = true));
    ws.on('message', (data, isBinary) => void this.onMessage(conn, data, isBinary));
    ws.on('close', () => void this.cleanup(conn));
    ws.on('error', () => ws.terminate());
  }

  private async onMessage(conn: Conn, data: RawData, isBinary: boolean): Promise<void> {
    if (this.conns.get(conn.characterId) !== conn) return;
    let msg: ClientMessage;
    try {
      if (isBinary) throw new Error('binary');
      const parsed = clientMessageSchema.safeParse(JSON.parse(data.toString()));
      if (!parsed.success) throw new Error('schema');
      msg = parsed.data;
    } catch {
      this.error(conn, 'bad_message', 'Virheellinen viesti.');
      if (++conn.badMessages > MAX_BAD_MESSAGES) this.abuse(conn);
      return;
    }
    const rid = 'rid' in msg ? msg.rid : undefined;
    if (!conn.limiter.allow(msg.t)) {
      if (conn.limiter.violations > MAX_VIOLATIONS) return this.abuse(conn);
      return this.error(conn, 'rate_limited', 'Liian nopeasti.', rid);
    }
    try {
      await this.dispatch(conn, msg);
      if (rid) this.send(conn, { t: 'ok', rid });
    } catch (err) {
      if (err instanceof TradeError) return this.error(conn, err.code, err.message, rid);
      this.deps.log?.('message failed', err);
      this.error(conn, 'internal', 'Palvelinvirhe.', rid);
    }
  }

  private async dispatch(conn: Conn, msg: ClientMessage): Promise<void> {
    const id = conn.characterId;
    const { world, trades } = this.deps;
    switch (msg.t) {
      case 'ping':
        return this.send(conn, { t: 'pong', now: Date.now() });
      case 'move':
        world.move(id, msg);
        return;
      case 'chat': {
        if (conn.account.status === 'muted') throw new TradeError('not_allowed', 'Sinut on mykistetty.');
        const text = cleanChat(msg.text);
        if (!text || text === conn.lastChat) return;
        conn.lastChat = text;
        world.chat(id, text);
        return;
      }
      case 'trade.request':
        trades.request(id, msg.targetId);
        return;
      case 'trade.respond':
        return trades.respond(id, msg.tradeId, msg.accept);
      case 'trade.offer':
        return trades.offer(id, msg.tradeId, msg.offer);
      case 'trade.accept':
        return trades.accept(id, msg.tradeId, msg.stage);
      case 'trade.cancel':
        return trades.cancel(id, msg.tradeId);
    }
  }

  private heartbeat(): void {
    for (const conn of this.conns.values()) {
      if (!conn.alive) {
        conn.ws.terminate();
        continue;
      }
      conn.alive = false;
      conn.ws.ping();
    }
  }

  private abuse(conn: Conn): void {
    this.deps.log?.('protocol abuse', { characterId: conn.characterId });
    this.send(conn, { t: 'kicked', reason: 'protocol_abuse' });
    void this.disconnect(conn, 4002, 'protocol abuse');
  }

  private async disconnect(conn: Conn, code: number, reason: string): Promise<void> {
    conn.ws.close(code, reason);
    await this.cleanup(conn);
  }

  private async cleanup(conn: Conn): Promise<void> {
    if (this.conns.get(conn.characterId) !== conn) return;
    this.conns.delete(conn.characterId);
    this.deps.trades.playerLeft(conn.characterId);
    const player = this.deps.world.leave(conn.characterId);
    if (player) {
      await this.deps.characters
        .savePresence(conn.characterId, player.x, player.z, (Date.now() - conn.connectedAt) / 1000)
        .catch((err) => this.deps.log?.('save presence failed', err));
    }
  }

  private send(conn: Conn, msg: ServerMessage): void {
    if (conn.ws.readyState === conn.ws.OPEN) conn.ws.send(JSON.stringify(msg));
  }

  private error(conn: Conn, code: ErrorCode, message: string, rid?: string): void {
    this.send(conn, { t: 'error', code, message, rid });
  }
}
