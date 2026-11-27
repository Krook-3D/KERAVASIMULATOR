/**
 * Server-side item registry: what can be traded where.
 * Display data (descriptions, icons) lives in the client's src/data.
 * Ids must match the client's item ids.
 */

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
}

export const ITEMS: readonly ServerItemDef[] = [
  { id: 'coffee', name: 'Kahvi', valueCents: 250, stackable: true, tradeability: 'free', marketBuyLimit: 1000 },
  { id: 'energy_drink', name: 'Energiajuoma', valueCents: 300, stackable: true, tradeability: 'free', marketBuyLimit: 1000 },
  { id: 'karelian_pie', name: 'Karjalanpiirakka', valueCents: 150, stackable: true, tradeability: 'free', marketBuyLimit: 2000 },
  { id: 'perch', name: 'Ahven', valueCents: 400, stackable: true, tradeability: 'free', marketBuyLimit: 2000 },
  { id: 'cooked_perch', name: 'Paistettu ahven', valueCents: 900, stackable: true, tradeability: 'free', marketBuyLimit: 2000 },
  { id: 'sneakers', name: 'Lenkkarit', valueCents: 4500, stackable: false, tradeability: 'free', marketBuyLimit: 20 },
  { id: 'fishing_rod', name: 'Kalastusvapa', valueCents: 2500, stackable: false, tradeability: 'free', marketBuyLimit: 20 },
  { id: 'kerava_hoodie', name: 'Kerava Hoodie', valueCents: 6000, stackable: false, tradeability: 'free', marketBuyLimit: 10 },
  { id: 'old_nokia', name: 'Vanha Nokia', valueCents: 1500, stackable: false, tradeability: 'free', marketBuyLimit: 50 },
  { id: 'shopping_bag', name: 'Ostoskassi', valueCents: 50, stackable: true, tradeability: 'free', marketBuyLimit: 500 },
  { id: 'rare_kerava_item', name: 'Harvinainen Kerava-item', valueCents: 50000, stackable: false, tradeability: 'trade_only' },
  { id: 'arena_vr_ticket', name: 'Areenan VR-lippu', valueCents: 20000, stackable: false, tradeability: 'trade_only' },
  { id: 'gym_card', name: 'Kuntosalikortti', valueCents: 3000, stackable: false, tradeability: 'bound' },
  { id: 'bus_card', name: 'Bussikortti', valueCents: 1000, stackable: false, tradeability: 'bound' },
  { id: 'kerava_map', name: 'Keravan kartta', valueCents: 0, stackable: false, tradeability: 'bound' },
  { id: 'mystic_key', name: 'Mystinen avain', valueCents: 0, stackable: false, tradeability: 'bound' },
  { id: 'centre_receipt', name: 'Keskustan kuitti', valueCents: 0, stackable: false, tradeability: 'bound' },
  // Fictional street goods (docs/ARCHITECTURE.md section 10).
  { id: 'street_green', name: 'Jokivarren Vihreä', valueCents: 2000, stackable: true, tradeability: 'street' },
  { id: 'street_dust', name: 'Asemanpölly', valueCents: 3500, stackable: true, tradeability: 'street' },
  { id: 'street_mushroom', name: 'Lähijunasieni', valueCents: 5000, stackable: true, tradeability: 'street' },
];

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
