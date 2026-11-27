/**
 * Core data model for Kerava Simulator.
 * Definitions (ItemDef, QuestDef, NpcDef, Poi) are static content in src/data.
 * State (Player, SkillState, InventorySlot, QuestProgress) is what gets saved.
 */

/** [longitude, latitude], same order as MapLibre and GeoJSON. */
export type LngLat = [number, number];

export type SkillId =
  | 'strength'
  | 'endurance'
  | 'running'
  | 'cooking'
  | 'fishing'
  | 'hustling'
  | 'evasion'
  | 'art';

export interface SkillState {
  /** Total XP in this skill. Level is derived from XP. */
  xp: number;
}

export type EquipmentSlot =
  | 'head'
  | 'body'
  | 'legs'
  | 'feet'
  | 'handL'
  | 'handR'
  | 'accessory'
  | 'backpack';

export type ItemCategory =
  | 'food'
  | 'tool'
  | 'material'
  | 'equipment'
  | 'quest'
  | 'collectible'
  | 'drug'
  | 'misc';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  /** Sell value in euros. */
  value: number;
  rarity: Rarity;
  stackable: boolean;
  effects?: { energy?: number; health?: number };
  equipSlot?: EquipmentSlot;
  /** Held in the hands: 1 = one hand (left or right), 2 = both hands. */
  hands?: 1 | 2;
  /** Price in shops (euros). */
  price?: number;
  /** Emoji used as the icon until item models/icons get their own pass. */
  icon?: string;
}

export interface InventorySlot {
  itemId: string;
  quantity: number;
}

export type Requirement =
  | { type: 'level'; level: number }
  | { type: 'skill'; skill: SkillId; level: number }
  | { type: 'quest'; questId: string }
  | { type: 'item'; itemId: string; quantity?: number };

export interface Reward {
  xp?: number;
  money?: number;
  items?: InventorySlot[];
  skillXp?: Partial<Record<SkillId, number>>;
  reputation?: number;
}

export type PoiKind =
  | 'station'
  | 'shop'
  | 'gym'
  | 'park'
  | 'water'
  | 'library'
  | 'sports'
  | 'culture'
  | 'food'
  | 'home';

export interface Poi {
  id: string;
  name: string;
  description: string;
  position: LngLat;
  kind: PoiKind;
  npcIds: string[];
  activityIds: string[];
  unlock?: Requirement;
}

export interface DialogueOption {
  text: string;
  next?: string;
  startQuestId?: string;
}

export interface DialogueNode {
  id: string;
  text: string;
  options: DialogueOption[];
}

export interface ShopDef {
  /** Item ids the NPC sells, priced at item value × markup. */
  itemIds: string[];
  markup: number;
}

export interface NpcDef {
  id: string;
  name: string;
  description: string;
  poiId: string;
  dialogue: DialogueNode[];
  questIds: string[];
  shop?: ShopDef;
}

export type Objective =
  | { type: 'visit'; poiId: string; text: string }
  | { type: 'talk'; npcId: string; text: string }
  | { type: 'collect'; itemId: string; quantity: number; text: string }
  | { type: 'activity'; activityId: string; text: string };

export interface QuestDef {
  id: string;
  title: string;
  description: string;
  giverNpcId: string;
  requirements?: Requirement[];
  objectives: Objective[];
  rewards: Reward;
}

export interface QuestProgress {
  status: 'active' | 'completed';
  objectiveIndex: number;
}

export interface Player {
  id: string;
  name: string;
  /** Avatar colour on the map. */
  color: string;
  /** Character XP. Level is derived from XP. */
  xp: number;
  money: number;
  health: number;
  energy: number;
  position: LngLat;
  skills: Record<SkillId, SkillState>;
  inventory: InventorySlot[];
  equipment: Partial<Record<EquipmentSlot, string>>;
  quests: Record<string, QuestProgress>;
  visitedPoiIds: string[];
  /** World loot spots already picked up (ids from game/world/loot.ts). */
  lootTaken?: string[];
  /** -100…100. Stealing lowers it, getting caught lowers it 3x; shown as the aura. */
  karma?: number;
  /** Stolen goods still carried, per item id (raises the alert level). */
  stolen?: Record<string, number>;
  /** Thefts since the guard last caught you (catch chance grows with it). */
  sinceCaught?: number;
  /** Active gym roina boosts (seconds left) and the strain meter 0–100. */
  buffs?: { id: import('../game/gym/roina').RoinaId; left: number }[];
  strain?: number;
  /** Looks (character editor + barber). Older saves fall back to `color`. */
  appearance?: import('../game/player/appearance').Appearance;
  /** Opening cutscene (thrown off the train) has been seen. */
  introDone?: boolean;
  createdAt: number;
}
