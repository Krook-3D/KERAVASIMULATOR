/**
 * Economy and trading rules shared by the client (for UI hints) and the
 * server (which enforces them). All money values are integer cents.
 * See docs/MULTIPLAYER.md, sections 9–11.
 */

export const CENTS_PER_EURO = 100;
export const STARTING_MONEY_CENTS = 50 * CENTS_PER_EURO;
/** Hard cap on a single character's wallet (also a DB CHECK). */
export const MAX_MONEY_CENTS = 2_147_483_647;

/** Player-to-player trade. */
export const TRADE = {
  /** Max distance between the two players, metres. */
  maxDistanceM: 8,
  /** How long a trade request stays open, ms. */
  requestTimeoutMs: 30_000,
  /** Whole trade session limit, ms. */
  sessionTimeoutMs: 5 * 60_000,
  /** Minimum time on the confirm screen before confirming, ms. */
  confirmDelayMs: 2_000,
  /** Different item stacks one side may offer. */
  maxOfferSlots: 28,
  /** Accounts under these limits may only give this much value per day. */
  newAccount: { minPlaySeconds: 24 * 3600, minLevel: 5, dailyGiveCents: 200 * CENTS_PER_EURO },
} as const;

/** Kerava-Pörssi (player marketplace). */
export const MARKET = {
  taxRate: 0.02,
  /** Trades below this total are tax free. */
  taxFreeBelowCents: 1 * CENTS_PER_EURO,
  maxTaxPerTradeCents: 5_000 * CENTS_PER_EURO,
  /** Allowed price band around the guide price (±). */
  priceBand: 0.3,
  orderSlots: 6,
  orderLifetimeMs: 7 * 24 * 3600_000,
  buyLimitWindowMs: 4 * 3600_000,
} as const;

/** Tax for one matched sale, rounded down, cents. */
export function marketTax(totalCents: number): number {
  if (totalCents < MARKET.taxFreeBelowCents) return 0;
  return Math.min(Math.floor(totalCents * MARKET.taxRate), MARKET.maxTaxPerTradeCents);
}

export function formatEuros(cents: number): string {
  return `${(cents / CENTS_PER_EURO).toFixed(2).replace('.', ',')} €`;
}
