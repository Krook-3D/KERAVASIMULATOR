/**
 * Runs live trades: requests, offers, acceptance and the final commit.
 * In-memory state is only a promise; the commit is the single source of truth.
 */
import { randomUUID } from 'node:crypto';
import type { TradeCancelReason, TradeOffer, TradeStage } from '../../../shared/protocol';
import { TRADE } from '../../../shared/economy';
import type { Db } from '../db/pool';
import type { World } from '../presence/world';
import { commitTrade, ownsOffer } from './commit';
import { normaliseOffer, TradeRuleError, TradeSession } from './session';

export class TradeError extends Error {
  constructor(
    public code: 'not_found' | 'not_allowed' | 'busy' | 'too_far' | 'invalid_offer' | 'insufficient',
    message: string,
  ) {
    super(message);
  }
}

export interface TradeManagerDeps {
  db: Db;
  world: World;
  now?: () => number;
  /** Whether this player may trade right now (account status, jail, duel...). */
  canTrade?: (playerId: string) => boolean;
  /** Overridable for tests. */
  commit?: typeof commitTrade;
  owns?: (characterId: string, offer: TradeOffer) => Promise<boolean>;
}

export class TradeManager {
  private trades = new Map<string, TradeSession>();
  private byPlayer = new Map<string, string>();
  private now: () => number;
  private commit: typeof commitTrade;
  private owns: (characterId: string, offer: TradeOffer) => Promise<boolean>;

  constructor(private deps: TradeManagerDeps) {
    this.now = deps.now ?? Date.now;
    this.commit = deps.commit ?? commitTrade;
    this.owns = deps.owns ?? ((id, offer) => ownsOffer(deps.db, id, offer));
  }

  tradeOf(playerId: string): TradeSession | undefined {
    const id = this.byPlayer.get(playerId);
    return id ? this.trades.get(id) : undefined;
  }

  request(fromId: string, targetId: string): TradeSession {
    const { world } = this.deps;
    const from = world.players.get(fromId);
    const target = world.players.get(targetId);
    if (!from || !target || fromId === targetId) throw new TradeError('not_found', 'Pelaajaa ei löydy.');
    if (this.byPlayer.has(fromId)) throw new TradeError('busy', 'Sinulla on jo kauppa kesken.');
    if (this.byPlayer.has(targetId)) throw new TradeError('busy', `${target.name} on jo kaupoilla.`);
    if (!this.allowed(fromId) || !this.allowed(targetId)) throw new TradeError('not_allowed', 'Kauppa ei ole nyt mahdollinen.');
    if (world.distance(fromId, targetId) > TRADE.maxDistanceM) throw new TradeError('too_far', 'Mene lähemmäs.');
    const session = new TradeSession(randomUUID(), { id: fromId, name: from.name }, { id: targetId, name: target.name }, this.now());
    this.trades.set(session.id, session);
    this.byPlayer.set(fromId, session.id);
    this.byPlayer.set(targetId, session.id);
    target.send({ t: 'trade.requested', tradeId: session.id, fromId, name: from.name });
    return session;
  }

  respond(playerId: string, tradeId: string, accept: boolean): void {
    const s = this.get(playerId, tradeId);
    if (s.b.id !== playerId || s.status !== 'pending') throw new TradeError('not_allowed', 'Ei vastattavaa pyyntöä.');
    if (!accept) return this.end(s, 'declined');
    if (this.deps.world.distance(s.a.id, s.b.id) > TRADE.maxDistanceM) return this.end(s, 'too_far');
    s.open();
    this.pushUpdate(s);
  }

  async offer(playerId: string, tradeId: string, offer: TradeOffer): Promise<void> {
    const s = this.get(playerId, tradeId);
    const side = s.sideOf(playerId)!;
    let normal: TradeOffer;
    try {
      normal = normaliseOffer(offer);
    } catch (err) {
      throw this.wrap(err);
    }
    if (s.status !== 'open' || s.stage !== 'offer') throw new TradeError('not_allowed', 'Tarjousta ei voi enää muuttaa.');
    if (!(await this.owns(playerId, normal))) throw new TradeError('insufficient', 'Sinulla ei ole näitä tavaroita.');
    // The trade may have changed while we awaited the database.
    if (this.trades.get(tradeId) !== s) throw new TradeError('not_found', 'Kauppa päättyi.');
    try {
      s.setOffer(side, normal);
    } catch (err) {
      throw this.wrap(err);
    }
    this.pushUpdate(s);
  }

  async accept(playerId: string, tradeId: string, stage: TradeStage): Promise<void> {
    const s = this.get(playerId, tradeId);
    if (this.deps.world.distance(s.a.id, s.b.id) > TRADE.maxDistanceM) return this.end(s, 'too_far');
    let result: ReturnType<TradeSession['accept']>;
    try {
      result = s.accept(s.sideOf(playerId)!, stage, this.now());
    } catch (err) {
      throw this.wrap(err);
    }
    if (result !== 'commit') return this.pushUpdate(s);

    const outcome = await this.commit(this.deps.db, {
      tradeId: s.id,
      a: { id: s.a.id, offer: s.offers.a },
      b: { id: s.b.id, offer: s.offers.b },
      createdAt: s.createdAt,
    });
    if (!outcome.ok) return this.end(s, outcome.reason);
    s.status = 'done';
    this.forget(s);
    const { world } = this.deps;
    world.players.get(s.a.id)?.send({ t: 'trade.completed', tradeId: s.id, gave: s.offers.a, received: s.offers.b });
    world.players.get(s.b.id)?.send({ t: 'trade.completed', tradeId: s.id, gave: s.offers.b, received: s.offers.a });
  }

  cancel(playerId: string, tradeId: string): void {
    const s = this.get(playerId, tradeId);
    if (s.status === 'committing') throw new TradeError('busy', 'Kauppaa viimeistellään.');
    this.end(s, 'cancelled');
  }

  /** Player went offline: cancel anything they were part of (unless already committing). */
  playerLeft(playerId: string): void {
    const s = this.tradeOf(playerId);
    if (s && s.status !== 'committing') this.end(s, 'disconnected');
  }

  /** Periodic check for timeouts and players who walked away. */
  sweep(): void {
    const now = this.now();
    for (const s of this.trades.values()) {
      if (s.status === 'committing') continue;
      if (s.isExpired(now)) this.end(s, 'timeout');
      else if (s.status === 'open' && this.deps.world.distance(s.a.id, s.b.id) > TRADE.maxDistanceM) this.end(s, 'too_far');
    }
  }

  cancelAll(reason: TradeCancelReason): void {
    for (const s of [...this.trades.values()]) if (s.status !== 'committing') this.end(s, reason);
  }

  get openCount(): number {
    return this.trades.size;
  }

  private allowed(playerId: string): boolean {
    return this.deps.canTrade?.(playerId) ?? true;
  }

  private get(playerId: string, tradeId: string): TradeSession {
    const s = this.trades.get(tradeId);
    if (!s || !s.sideOf(playerId)) throw new TradeError('not_found', 'Kauppaa ei löydy.');
    return s;
  }

  private pushUpdate(s: TradeSession): void {
    for (const p of [s.a, s.b]) this.deps.world.players.get(p.id)?.send({ t: 'trade.update', trade: s.viewFor(p.id) });
  }

  private end(s: TradeSession, reason: TradeCancelReason): void {
    this.forget(s);
    for (const p of [s.a, s.b]) this.deps.world.players.get(p.id)?.send({ t: 'trade.cancelled', tradeId: s.id, reason });
  }

  private forget(s: TradeSession): void {
    this.trades.delete(s.id);
    if (this.byPlayer.get(s.a.id) === s.id) this.byPlayer.delete(s.a.id);
    if (this.byPlayer.get(s.b.id) === s.id) this.byPlayer.delete(s.b.id);
  }

  private wrap(err: unknown): TradeError {
    if (err instanceof TradeRuleError) return new TradeError(err.code, err.message);
    throw err;
  }
}
