import type { ItemDef } from '../types/game';

export const ITEMS: Record<string, ItemDef> = {
  viila: {
    id: 'viila',
    name: 'Viila',
    description: 'Pieni metalliviila, leivottu serkun tuomaan pullaan. Kalterit eivät tiedä mikä niihin iskee.',
    category: 'quest',
    value: 0,
    rarity: 'uncommon',
    stackable: false,
  },
  pulla: {
    id: 'pulla',
    name: 'Serkun pulla',
    description: 'Vähän kova. Nyt tiedät miksi.',
    category: 'food',
    value: 1,
    rarity: 'common',
    stackable: true,
    effects: { energy: 10 },
  },
};

export const itemName = (id: string) => ITEMS[id]?.name ?? id;
