import type { LngLat, Player, Reward } from '../../types/game';
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
      return state.player ? { player: addItem(state.player, action.itemId, action.quantity ?? 1) } : state;
    case 'removeItem':
      return state.player ? { player: removeItem(state.player, action.itemId, action.quantity ?? Infinity) } : state;
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

function addItem(p: Player, itemId: string, quantity: number): Player {
  const inv = p.inventory.map((s) => ({ ...s }));
  const slot = inv.find((s) => s.itemId === itemId);
  if (slot) slot.quantity += quantity;
  else inv.push({ itemId, quantity });
  return { ...p, inventory: inv };
}

function removeItem(p: Player, itemId: string, quantity: number): Player {
  const inv = p.inventory
    .map((s) => (s.itemId === itemId ? { ...s, quantity: s.quantity - quantity } : s))
    .filter((s) => s.quantity > 0);
  return { ...p, inventory: inv };
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
  for (const it of r.items ?? []) next = addItem(next, it.itemId, it.quantity);
  return next;
}
