/**
 * Player-to-player trade state machine (pure, no I/O).
 *
 *   pending ──respond(accept)──▶ open/offer ──both accept──▶ open/confirm ──both confirm──▶ committing ──▶ done
 *      │                             │  any offer change resets both accepts      │
 *      └──────── cancel / timeout / too far / disconnect at any point ─────────────┘
 *
 * See docs/MULTIPLAYER.md section 9.
 */
import type { TradeItem, TradeOffer, TradeStage, TradeView } from '../../../shared/protocol';
import { TRADE } from '../../../shared/economy';
import { canPlayerTrade } from '../../../shared/items';

export type TradeStatus = 'pending' | 'open' | 'committing' | 'done';
export type Side = 'a' | 'b';

export interface Party {
  id: string;
  name: string;
}

export class TradeRuleError extends Error {
  constructor(
    public code: 'invalid_offer' | 'not_allowed',
    message: string,
  ) {
    super(message);
  }
}

export const emptyOffer = (): TradeOffer => ({ items: [], money: 0 });

/** Validates shape and tradeability; ownership is checked against the database. */
export function normaliseOffer(offer: TradeOffer): TradeOffer {
  if (!Number.isSafeInteger(offer.money) || offer.money < 0) throw new TradeRuleError('invalid_offer', 'Virheellinen rahamäärä.');
  if (offer.items.length > TRADE.maxOfferSlots) throw new TradeRuleError('invalid_offer', 'Liian monta tavaraa.');
  const merged = new Map<string, number>();
  for (const it of offer.items) {
    if (!Number.isSafeInteger(it.quantity) || it.quantity <= 0) throw new TradeRuleError('invalid_offer', 'Virheellinen määrä.');
    if (!canPlayerTrade(it.itemId)) throw new TradeRuleError('not_allowed', 'Tätä tavaraa ei voi vaihtaa.');
    merged.set(it.itemId, (merged.get(it.itemId) ?? 0) + it.quantity);
  }
  const items: TradeItem[] = [...merged].sort(([a], [b]) => a.localeCompare(b)).map(([itemId, quantity]) => ({ itemId, quantity }));
  return { items, money: offer.money };
}

/** Item ids (and 'money') whose amount differs between two offers. */
export function offerDiff(before: TradeOffer, after: TradeOffer): string[] {
  const changed: string[] = [];
  const ids = new Set([...before.items, ...after.items].map((i) => i.itemId));
  const qty = (o: TradeOffer, id: string) => o.items.find((i) => i.itemId === id)?.quantity ?? 0;
  for (const id of ids) if (qty(before, id) !== qty(after, id)) changed.push(id);
  if (before.money !== after.money) changed.push('money');
  return changed;
}

export class TradeSession {
  status: TradeStatus = 'pending';
  stage: TradeStage = 'offer';
  offers: Record<Side, TradeOffer> = { a: emptyOffer(), b: emptyOffer() };
  accepted: Record<Side, boolean> = { a: false, b: false };
  confirmableAt?: number;
  lastChanged: string[] = [];

  constructor(
    readonly id: string,
    readonly a: Party,
    readonly b: Party,
    readonly createdAt: number,
  ) {}

  sideOf(playerId: string): Side | null {
    if (playerId === this.a.id) return 'a';
    if (playerId === this.b.id) return 'b';
    return null;
  }

  other(side: Side): Party {
    return side === 'a' ? this.b : this.a;
  }

  open(): void {
    if (this.status !== 'pending') throw new TradeRuleError('not_allowed', 'Kauppa ei odota vastausta.');
    this.status = 'open';
  }

  setOffer(side: Side, offer: TradeOffer): string[] {
    if (this.status !== 'open' || this.stage !== 'offer') throw new TradeRuleError('not_allowed', 'Tarjousta ei voi enää muuttaa.');
    const next = normaliseOffer(offer);
    const changed = offerDiff(this.offers[side], next);
    if (changed.length === 0) return changed;
    this.offers[side] = next;
    // Any change invalidates both acceptances (anti-scam).
    this.accepted = { a: false, b: false };
    this.lastChanged = changed;
    return changed;
  }

  /** Returns 'commit' when both parties have confirmed the final screen. */
  accept(side: Side, stage: TradeStage, now: number): 'waiting' | 'confirm' | 'commit' {
    if (this.status !== 'open') throw new TradeRuleError('not_allowed', 'Kauppa ei ole auki.');
    // Stage must match what the client saw, so an accept cannot land on a newer screen.
    if (stage !== this.stage) throw new TradeRuleError('not_allowed', 'Kaupan vaihe muuttui.');
    if (stage === 'confirm' && this.confirmableAt !== undefined && now < this.confirmableAt) {
      throw new TradeRuleError('not_allowed', 'Tarkista kauppa ennen vahvistamista.');
    }
    if (stage === 'offer' && this.offers.a.items.length + this.offers.b.items.length === 0 && this.offers.a.money + this.offers.b.money === 0) {
      throw new TradeRuleError('invalid_offer', 'Kauppa on tyhjä.');
    }
    this.accepted[side] = true;
    if (!this.accepted.a || !this.accepted.b) return 'waiting';
    if (this.stage === 'offer') {
      this.stage = 'confirm';
      this.accepted = { a: false, b: false };
      this.confirmableAt = now + TRADE.confirmDelayMs;
      this.lastChanged = [];
      return 'confirm';
    }
    this.status = 'committing';
    return 'commit';
  }

  isExpired(now: number): boolean {
    if (this.status === 'pending') return now - this.createdAt > TRADE.requestTimeoutMs;
    return now - this.createdAt > TRADE.sessionTimeoutMs;
  }

  viewFor(playerId: string): TradeView {
    const side = this.sideOf(playerId)!;
    const otherSide: Side = side === 'a' ? 'b' : 'a';
    const them = this.other(side);
    return {
      tradeId: this.id,
      stage: this.stage,
      you: { id: playerId, offer: this.offers[side], accepted: this.accepted[side] },
      them: { id: them.id, name: them.name, offer: this.offers[otherSide], accepted: this.accepted[otherSide] },
      confirmableAt: this.confirmableAt,
      changed: this.lastChanged.length ? this.lastChanged : undefined,
    };
  }
}
