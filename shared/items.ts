/**
 * Server-side item registry: what can be traded where. Built from the
 * game's own catalogue (src/data/items.ts), so online items are the same
 * items as in the single-player game: same ids, names and icons.
 */
import { ITEMS as GAME_ITEMS } from '../src/data/items';

/**
 * free       – player trade and Pörssi
 * trade_only – player trade only (rare collectibles)
 * street     – player trade only, raises heat; never on the Pörssi
 * bound      – cannot change owner (quest and starter items)
 */
export type Tradeability = 'free' | 'trade_only' | 'street' | 'bound';

export interface ServerItemDef {
  id: string;
  name: string;
  /** NPC base value in cents. */
  valueCents: number;
  stackable: boolean;
  tradeability: Tradeability;
  /** Max units one character may buy on the Pörssi per buy-limit window. */
  marketBuyLimit?: number;
  /** NPC shop price in cents (the Torikauppias sells only these). */
  npcPriceCents?: number;
  icon?: string;
}

/** Fictional street goods and gym roina: face to face only, raises heat, never on the Pörssi. */
const STREET = new Set(['jokivihrea', 'asemanpolly', 'lahijunasieni', 'feikkipussi', 'tankkioljy', 'massamix', 'kuivatin', 'palautin', 'tuplaus', 'leikkuri']);

function tradeabilityOf(id: string, category: string, valueCents: number): Tradeability {
  if (category === 'quest') return 'bound';
  if (STREET.has(id) || category === 'drug') return 'street';
  // no NPC value means no guide price, so no Pörssi
  if (valueCents <= 0) return 'trade_only';
  return 'free';
}

const buyLimit = (valueCents: number) => (valueCents < 500 ? 2000 : valueCents < 5000 ? 200 : 20);

export const ITEMS: readonly ServerItemDef[] = Object.values(GAME_ITEMS).map((d) => {
  const valueCents = Math.round(d.value * 100);
  const tradeability = tradeabilityOf(d.id, d.category, valueCents);
  return {
    id: d.id,
    name: d.name,
    valueCents,
    stackable: d.stackable,
    tradeability,
    marketBuyLimit: tradeability === 'free' ? buyLimit(valueCents) : undefined,
    npcPriceCents: d.price !== undefined && tradeability === 'free' ? Math.round(d.price * 100) : undefined,
    icon: d.icon,
  };
});

const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

export function getItem(id: string): ServerItemDef | undefined {
  return BY_ID.get(id);
}

export function canPlayerTrade(id: string): boolean {
  const item = BY_ID.get(id);
  return !!item && item.tradeability !== 'bound';
}

export function canListOnMarket(id: string): boolean {
  return BY_ID.get(id)?.tradeability === 'free';
}

/** What the Torikauppias sells (items with a shop price). */
export const NPC_STOCK: readonly ServerItemDef[] = ITEMS.filter((i) => i.npcPriceCents !== undefined);
