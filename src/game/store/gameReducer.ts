import type { EquipmentSlot, LngLat, Player, Reward } from '../../types/game';
import { ITEMS } from '../../data/items';
import { KARMA_MAX, KARMA_MIN, STEAL_KARMA } from '../shop/shop';
import { ROINA, STRAIN_DECAY_PER_MIN, strainEffect, type RoinaId } from '../gym/roina';
import { createPlayer, MAX_ENERGY } from '../player/createPlayer';
import { defaultAppearance, type Appearance } from '../player/appearance';

export interface GameState {
  player: Player | null;
}

export type GameAction =
  | { type: 'createCharacter'; name: string; color: string; appearance?: Appearance }
  | { type: 'setAppearance'; appearance: Partial<Appearance>; cost?: number }
  | { type: 'movePlayer'; position: LngLat }
  | { type: 'finishIntro'; position: LngLat }
  | { type: 'setQuestStep'; questId: string; step: number; completed?: boolean }
  | { type: 'grantReward'; reward: Reward }
  | { type: 'addItem'; itemId: string; quantity?: number }
  | { type: 'removeItem'; itemId: string; quantity?: number }
  | { type: 'equipItem'; itemId: string; hand?: 'handL' | 'handR' }
  | { type: 'unequip'; slot: EquipmentSlot }
  | { type: 'pickupLoot'; lootId: string; itemId: string }
  | { type: 'buyBasket'; basket: Record<string, number>; total: number }
  | { type: 'stealItem'; itemId: string }
  | { type: 'caughtStealing'; karma: number }
  | { type: 'adjustKarma'; amount: number }
  | { type: 'eatItem'; itemId: string }
  | { type: 'useUp'; itemId: string }
  | { type: 'useRoina'; id: RoinaId }
  | { type: 'tickBuffs'; dt: number }
  | { type: 'confiscateDrugs' }
  | { type: 'cook'; ingredients: Record<string, number>; out: string; xp: number }
  | { type: 'adjustStats'; energy?: number; money?: number; health?: number }
  | { type: 'resetGame' };

export const initialGameState: GameState = { player: null };

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'createCharacter':
      return { player: createPlayer(action.name, action.color, action.appearance) };
    case 'setAppearance': {
      const p = state.player;
      if (!p) return state;
      const cost = action.cost ?? 0;
      if (p.money < cost) return state;
      return { player: { ...p, money: p.money - cost, appearance: { ...defaultAppearance(p.color), ...p.appearance, ...action.appearance } } };
    }
    case 'movePlayer':
      return state.player ? { player: { ...state.player, position: action.position } } : state;
    case 'finishIntro':
      return state.player ? { player: { ...state.player, introDone: true, position: action.position } } : state;
    case 'setQuestStep': {
      if (!state.player) return state;
      const quests = { ...state.player.quests, [action.questId]: { status: action.completed ? ('completed' as const) : ('active' as const), objectiveIndex: action.step } };
      return { player: { ...state.player, quests } };
    }
    case 'grantReward':
      return state.player ? { player: applyReward(state.player, action.reward) } : state;
    case 'addItem':
      return state.player ? { player: obtain(state.player, action.itemId, action.quantity ?? 1) } : state;
    case 'removeItem':
      return state.player ? { player: removeItem(state.player, action.itemId, action.quantity ?? Infinity) } : state;
    case 'equipItem':
      return state.player ? { player: equipItem(state.player, action.itemId, action.hand) } : state;
    case 'unequip':
      return state.player ? { player: unequip(state.player, action.slot) } : state;
    case 'pickupLoot': {
      const p = state.player;
      if (!p || p.lootTaken?.includes(action.lootId) || !canAdd(p, action.itemId)) return state;
      return { player: { ...obtain(p, action.itemId, 1), lootTaken: [...(p.lootTaken ?? []), action.lootId] } };
    }
    case 'buyBasket': {
      const p = state.player;
      if (!p || p.money < action.total) return state;
      const ids = Object.keys(action.basket);
      const newSlots = ids.filter((id) => !p.inventory.some((s) => s.itemId === id)).length;
      if (p.inventory.length + newSlots > INVENTORY_SIZE) return state;
      let next: Player = { ...p, money: Math.round((p.money - action.total) * 100) / 100 };
      for (const id of ids) next = obtain(next, id, action.basket[id]!);
      return { player: next };
    }
    case 'stealItem': {
      const p = state.player;
      if (!p || !canAdd(p, action.itemId)) return state;
      const stolen = { ...p.stolen, [action.itemId]: (p.stolen?.[action.itemId] ?? 0) + 1 };
      const got = obtain(p, action.itemId, 1);
      return { player: { ...got, stolen, karma: clampKarma((got.karma ?? 0) + STEAL_KARMA), sinceCaught: (p.sinceCaught ?? 0) + 1 } };
    }
    case 'caughtStealing': {
      const p = state.player;
      if (!p) return state;
      // the guard takes back everything still hot
      let next: Player = p;
      for (const [id, n] of Object.entries(p.stolen ?? {})) next = removeItem(next, id, n);
      return { player: { ...next, stolen: {}, sinceCaught: 0, karma: clampKarma((p.karma ?? 0) + action.karma) } };
    }
    case 'adjustKarma':
      return state.player ? { player: { ...state.player, karma: clampKarma((state.player.karma ?? 0) + action.amount) } } : state;
    case 'cook': {
      const p = state.player;
      if (!p) return state;
      if (!Object.entries(action.ingredients).every(([id, n]) => (p.inventory.find((s) => s.itemId === id)?.quantity ?? 0) >= n)) return state;
      let next = p;
      for (const [id, n] of Object.entries(action.ingredients)) next = removeItem(next, id, n);
      next = addItem(next, action.out, 1);
      return { player: applyReward(next, { skillXp: { cooking: action.xp } }) };
    }
    case 'useRoina': {
      const p = state.player;
      const d = ROINA[action.id];
      if (!p || !d || !p.inventory.some((s) => s.itemId === action.id)) return state;
      const next = removeItem(p, action.id, 1);
      const buffs = (p.buffs ?? []).filter((b) => b.id !== action.id && b.left > 0);
      if (d.duration > 0) buffs.push({ id: action.id, left: d.duration });
      return { player: { ...next, buffs, strain: Math.max(0, Math.min(100, (p.strain ?? 0) + d.strain)) } };
    }
    case 'tickBuffs': {
      const p = state.player;
      if (!p || (!p.buffs?.length && !p.strain)) return state;
      const mins = action.dt / 60;
      const buffs = (p.buffs ?? []).map((b) => ({ ...b, left: b.left - action.dt })).filter((b) => b.left > 0);
      const strain = Math.max(0, (p.strain ?? 0) - STRAIN_DECAY_PER_MIN * mins);
      const drain = strainEffect(p.strain ?? 0).healthPerMin * mins;
      return { player: { ...p, buffs, strain, health: Math.max(1, Math.min(100, p.health + drain)) } };
    }
    case 'confiscateDrugs': {
      const p = state.player;
      if (!p) return state;
      let next = p;
      for (const s of p.inventory) if (ITEMS[s.itemId]?.category === 'drug') next = removeItem(next, s.itemId, s.quantity);
      return { player: next };
    }
    case 'useUp': {
      // one of the item is used up: from the backpack if there's a spare, else from the hand
      const p = state.player;
      if (!p) return state;
      if (p.inventory.some((s) => s.itemId === action.itemId)) return { player: removeItem(p, action.itemId, 1) };
      const equipment = { ...p.equipment };
      for (const [k, v] of Object.entries(equipment)) if (v === action.itemId) { delete equipment[k as EquipmentSlot]; break; }
      return { player: { ...p, equipment } };
    }
    case 'eatItem': {
      const p = state.player;
      const def = ITEMS[action.itemId];
      if (!p || !def?.effects || !p.inventory.some((s) => s.itemId === action.itemId)) return state;
      const next = removeItem(p, action.itemId, 1);
      return {
        player: {
          ...next,
          energy: Math.min(MAX_ENERGY, next.energy + (def.effects.energy ?? 0)),
          health: Math.min(100, next.health + (def.effects.health ?? 0)),
        },
      };
    }
    case 'adjustStats': {
      const p = state.player;
      if (!p) return state;
      const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Math.round(v)));
      return {
        player: {
          ...p,
          energy: clamp(p.energy + (action.energy ?? 0), MAX_ENERGY),
          health: clamp(p.health + (action.health ?? 0), 100),
          money: Math.max(0, p.money + (action.money ?? 0)),
        },
      };
    }
    case 'resetGame':
      return initialGameState;
  }
}

/** Backpack size: distinct item stacks. */
export const INVENTORY_SIZE = 30;

/** Is there room in the backpack for one more of `itemId`? */
export function canAdd(p: Player, itemId: string): boolean {
  return p.inventory.some((s) => s.itemId === itemId) || p.inventory.length < INVENTORY_SIZE;
}

function addItem(p: Player, itemId: string, quantity: number): Player {
  if (!canAdd(p, itemId)) return p; // full: the item is lost (callers check canAdd first)
  const inv = p.inventory.map((s) => ({ ...s }));
  const slot = inv.find((s) => s.itemId === itemId);
  if (slot) slot.quantity += quantity;
  else inv.push({ itemId, quantity });
  return { ...p, inventory: inv };
}

/** Karma change for obtaining `quantity` of an item (harmful goods cost karma). */
export function harmKarma(itemId: string, quantity = 1): number {
  return -(ITEMS[itemId]?.harm ?? 0) * quantity;
}

/** A new item enters the backpack (bought, stolen, found, given): harmful goods cost karma. */
function obtain(p: Player, itemId: string, quantity: number): Player {
  if (!canAdd(p, itemId)) return p;
  const next = addItem(p, itemId, quantity);
  const k = harmKarma(itemId, quantity);
  return k ? { ...next, karma: clampKarma((p.karma ?? 0) + k) } : next;
}

function removeItem(p: Player, itemId: string, quantity: number): Player {
  const inv = p.inventory
    .map((s) => (s.itemId === itemId ? { ...s, quantity: s.quantity - quantity } : s))
    .filter((s) => s.quantity > 0);
  // hot goods leave with the item (sold, eaten, dropped)
  let stolen = p.stolen;
  const hot = stolen?.[itemId];
  if (hot) {
    const left = inv.find((s) => s.itemId === itemId)?.quantity ?? 0;
    stolen = { ...stolen };
    if (left > 0) stolen[itemId] = Math.min(hot, left);
    else delete stolen[itemId];
  }
  return { ...p, inventory: inv, stolen };
}

const clampKarma = (k: number) => Math.max(KARMA_MIN, Math.min(KARMA_MAX, Math.round(k)));

const HANDS = ['handL', 'handR'] as const;

/** Hold an item: 1-handed goes to the requested (or a free) hand, 2-handed takes both. */
function equipItem(p: Player, itemId: string, hand?: 'handL' | 'handR'): Player {
  const def = ITEMS[itemId];
  if (!def?.hands || !p.inventory.some((s) => s.itemId === itemId)) return p;
  let next = removeItem(p, itemId, 1);
  const eq = next.equipment;
  const twoHandedHeld = eq.handL && eq.handL === eq.handR && ITEMS[eq.handL]?.hands === 2;
  let targets: EquipmentSlot[];
  if (def.hands === 2 || twoHandedHeld) {
    targets = def.hands === 2 ? [...HANDS] : [hand ?? 'handR'];
    // a two-handed item leaves both hands either way
    if (twoHandedHeld) next = unequip(next, 'handR');
    for (const h of HANDS) if (def.hands === 2) next = unequip(next, h);
  } else {
    const free = HANDS.find((h) => !eq[h]);
    targets = [hand ?? free ?? 'handR'];
    next = unequip(next, targets[0]!);
  }
  if (next.inventory.length > INVENTORY_SIZE) return p; // no room to swap out what was held
  const equipment = { ...next.equipment };
  for (const t of targets) equipment[t] = itemId;
  return { ...next, equipment };
}

/** Put a held item back in the backpack (a 2-handed item frees both hands). */
function unequip(p: Player, slot: EquipmentSlot): Player {
  const id = p.equipment[slot];
  if (!id) return p;
  if (!canAdd(p, id)) return p;
  const equipment = { ...p.equipment };
  for (const [k, v] of Object.entries(equipment)) if (v === id && (k === slot || ITEMS[id]?.hands === 2)) delete equipment[k as EquipmentSlot];
  return addItem({ ...p, equipment }, id, 1);
}

function applyReward(p: Player, r: Reward): Player {
  let next: Player = { ...p, xp: p.xp + (r.xp ?? 0), money: p.money + (r.money ?? 0) };
  if (r.skillXp) {
    const skills = { ...next.skills };
    for (const [id, xp] of Object.entries(r.skillXp)) {
      const k = id as keyof typeof skills;
      skills[k] = { xp: (skills[k]?.xp ?? 0) + (xp ?? 0) };
    }
    next = { ...next, skills };
  }
  for (const it of r.items ?? []) next = obtain(next, it.itemId, it.quantity);
  return next;
}
