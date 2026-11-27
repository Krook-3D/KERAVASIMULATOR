import { describe, expect, it } from 'vitest';
import { TradeSession, normaliseOffer } from '../src/trade/session';
import { TRADE } from '../../shared/economy';

const mk = () => {
  const s = new TradeSession('t1', { id: 'a', name: 'A' }, { id: 'b', name: 'B' }, 0);
  s.open();
  return s;
};

describe('TradeSession', () => {
  it('goes offer → confirm → commit with double acceptance', () => {
    const s = mk();
    s.setOffer('a', { items: [{ itemId: 'perch', quantity: 3 }], money: 0 });
    s.setOffer('b', { items: [], money: 500 });
    expect(s.accept('a', 'offer', 10)).toBe('waiting');
    expect(s.accept('b', 'offer', 10)).toBe('confirm');
    expect(s.stage).toBe('confirm');
    expect(() => s.accept('a', 'confirm', 10 + TRADE.confirmDelayMs - 1)).toThrow();
    const t = 10 + TRADE.confirmDelayMs;
    expect(s.accept('a', 'confirm', t)).toBe('waiting');
    expect(s.accept('b', 'confirm', t)).toBe('commit');
    expect(s.status).toBe('committing');
  });

  it('any change resets both acceptances and reports what changed', () => {
    const s = mk();
    s.setOffer('a', { items: [{ itemId: 'perch', quantity: 3 }], money: 0 });
    s.accept('b', 'offer', 0);
    const changed = s.setOffer('a', { items: [{ itemId: 'perch', quantity: 1 }], money: 0 });
    expect(changed).toEqual(['perch']);
    expect(s.accepted).toEqual({ a: false, b: false });
  });

  it('locks offers on the confirm screen', () => {
    const s = mk();
    s.setOffer('a', { items: [], money: 100 });
    s.accept('a', 'offer', 0);
    s.accept('b', 'offer', 0);
    expect(() => s.setOffer('a', { items: [], money: 1 })).toThrow();
  });

  it('rejects an accept meant for an older stage', () => {
    const s = mk();
    s.setOffer('a', { items: [], money: 100 });
    s.accept('a', 'offer', 0);
    s.accept('b', 'offer', 0);
    expect(() => s.accept('a', 'offer', 5000)).toThrow();
  });

  it('refuses empty trades and bound items', () => {
    const s = mk();
    expect(() => s.accept('a', 'offer', 0)).toThrow();
    expect(() => s.setOffer('a', { items: [{ itemId: 'mystic_key', quantity: 1 }], money: 0 })).toThrow();
    expect(() => s.setOffer('a', { items: [{ itemId: 'no_such_item', quantity: 1 }], money: 0 })).toThrow();
  });

  it('merges duplicate stacks so the same item cannot be counted twice', () => {
    expect(normaliseOffer({ items: [{ itemId: 'perch', quantity: 2 }, { itemId: 'coffee', quantity: 1 }, { itemId: 'perch', quantity: 3 }], money: 0 })).toEqual({
      items: [
        { itemId: 'coffee', quantity: 1 },
        { itemId: 'perch', quantity: 5 },
      ],
      money: 0,
    });
  });
});
