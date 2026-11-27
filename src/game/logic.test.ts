import { describe, expect, it } from 'vitest';
import { gameReducer, harmKarma, INVENTORY_SIZE, type GameState } from './store/gameReducer';
import { ITEMS } from '../data/items';
import { createPlayer } from './player/createPlayer';
import { alertLevel, auraTier, basketTotal, catchChance, CAUGHT_KARMA_MULT, priceOf, STEAL_KARMA } from './shop/shop';
import { burnChance, canCook, RECIPES, resolveCook } from './cooking/recipes';
import { artXp, spotQuality, witnessReaction } from './art/graffiti';
import { buffMultipliers, strainEffect } from './gym/roina';
import type { Player } from '../types/game';
import { moveDir } from '../components/world/controls';
import { PropCollider } from './world/propCollider';
import { landformHeight, landformsFor } from './world/landforms';
import { muscleOf } from './player/body';
import { fightChance, roadmanLevel, ROADMAN_MAX, ROADMAN_MIN } from './street/fight';
import { DRILLS, drillXp } from './gym/drills';
import { CHECK_LEVEL, dealPrice, resolveDeal, scamChance } from './street/streetDeals';
import { BUILD_STAGES, placePlots, plotPrice, plotResale, plotSize, pricePerM2 } from './world/plots';
import { escapeChance } from './street/escape';
import { findJunctions } from './world/junctions';
import { crossingLift, findCrossings } from './world/crossings';
import { ATTACK_MAX, ATTACK_MIN, freshMood, provoke } from './street/provoke';

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

describe('harmful goods and karma', () => {
  it('obtaining a harmful item costs karma per unit, harmless ones nothing', () => {
    const harm = ITEMS.massamix!.harm!;
    expect(harm).toBeGreaterThan(0);
    expect(gameReducer(fresh(), { type: 'addItem', itemId: 'massamix', quantity: 2 }).player!.karma).toBe(-harm * 2);
    expect(gameReducer(fresh(), { type: 'addItem', itemId: 'pulla' }).player!.karma ?? 0).toBe(0);
    expect(harmKarma('shankki')).toBeLessThan(0);
  });

  it('harm applies however the item arrives: reward, loot or theft on top of the theft karma', () => {
    const harm = ITEMS.shankki!.harm!;
    expect(gameReducer(fresh(), { type: 'grantReward', reward: { items: [{ itemId: 'shankki', quantity: 1 }] } }).player!.karma).toBe(-harm);
    expect(gameReducer(fresh(), { type: 'pickupLoot', lootId: 'x', itemId: 'shankki' }).player!.karma).toBe(-harm);
    expect(gameReducer(fresh(), { type: 'stealItem', itemId: 'shankki' }).player!.karma).toBe(-harm + STEAL_KARMA);
  });

  it('holding and putting back an item does not cost karma again', () => {
    let s = gameReducer(fresh(), { type: 'addItem', itemId: 'shankki' });
    const k = s.player!.karma;
    s = run(s, { type: 'equipItem', itemId: 'shankki', hand: 'handR' }, { type: 'unequip', slot: 'handR' });
    expect(s.player!.karma).toBe(k);
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

describe('keyboard steering', () => {
  const dir = (yaw: number, ...keys: string[]) => moveDir({ yaw, keys: new Set(keys) }).map((v) => +v.toFixed(3) + 0);
  it('moves away from the camera and sideways relative to it', () => {
    // camera south of the player (yaw 0) looks north (−z)
    expect(dir(0, 'arrowup')).toEqual([0, -1]);
    expect(dir(0, 's')).toEqual([0, 1]);
    expect(dir(0, 'arrowleft')).toEqual([-1, 0]);
    expect(dir(0, 'd')).toEqual([1, 0]);
    // camera east of the player looks west
    expect(dir(Math.PI / 2, 'w')).toEqual([-1, 0]);
  });
  it('is still when no key is held and normalised on diagonals', () => {
    expect(dir(0)).toEqual([0, 0]);
    const [x, z] = moveDir({ yaw: 0, keys: new Set(['w', 'd']) });
    expect(Math.hypot(x, z)).toBeCloseTo(1);
  });
});

describe('crew provocations', () => {
  it('attacks on a random 3rd to 5th provocation, then starts over', () => {
    for (const roll of [0, 0.4, 0.99]) {
      let mood = freshMood(roll);
      expect(mood.attackAt).toBeGreaterThanOrEqual(ATTACK_MIN);
      expect(mood.attackAt).toBeLessThanOrEqual(ATTACK_MAX);
      let n = 0, attack = false;
      while (!attack) {
        const r = provoke(mood, roll, 0.5);
        mood = r.mood;
        attack = r.attack;
        n++;
      }
      expect(n).toBe(freshMood(roll).attackAt);
      expect(mood.count).toBe(0);
    }
  });
});

describe('street deals', () => {
  it('scams beginners far more often than experienced hustlers', () => {
    expect(scamChance(1)).toBeGreaterThan(0.4);
    expect(scamChance(10)).toBeLessThan(0.15);
    expect(scamChance(30)).toBeGreaterThanOrEqual(0.04);
  });
  it('checking the goods with enough Hustlaus spots the scam', () => {
    expect(resolveDeal(1, false, 0.01, 0.1)).toBe('fake');
    expect(resolveDeal(1, false, 0.01, 0.9)).toBe('ripoff');
    expect(resolveDeal(1, true, 0.01, 0.1)).toBe('fake');
    expect(resolveDeal(CHECK_LEVEL, true, 0.01, 0.1)).toBe('spotted');
    expect(resolveDeal(1, false, 0.99, 0.1)).toBe('ok');
  });
  it('haggles at most 25 % off', () => {
    expect(dealPrice(20, 1)).toBe(20);
    expect(dealPrice(20, 99)).toBe(15);
  });
});

describe('roadman fights', () => {
  it('gives every crew member a level from 3 to 15', () => {
    const lv = Array.from({ length: 300 }, (_, i) => roadmanLevel(`c${i}`));
    expect(Math.min(...lv)).toBe(ROADMAN_MIN);
    expect(Math.max(...lv)).toBe(ROADMAN_MAX);
  });
  it('wins more with gym and especially martial training', () => {
    const gang = [8, 6, 5];
    const fresh = fightChance(1, 1, gang);
    const gymRat = fightChance(20, 1, gang);
    const fighter = fightChance(1, 20, gang);
    expect(fresh).toBeLessThan(0.1);
    expect(gymRat).toBeGreaterThan(fresh);
    expect(fighter).toBeGreaterThan(gymRat);
    expect(fightChance(40, 40, [15, 15, 15, 15])).toBeGreaterThan(0.9);
  });
  it('is harder against higher-level and bigger gangs', () => {
    expect(fightChance(10, 10, [3, 3, 3])).toBeGreaterThan(fightChance(10, 10, [15, 12, 10]));
    expect(fightChance(10, 10, [8])).toBeGreaterThan(fightChance(10, 10, [8, 8, 8, 8]));
  });
});

describe('crew mood and martial drills', () => {
  it('stores each crew’s patience in the save', () => {
    const s = run(fresh(), { type: 'setCrewMood', crewId: 'laituri', mood: { count: 2, attackAt: 4 } });
    expect(s.player!.crewMood).toEqual({ laituri: { count: 2, attackAt: 4 } });
  });
  it('gives more XP for harder drills', () => {
    expect(drillXp(DRILLS.spar, 6, 0.5)).toBeGreaterThan(drillXp(DRILLS.wrestle, 6, 0.5));
    expect(drillXp(DRILLS.wrestle, 6, 0.5)).toBeGreaterThan(drillXp(DRILLS.bag, 6, 0.5));
  });
});

describe('body shape', () => {
  it('overeating fattens, training burns it', () => {
    let s = run(fresh());
    const f0 = s.player!.body?.fat ?? 0.12;
    s = run(s, { type: 'addItem', itemId: 'bolognese', quantity: 3 }, { type: 'eatItem', itemId: 'bolognese' }, { type: 'eatItem', itemId: 'bolognese' }, { type: 'eatItem', itemId: 'bolognese' });
    const f1 = s.player!.body!.fat;
    expect(f1).toBeGreaterThan(f0 + 0.3);
    s = run(s, ...Array.from({ length: 10 }, () => ({ type: 'adjustStats' as const, energy: -15 })));
    expect(s.player!.body!.fat).toBeLessThan(f1);
  });
  it('the huge roinattu look needs heavy deadlifts and roina, not just training', () => {
    const natural = muscleOf({ fat: 0, deadlift: 220, roina: 0 }, 60);
    const juiced = muscleOf({ fat: 0, deadlift: 220, roina: 3 }, 60);
    expect(natural).toBeLessThan(0.7);
    expect(juiced).toBe(1);
    let s = run(fresh(), { type: 'recordLift', lift: 'deadlift', kg: 140 }, { type: 'recordLift', lift: 'deadlift', kg: 100 }, { type: 'addItem', itemId: 'massamix' }, { type: 'useRoina', id: 'massamix' });
    expect(s.player!.body!.deadlift).toBe(140);
    expect(s.player!.body!.roina).toBeCloseTo(0.32);
  });
});

describe('street prop collisions', () => {
  it('blocks lamp posts, rotated parked cars and shelter parts', () => {
    const c = new PropCollider().circle(0, 0, 0.18).box(10, 0, 0.9, 2.08, Math.PI / 2).boxIn(30, 0, 0, 0, 0.7, 1.85, 0.06);
    expect(c.isBlocked([0.3, 0])).toBe(true);
    expect(c.isBlocked([0.8, 0])).toBe(false);
    // car turned 90°: long along x
    expect(c.isBlocked([11.8, 0])).toBe(true);
    expect(c.isBlocked([10, 1.6])).toBe(false);
    // shelter back wall at local z 0.7, open in front
    expect(c.isBlocked([30, 0.7])).toBe(true);
    expect(c.isBlocked([30, -1.2])).toBe(false);
  });
});

describe('landforms', () => {
  const base = { source: 'osm' as const, radius: 500, buildings: [], roads: [], water: [], parks: [] };
  it('raises a named OSM hill area, highest in the middle', () => {
    const outline: [number, number][] = [[-100, -100], [100, -100], [100, 100], [-100, 100]];
    const forms = landformsFor({ ...base, hills: [{ name: 'Aurinkomäki', x: 0, z: 0, outline }] });
    const top = landformHeight(forms, 0, 0, 0), edge = landformHeight(forms, 95, 0, 0), out = landformHeight(forms, 200, 0, 0);
    expect(top).toBeGreaterThan(6);
    expect(edge).toBeLessThan(top);
    expect(out).toBe(0);
  });
  it('lifts a peak to its OSM height and puts Aurinkomäki on the placeholder map', () => {
    const forms = landformsFor({ ...base, elevation: { minX: 0, minZ: 0, step: 40, cols: 1, rows: 1, heights: [0], base: 40 }, hills: [{ name: 'Huippu', x: 0, z: 0, ele: 55 }] });
    expect(landformHeight(forms, 0, 0, 3)).toBeCloseTo(12);
    const ph = landformsFor({ ...base, source: 'placeholder' });
    expect(ph.some((f) => f.name === 'Aurinkomäki')).toBe(true);
  });
});

describe('building plots', () => {
  it('centre plots are small and pricey, edge plots big and cheap', () => {
    expect(plotSize(150)).toBeLessThan(plotSize(1500));
    expect(plotPrice(150)).toBeGreaterThan(plotPrice(1500));
    expect(pricePerM2(150)).toBeGreaterThan(pricePerM2(1500) * 20);
    for (let d = 100; d < 1600; d += 100) expect(plotPrice(d + 100)).toBeLessThanOrEqual(plotPrice(d));
  });
  it('places plots only on free land with a road nearby', () => {
    const plots = placePlots({
      free: ([x]) => x > -600,
      road: ([, z], m) => Math.abs(z % 140) < m + 3,
      height: () => 0,
      bounds: { minX: -1500, maxX: 1500, minZ: -1500, maxZ: 1500 },
    });
    expect(plots.length).toBeGreaterThan(10);
    for (const p of plots) expect(p.at[0] - p.size / 2).toBeGreaterThan(-600);
    for (let i = 0; i < plots.length; i++)
      for (let j = i + 1; j < plots.length; j++)
        expect(Math.hypot(plots[i]!.at[0] - plots[j]!.at[0], plots[i]!.at[1] - plots[j]!.at[1])).toBeGreaterThan((plots[i]!.size + plots[j]!.size) / 2);
  });
  it('buying, building and selling', () => {
    let s: GameState = { player: { ...createPlayer('t', '#fff'), money: 3000, energy: 100 } };
    s = gameReducer(s, { type: 'buyPlot', plotId: 'a', price: 2000 });
    expect(s.player!.money).toBe(1000);
    expect(s.player!.plots?.a?.stage).toBe(0);
    const st = BUILD_STAGES[0]!;
    // no cement yet: nothing happens
    const before = s;
    s = gameReducer(s, { type: 'buildStage', plotId: 'a', needs: st.needs, energy: st.energy, xp: st.xp, advance: true });
    expect(s).toBe(before);
    s = gameReducer(s, { type: 'addItem', itemId: 'sementti', quantity: 4 });
    s = gameReducer(s, { type: 'buildStage', plotId: 'a', needs: st.needs, energy: st.energy, xp: st.xp, advance: true });
    expect(s.player!.plots?.a?.stage).toBe(1);
    expect(s.player!.skills.construction.xp).toBe(st.xp);
    expect(s.player!.inventory.some((i) => i.itemId === 'sementti')).toBe(false);
    const plot = { id: 'a', at: [0, 0] as [number, number], size: 14, front: [0, 1] as [number, number], sign: [0, 6] as [number, number], price: 2000, zone: 'Keskusta' as const };
    const v = plotResale(plot, { stage: 1 }, priceOf);
    expect(v).toBe(Math.round((1600 + 4 * priceOf('sementti')) / 10) * 10);
    s = gameReducer(s, { type: 'sellPlot', plotId: 'a', value: v });
    expect(s.player!.plots?.a).toBeUndefined();
    expect(s.player!.money).toBe(1000 + v);
  });
});

describe('space-mash escapes', () => {
  it('faster mashing gives better odds', () => {
    expect(escapeChance(30, 3, 0)).toBeGreaterThan(escapeChance(15, 3, 0));
    expect(escapeChance(15, 3, 0)).toBeGreaterThan(escapeChance(3, 3, 0));
    expect(escapeChance(0, 3, 0)).toBe(0.03);
    expect(escapeChance(200, 3, 50)).toBe(0.95);
  });
  it('skill helps a bit, harder pursuers hurt', () => {
    expect(escapeChance(20, 3, 10)).toBeGreaterThan(escapeChance(20, 3, 0));
    expect(escapeChance(20, 3, 0, 1.5)).toBeLessThan(escapeChance(20, 3, 0, 0.7));
  });
});

describe('road–rail crossings', () => {
  const rail = { kind: 'rail' as const, points: [[0, -500], [0, 500]] as [number, number][] };
  it('main roads go over, streets go under, roads stop at the station yard', () => {
    const cs = findCrossings(
      { roads: [rail, { kind: 'major', points: [[-200, -300], [200, -300]] }, { kind: 'street', points: [[-200, 300], [200, 300]] }, { kind: 'street', points: [[-200, 0], [200, 0]] }] },
      { inYard: ([, z]) => Math.abs(z) < 100 },
    );
    expect(cs.map((c) => c.kind)).toEqual(['over', 'under', 'end']);
    expect(crossingLift(cs[0]!, [0, -300])).toBeGreaterThan(6);
    expect(crossingLift(cs[1]!, [0, 300])).toBeLessThan(-4);
    // the ramp eases out and nothing changes far from the crossing
    expect(Math.abs(crossingLift(cs[0]!, [-60, -300]))).toBeLessThan(crossingLift(cs[0]!, [-20, -300]));
    expect(crossingLift(cs[0]!, [-180, -300])).toBe(0);
    expect(crossingLift(cs[0]!, [0, -250])).toBe(0);
  });
  it('OSM tags win, and parallel tracks make one crossing', () => {
    const rail2 = { kind: 'rail' as const, points: [[12, -500], [12, 500]] as [number, number][] };
    const cs = findCrossings({ roads: [rail, rail2, { kind: 'major', level: 'tunnel', points: [[-200, 200], [200, 200]] }] });
    expect(cs.length).toBe(1);
    expect(cs[0]!.kind).toBe('under');
    expect(cs[0]!.span).toBeGreaterThan(9);
  });
});

describe('street junctions', () => {
  it('finds crossings, T-junctions on shared nodes, and ignores ways that just continue', () => {
    const js = findJunctions([
      { kind: 'major', points: [[-100, 0], [100, 0]] },
      { kind: 'street', points: [[0, -100], [0, 100]] }, // crosses mid-segment: 4 arms
      { kind: 'street', points: [[60, 0], [60, 80]] }, // T on... a point inside the major segment, no shared node
      { kind: 'street', points: [[-200, 50], [-150, 50]] },
      { kind: 'street', points: [[-150, 50], [-120, 50]] }, // continues the previous way: not a junction
    ]);
    const cross = js.find((j) => Math.hypot(j.at[0], j.at[1]) < 1)!;
    expect(cross.arms.length).toBe(4);
    expect(cross.hasMajor).toBe(true);
    expect(js.some((j) => Math.abs(j.at[0] + 150) < 1)).toBe(false);
  });
});

describe('online look', () => {
  it('round-trips our appearance and rejects bad values from others', async () => {
    const { appearanceToLook, lookToAppearance } = await import('./online/look');
    const { defaultAppearance } = await import('./player/appearance');
    const mine = { ...defaultAppearance('#3a7bd5'), hairStyle: 'afro' as const, glasses: true, height: 1.05 };
    const back = lookToAppearance(appearanceToLook(mine, '#3a7bd5', { fat: 0.2, muscle: 0.6 }), '#3a7bd5');
    expect(back.a).toEqual(mine);
    expect(back.shape).toEqual({ fat: 0.2, muscle: 0.6 });
    const bad = lookToAppearance({ a: { skin: 'url(x)', hairStyle: 'spikes', height: 9, hat: 'crown' }, fat: 5, muscle: -1 }, '#ffd23f');
    const def = defaultAppearance('#ffd23f');
    expect(bad.a.skin).toBe(def.skin);
    expect(bad.a.hairStyle).toBe(def.hairStyle);
    expect(bad.a.height).toBe(1.08);
    expect(bad.a.hat).toBe(def.hat);
    expect(bad.shape).toEqual({ fat: 1, muscle: 0 });
  });
});

describe('starting outfit', () => {
  it('is a suit without hat or backpack', async () => {
    const { defaultAppearance } = await import('./player/appearance');
    expect(defaultAppearance()).toMatchObject({ topStyle: 'suit', hat: 'none', backpack: false });
  });
});

describe('Kerava-Pörssi location', () => {
  it('the server-side counter position is the tori on the map', async () => {
    const { MARKET } = await import('../../shared/economy');
    const { lngLatToWorld } = await import('./world/projection');
    const { TORI_LNGLAT } = await import('../components/world/GameWorld/constants');
    const [x, z] = lngLatToWorld(TORI_LNGLAT);
    expect(Math.hypot(x - MARKET.at.x, z - MARKET.at.z)).toBeLessThan(1);
  });
});
