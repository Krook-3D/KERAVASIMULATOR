/** Kerava-Pörssi REST types shared by the client and the server. Money is cents. */
export type MarketSide = 'buy' | 'sell';

export interface MarketOrderView {
  id: number;
  itemId: string;
  side: MarketSide;
  price: number;
  quantity: number;
  remaining: number;
  status: 'open' | 'filled' | 'cancelled' | 'expired';
  createdAt: number;
  expiresAt: number;
}

export interface MarketLevel {
  price: number;
  quantity: number;
  orders: number;
}

export interface MarketBook {
  itemId: string;
  guide: number;
  /** Allowed price range [min, max] right now. */
  band: [number, number];
  bids: MarketLevel[];
  asks: MarketLevel[];
  trades: { price: number; quantity: number; at: number }[];
  candles: { day: number; open: number; high: number; low: number; close: number; volume: number }[];
}

export interface MarketItemSummary {
  itemId: string;
  guide: number;
  bid: number | null;
  ask: number | null;
  last: number | null;
  volume24h: number;
}

export interface MarketMine {
  orders: MarketOrderView[];
  recent: MarketOrderView[];
  collect: { money: number; items: { itemId: string; quantity: number }[] };
  slots: number;
}
