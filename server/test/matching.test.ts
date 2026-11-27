import { describe, expect, it } from 'vitest';
import { guidePrice, matchOrder, priceInBand, type RestingOrder } from '../src/market/matching';

const sell = (id: number, characterId: string, price: number, remaining: number, seq = id): RestingOrder => ({ id, characterId, side: 'sell', price, remaining, seq });
const buy = (id: number, characterId: string, price: number, remaining: number, seq = id): RestingOrder => ({ id, characterId, side: 'buy', price, remaining, seq });

describe('matchOrder', () => {
  it('fills a buy against the cheapest asks first, at their price, refunding the difference', () => {
    const book = [sell(1, 's1', 120, 5), sell(2, 's2', 100, 3), sell(3, 's3', 150, 10)];
    const r = matchOrder({ id: 9, characterId: 'b', side: 'buy', price: 130, quantity: 6 }, book);
    expect(r.fills.map((f) => [f.restingOrderId, f.price, f.quantity])).toEqual([
      [2, 100, 3],
      [1, 120, 3],
    ]);
    expect(r.fills[0]!.buyerRefund).toBe(90);
    expect(r.fills[1]!.buyerRefund).toBe(30);
    expect(r.remaining).toBe(0);
  });

  it('uses time priority at equal price', () => {
    const r = matchOrder({ id: 9, characterId: 'b', side: 'buy', price: 100, quantity: 1 }, [sell(1, 's1', 100, 1, 5), sell(2, 's2', 100, 1, 2)]);
    expect(r.fills[0]!.restingOrderId).toBe(2);
  });

  it('leaves the rest when the book does not cross', () => {
    const r = matchOrder({ id: 9, characterId: 'b', side: 'buy', price: 90, quantity: 4 }, [sell(1, 's', 100, 10)]);
    expect(r.fills).toEqual([]);
    expect(r.remaining).toBe(4);
  });

  it('a sell hits the highest bid and the seller pays tax', () => {
    const r = matchOrder({ id: 9, characterId: 's', side: 'sell', price: 1000, quantity: 2 }, [buy(1, 'b1', 1100, 1), buy(2, 'b2', 1200, 1)]);
    expect(r.fills.map((f) => f.price)).toEqual([1200, 1100]);
    expect(r.fills[0]).toMatchObject({ buyerId: 'b2', sellerId: 's', tax: 24, sellerProceeds: 1176, buyerRefund: 0 });
  });

  it('never matches a player with themselves', () => {
    const r = matchOrder({ id: 9, characterId: 'x', side: 'buy', price: 100, quantity: 1 }, [sell(1, 'x', 50, 1), sell(2, 'y', 80, 1)]);
    expect(r.fills).toHaveLength(1);
    expect(r.fills[0]!.sellerId).toBe('y');
  });

  it('conserves money: buyer escrow = seller proceeds + tax + refund', () => {
    const book = Array.from({ length: 30 }, (_, i) => sell(i + 1, `s${i}`, 50 + ((i * 37) % 70), 1 + (i % 4), i));
    const incoming = { id: 99, characterId: 'b', side: 'buy' as const, price: 100, quantity: 40 };
    const r = matchOrder(incoming, book);
    const filled = r.fills.reduce((s, f) => s + f.quantity, 0);
    const escrowUsed = filled * incoming.price;
    const paidOut = r.fills.reduce((s, f) => s + f.sellerProceeds + f.tax + f.buyerRefund, 0);
    expect(paidOut).toBe(escrowUsed);
    expect(filled + r.remaining).toBe(40);
  });
});

describe('price band and guide price', () => {
  it('enforces ±30 %', () => {
    expect(priceInBand(130, 100)).toBe(true);
    expect(priceInBand(131, 100)).toBe(false);
    expect(priceInBand(70, 100)).toBe(true);
    expect(priceInBand(69, 100)).toBe(false);
  });
  it('ignores a single absurd trade and moves at most 5 %', () => {
    const trades = [
      { price: 100, quantity: 50 },
      { price: 102, quantity: 50 },
      { price: 99999, quantity: 1 },
    ];
    expect(guidePrice(trades, 100)).toBe(102);
    expect(guidePrice([{ price: 200, quantity: 100 }], 100)).toBe(105);
    expect(guidePrice([], 100)).toBe(100);
  });
});
