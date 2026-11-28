/**
 * Street deals with crew members (K18, fully fictional). Any crew member will
 * sell you something, but a buyer who doesn't know the game (low Hustlaus)
 * often gets scammed: a bag of fake filler, or the seller runs off with the
 * money. Checking the goods first ([Hustlaus 4]) spots most scams.
 *
 * The goods are invented and have game-abstract value only: no real
 * substances, doses or prices.
 */
export type StreetGoodId = 'jokivihrea' | 'asemanpolly' | 'lahijunasieni';

export interface StreetGood {
  id: StreetGoodId;
  /** Asking price in euros before haggling. */
  price: number;
  /** Seller's line when offering it. */
  pitch: string;
}

export const STREET_GOODS: Record<StreetGoodId, StreetGood> = {
  jokivihrea: { id: 'jokivihrea', price: 20, pitch: '"Jokivarren Vihreää", ihan tuoretta.' },
  asemanpolly: { id: 'asemanpolly', price: 35, pitch: '"Asemanpöllyä", tää on kovaa kamaa.' },
  lahijunasieni: { id: 'lahijunasieni', price: 30, pitch: '"Lähijunasientä", harvinaista.' },
};

/** What you get when the deal is a scam with fake goods. */
export const FAKE_GOOD = 'feikkipussi';
/** Hustlaus needed to tell real goods from fake ones. */
export const CHECK_LEVEL = 4;

/**
 * Chance that the seller tries to scam you: high for a beginner, small once
 * you know the street. Some sellers (`shady` 0–1) are worse than others.
 */
export function scamChance(hustle: number, shady = 0.5): number {
  const base = 0.55 - (Math.max(1, hustle) - 1) * 0.05;
  return Math.min(0.75, Math.max(0.04, base + (shady - 0.5) * 0.2));
}

/** Price after Hustlaus haggling: up to 25 % off. */
export function dealPrice(price: number, hustle: number): number {
  return Math.round(price * (1 - Math.min(0.25, (Math.max(1, hustle) - 1) * 0.025)));
}

export type DealOutcome = 'ok' | 'fake' | 'ripoff' | 'spotted';

/**
 * Resolves a purchase. `roll` decides whether the seller scams you, `kind`
 * which scam. Checking the goods with enough Hustlaus turns a scam into
 * `spotted` (you walk away without paying).
 */
export function resolveDeal(hustle: number, checked: boolean, roll: number, kind: number, shady = 0.5): DealOutcome {
  if (roll >= scamChance(hustle, shady)) return 'ok';
  if (checked && hustle >= CHECK_LEVEL) return 'spotted';
  return kind < 0.55 ? 'fake' : 'ripoff';
}
