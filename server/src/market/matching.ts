/**
 * Kerava-Pörssi matching engine (pure). Price–time priority; a fill happens
 * at the resting order's price. Escrow is already held when orders enter the
 * book, so a fill only moves escrow to collect boxes. The DB layer (M7) runs
 * this inside one transaction under a per-item advisory lock.
 * See docs/MULTIPLAYER.md section 10.
 */
import { MARKET, marketTax } from '../../../shared/economy';

export type OrderSide = 'buy' | 'sell';

export interface RestingOrder {
  id: number;
  characterId: string;
  side: OrderSide;
  /** Cents per unit. */
  price: number;
  remaining: number;
  /** Insertion order (time priority). */
  seq: number;
}

export interface IncomingOrder {
  id: number;
  characterId: string;
  side: OrderSide;
  price: number;
  quantity: number;
}

export interface Fill {
  restingOrderId: number;
  buyerId: string;
  sellerId: string;
  /** Execution price per unit (the resting order's price). */
  price: number;
  quantity: number;
  /** Sales tax taken from the seller (money sink). */
  tax: number;
  /** What the seller receives into their collect box. */
  sellerProceeds: number;
  /** Escrow the buyer gets back because they bid above the execution price. */
  buyerRefund: number;
}

export interface MatchResult {
  fills: Fill[];
  /** Unfilled quantity of the incoming order; it rests in the book if > 0. */
  remaining: number;
}

/** Best price first, then oldest first. */
export function sortBook(side: OrderSide, orders: RestingOrder[]): RestingOrder[] {
  return [...orders].sort((x, y) => (side === 'sell' ? x.price - y.price : y.price - x.price) || x.seq - y.seq);
}

export function matchOrder(incoming: IncomingOrder, opposite: RestingOrder[]): MatchResult {
  if (!Number.isSafeInteger(incoming.quantity) || incoming.quantity <= 0) throw new RangeError('quantity');
  if (!Number.isSafeInteger(incoming.price) || incoming.price <= 0) throw new RangeError('price');
  const restingSide: OrderSide = incoming.side === 'buy' ? 'sell' : 'buy';
  const book = sortBook(restingSide, opposite.filter((o) => o.side === restingSide && o.remaining > 0));
  const fills: Fill[] = [];
  let remaining = incoming.quantity;

  for (const resting of book) {
    if (remaining === 0) break;
    const crosses = incoming.side === 'buy' ? resting.price <= incoming.price : resting.price >= incoming.price;
    if (!crosses) break;
    // No self-trades: they would let a player move the guide price for free.
    if (resting.characterId === incoming.characterId) continue;
    const quantity = Math.min(remaining, resting.remaining);
    const price = resting.price;
    const total = price * quantity;
    const tax = marketTax(total);
    const buyerLimit = incoming.side === 'buy' ? incoming.price : resting.price;
    fills.push({
      restingOrderId: resting.id,
      buyerId: incoming.side === 'buy' ? incoming.characterId : resting.characterId,
      sellerId: incoming.side === 'sell' ? incoming.characterId : resting.characterId,
      price,
      quantity,
      tax,
      sellerProceeds: total - tax,
      buyerRefund: (buyerLimit - price) * quantity,
    });
    resting.remaining -= quantity;
    remaining -= quantity;
  }
  return { fills, remaining };
}

/** Whether a price is inside the allowed band around the guide price. */
export function priceInBand(price: number, guidePrice: number, band: number = MARKET.priceBand): boolean {
  return price >= Math.floor(guidePrice * (1 - band)) && price <= Math.ceil(guidePrice * (1 + band));
}

/**
 * Guide price: volume-weighted median of recent trades (one absurd trade
 * cannot move it), moving at most maxStep from the previous value.
 */
export function guidePrice(trades: { price: number; quantity: number }[], previous: number, maxStep = 0.05): number {
  if (trades.length === 0) return previous;
  const sorted = [...trades].sort((a, b) => a.price - b.price);
  const volume = sorted.reduce((s, t) => s + t.quantity, 0);
  const mid = volume / 2;
  let acc = 0;
  let median = sorted[sorted.length - 1]!.price;
  for (const t of sorted) {
    acc += t.quantity;
    if (acc >= mid) {
      median = t.price;
      break;
    }
  }
  const max = Math.ceil(previous * (1 + maxStep));
  const min = Math.floor(previous * (1 - maxStep));
  return Math.max(1, Math.min(max, Math.max(min, median)));
}
