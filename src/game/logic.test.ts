import { describe, expect, it } from 'vitest';
import { gameReducer, INVENTORY_SIZE, type GameState } from './store/gameReducer';
import { createPlayer } from './player/createPlayer';
import { alertLevel, auraTier, basketTotal, catchChance, CAUGHT_KARMA_MULT, priceOf, STEAL_KARMA } from './shop/shop';
import { burnChance, canCook, RECIPES, resolveCook } from './cooking/recipes';
import { artXp, spotQuality, witnessReaction } from './art/graffiti';
import { buffMultipliers, strainEffect } from './gym/roina';
import type { Player } from '../types/game';

const fresh = (): GameState => ({ player: createPlayer('Testi') });
const run = (s: GameState, ...actions: Parameters<typeof gameReducer>[1][]) => actions.reduce(gameReducer, s);
const qty = (p: Player | null, id: string) => p?.inventory.find((s) => s.itemId === id)?.quantity ?? 0;

describe('inventory and hands', () => {
  it('stacks items and respects the 30-slot backpack', () => {
    let s = run(fresh(), { type: 'addItem', itemId: 'pulla', quantity: 2 }, { type: 'addItem', itemId: 'pulla' });
    expect(qty(s.player, 'pulla')).toBe(3);
    const ids = Array.from({ length: INVENTORY_SIZE + 5 }, (_, i) => `fake_${i}`);
    for (const id of ids) s = gameReducer(s, { type: 'addItem', itemId: id });
    expect(s.player!.inventory.length).toBe(INVENTORY_SIZE);
  });

  it('equips a one-handed can into a hand and back', () => {
    let s = run(fresh(), { type: 'addItem', itemId: 'spray_punainen' }, { type: 'equipItem', itemId: 'spray_punainen', hand: 'handR' });
    expect(s.player!.equipment.handR).toBe('spray_punainen');
    expect(qty(s.player, 'spray_punainen')).toBe(0);
    s = gameReducer(s, { type: 'unequip', slot: 'handR' });
    expect(s.player!.equipment.handR).toBeUndefined();
    expect(qty(s.player, 'spray_punainen')).toBe(1);
  });

  it('picks up each world loot spot only once', () => {
    const s = run(fresh(), { type: 'pickupLoot', lootId: 'l1', itemId: 'pulla' }, { type: 'pickupLoot', lootId: 'l1', itemId: 'pulla' });
    expect(qty(s.player, 'pulla')).toBe(1);
    expect(s.player!.lootTaken).toEqual(['l1']);
  });
});

describe('shops, theft and karma', () => {
  it('buys a basket only with enough money', () => {
    const basket = { spraymaali: 2 };
    const total = basketTotal(basket);
    expect(total).toBe(priceOf('spraymaali') * 2);
    const s = gameReducer(fresh(), { type: 'buyBasket', basket, total });
    expect(qty(s.player, 'spraymaali')).toBe(2);
    expect(s.player!.money).toBe(50 - total);
    const broke = gameReducer(fresh(), { type: 'buyBasket', basket, total: 999 });
    expect(qty(broke.player, 'spraymaali')).toBe(0);
  });

  it('stealing flags goods hot and costs karma; getting caught takes them back at 3x karma', () => {
    let s = run(fresh(), { type: 'stealItem', itemId: 'spraymaali' }, { type: 'stealItem', itemId: 'spraymaali' });
    expect(s.player!.stolen).toEqual({ spraymaali: 2 });
    expect(s.player!.karma).toBe(STEAL_KARMA * 2);
    expect(s.player!.sinceCaught).toBe(2);
    s = gameReducer(s, { type: 'caughtStealing', karma: STEAL_KARMA * 2 * CAUGHT_KARMA_MULT });
    expect(qty(s.player, 'spraymaali')).toBe(0);
    expect(s.player!.stolen).toEqual({});
    expect(s.player!.sinceCaught).toBe(0);
    expect(s.player!.karma).toBe(STEAL_KARMA * 2 * (1 + CAUGHT_KARMA_MULT));
  });

  it('karma stays within -100..100', () => {
    expect(gameReducer(fresh(), { type: 'adjustKarma', amount: -500 }).player!.karma).toBe(-100);
    expect(gameReducer(fresh(), { type: 'adjustKarma', amount: 500 }).player!.karma).toBe(100);
  });

  it('catch chance rises per theft so roughly every 3rd-4th theft is caught', () => {
    expect(catchChance(0, 0)).toBeCloseTo(0.1);
    expect(catchChance(3, 0)).toBeGreaterThan(0.4);
    expect(catchChance(50, 100)).toBe(0.95);
    // expected thefts before the first catch, at a typical in-shop alert of ~20
    let survive = 1, expected = 0;
    for (let n = 0; n < 20; n++) {
      const c = catchChance(n, 20);
      expected += survive * c * (n + 1);
      survive *= 1 - c;
    }
    expect(expected).toBeGreaterThan(2.5);
    expect(expected).toBeLessThan(4.5);
  });

  it('alert grows with hot goods and shop visits, capped at 100', () => {
    const p = createPlayer('A');
    expect(alertLevel(p, { inShop: false })).toBe(0);
    expect(alertLevel(p, { inShop: true, visitThefts: 2 })).toBe(20);
    expect(alertLevel({ ...p, stolen: { x: 50 } }, { inShop: false })).toBe(100);
  });

  it('maps karma to aura tiers', () => {
    expect(auraTier(80)).toBe('radiant');
    expect(auraTier(0)).toBe('neutral');
    expect(auraTier(-80)).toBe('dark');
  });
});

describe('cooking', () => {
  it('burn chance falls with level but never below 3 %', () => {
    const r = RECIPES[0]!;
    expect(burnChance(r.level, r)).toBeCloseTo(0.33);
    expect(burnChance(r.level + 5, r)).toBeLessThan(0.2);
    expect(burnChance(99, r)).toBe(0.03);
  });

  it('cook consumes ingredients and only with all of them', () => {
    const munakas = RECIPES.find((r) => r.id === 'munakas')!;
    let s = gameReducer(fresh(), { type: 'addItem', itemId: 'kananmunat' });
    expect(canCook(s.player!.inventory, munakas)).toBe(false);
    expect(gameReducer(s, { type: 'cook', ingredients: munakas.ingredients, out: munakas.out, xp: munakas.xp })).toBe(s);
    s = gameReducer(s, { type: 'addItem', itemId: 'maito' });
    s = gameReducer(s, { type: 'cook', ingredients: munakas.ingredients, out: munakas.out, xp: munakas.xp });
    expect(qty(s.player, 'munakas')).toBe(1);
    expect(qty(s.player, 'kananmunat')).toBe(0);
    expect(s.player!.skills.cooking.xp).toBe(munakas.xp);
  });
});

describe('cook outcome', () => {
  const r = RECIPES[0]!;

  it('a low roll burns the dish', () => {
    expect(resolveCook(r.level, r, 0)).toEqual({ burnt: true, out: 'palanut', xp: Math.round(r.xp * 0.25) });
  });

  it('a high roll cooks it with full XP', () => {
    expect(resolveCook(r.level, r, 0.99)).toEqual({ burnt: false, out: r.out, xp: r.xp });
  });

  it('burning gives a quarter of the XP, at the burn chance edge', () => {
    const edge = burnChance(r.level, r);
    expect(resolveCook(r.level, r, edge - 0.001).xp).toBe(Math.round(r.xp * 0.25));
    expect(resolveCook(r.level, r, edge).burnt).toBe(false);
  });
});

describe('graffiti', () => {
  it('rates spots by nearby ugly / nice places', () => {
    expect(spotQuality([0, 0], [[10, 0]], [])).toBe('ugly');
    expect(spotQuality([0, 0], [], [[100, 0]])).toBe('nice');
    expect(spotQuality([0, 0], [[500, 0]], [[500, 0]])).toBe('neutral');
  });

  it('witnesses react consistently; crews always respect', () => {
    expect(witnessReaction('npc_7', false)).toBe(witnessReaction('npc_7', false));
    expect(witnessReaction('npc_7', true)).toBe('respect');
    const counts = { ignore: 0, angry: 0, police: 0, respect: 0 };
    for (let i = 0; i < 1000; i++) counts[witnessReaction(`walker_${i}`, false)]++;
    expect(counts.police).toBeGreaterThan(100);
    expect(counts.ignore).toBeGreaterThan(300);
  });

  it('bigger, more colourful pieces give more XP', () => {
    expect(artXp(0.6, 3, 1)).toBeGreaterThan(artXp(0.1, 1, 1));
  });
});

describe('gym roina (fictional)', () => {
  it('stacks buff multipliers and ignores expired ones', () => {
    const m = buffMultipliers([{ id: 'tankkioljy', left: 10 }, { id: 'kuivatin', left: 0 }]);
    expect(m.strengthXp).toBe(1.5);
    expect(m.enduranceXp).toBe(1);
  });

  it('strain decays over time and hurts at high levels', () => {
    let s = run(fresh(), { type: 'addItem', itemId: 'massamix', quantity: 3 });
    s = run(s, { type: 'useRoina', id: 'massamix' }, { type: 'useRoina', id: 'massamix' }, { type: 'useRoina', id: 'massamix' });
    expect(s.player!.strain).toBe(96);
    expect(strainEffect(96).healthPerMin).toBeLessThan(0);
    const later = gameReducer(s, { type: 'tickBuffs', dt: 600 });
    expect(later.player!.strain).toBe(66);
    expect(later.player!.health).toBeLessThan(100);
    expect(later.player!.buffs!.length).toBe(1);
  });

  it('police confiscate every drug-category item', () => {
    const s = run(fresh(), { type: 'addItem', itemId: 'massamix', quantity: 2 }, { type: 'addItem', itemId: 'pulla' }, { type: 'confiscateDrugs' });
    expect(qty(s.player, 'massamix')).toBe(0);
    expect(qty(s.player, 'pulla')).toBe(1);
  });
});
