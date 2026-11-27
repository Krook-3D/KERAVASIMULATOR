import { describe, expect, it } from 'vitest';
import { hashPassword, needsRehash, passwordProblem, verifyPassword } from '../src/auth/password';
import { ConnectionLimiter, TokenBucket } from '../src/ws/rateLimit';
import { cleanChat, clientMessageSchema } from '../src/ws/schemas';
import { nameProblem } from '../src/characters/service';
import { marketTax } from '../../shared/economy';

describe('passwords', () => {
  it('hashes and verifies', async () => {
    const hash = await hashPassword('oikein-hyva-salasana');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('oikein-hyva-salasana', hash)).toBe(true);
    expect(await verifyPassword('väärä-salasana-123', hash)).toBe(false);
    expect(needsRehash(hash)).toBe(false);
  });
  it('rejects short and common passwords', () => {
    expect(passwordProblem('lyhyt')).not.toBeNull();
    expect(passwordProblem('salasana123')).not.toBeNull();
    expect(passwordProblem('Keravan-Juna-2026')).toBeNull();
  });
});

describe('rate limiting', () => {
  it('token bucket refills over time', () => {
    const b = new TokenBucket(2, 2, 0);
    expect(b.take(0)).toBe(true);
    expect(b.take(0)).toBe(true);
    expect(b.take(0)).toBe(false);
    expect(b.take(500)).toBe(true);
  });
  it('rejects unknown message types', () => {
    const l = new ConnectionLimiter();
    expect(l.allow('give.me.money')).toBe(false);
  });
  it('limits chat to a burst of 5', () => {
    const l = new ConnectionLimiter();
    const results = Array.from({ length: 7 }, () => l.allow('chat', 1000));
    expect(results.filter(Boolean)).toHaveLength(5);
  });
});

describe('message validation', () => {
  it('accepts valid messages', () => {
    expect(clientMessageSchema.safeParse({ t: 'move', x: 1, z: 2 }).success).toBe(true);
  });
  it('rejects negative, fractional and huge amounts', () => {
    const base = { t: 'trade.offer', tradeId: '00000000-0000-4000-8000-000000000000' };
    for (const offer of [
      { items: [{ itemId: 'kahvi', quantity: -1 }], money: 0 },
      { items: [{ itemId: 'kahvi', quantity: 1.5 }], money: 0 },
      { items: [], money: -100 },
      { items: [], money: 2 ** 40 },
    ]) {
      expect(clientMessageSchema.safeParse({ ...base, offer }).success).toBe(false);
    }
  });
  it('rejects unknown types and NaN coordinates', () => {
    expect(clientMessageSchema.safeParse({ t: 'addMoney', amount: 1000 }).success).toBe(false);
    expect(clientMessageSchema.safeParse({ t: 'move', x: Number.NaN, z: 0 }).success).toBe(false);
  });
  it('limits looks and scenes', () => {
    const look = { a: { skin: '#efc19b', glasses: true, build: 1.02 }, fat: 0.1, muscle: 0.3 };
    expect(clientMessageSchema.safeParse({ t: 'look', look }).success).toBe(true);
    expect(clientMessageSchema.safeParse({ t: 'look', look: { ...look, a: { skin: 'x'.repeat(40) } } }).success).toBe(false);
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${String.fromCharCode(97 + (i % 26))}${i > 25 ? 'x' : ''}`, 1]));
    expect(clientMessageSchema.safeParse({ t: 'look', look: { ...look, a: many } }).success).toBe(false);
    expect(clientMessageSchema.safeParse({ t: 'warp', x: 1, z: 2, scene: 'prisma' }).success).toBe(true);
    expect(clientMessageSchema.safeParse({ t: 'warp', x: 1, z: 2, scene: '../etc' }).success).toBe(false);
  });
  it('cleans chat text', () => {
    expect(cleanChat('  moi\u0000‮   kaikki ')).toBe('moi kaikki');
  });
});

describe('character names', () => {
  it('validates names', () => {
    expect(nameProblem('Jönssi_88')).toBeNull();
    expect(nameProblem('ab')).not.toBeNull();
    expect(nameProblem('Admin Pekka')).not.toBeNull();
    expect(nameProblem('<script>')).not.toBeNull();
  });
});

describe('market tax', () => {
  it('is 2 %, rounded down, free under 1 € and capped', () => {
    expect(marketTax(99)).toBe(0);
    expect(marketTax(1000)).toBe(20);
    expect(marketTax(1049)).toBe(20);
    expect(marketTax(10 ** 9)).toBe(500_000);
  });
});
