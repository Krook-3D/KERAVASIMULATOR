import type { WorldXZ } from '../world/projection';
import type { InteriorId } from '../interiors/interiors';
import type { Player } from '../../types/game';
import { ITEMS } from '../../data/items';

/**
 * Shops: walk to a shelf, pick products into the basket (left click / "Osta
 * koriin") or slip them in your pocket (right click → "Varasta"). The basket
 * is paid at the till. Stealing lowers karma, raises the alert level and the
 * guard catches you roughly every 3rd–4th theft.
 */
export interface Shelf {
  id: string;
  name: string;
  at: WorldXZ;
  items: string[];
}

export interface ShopDef {
  id: InteriorId;
  name: string;
  shelves: Shelf[];
  till: WorldXZ;
  /** Guard post, for the guard model. */
  guard: WorldXZ;
}

export const SHOPS: Partial<Record<InteriorId, ShopDef>> = {
  prisma: {
    id: 'prisma',
    name: 'Prisma Kerava',
    shelves: [
      { id: 'fridge', name: 'Maitokaappi', at: [2, -19.6], items: ['maito', 'kerma', 'juusto', 'kananmunat'] },
      { id: 'meat', name: 'Liha ja makkara', at: [16, -19.6], items: ['makkara', 'jauheliha', 'broileri'] },
      { id: 'bakery', name: 'Leipomo', at: [-29.4, -13], items: ['leipa', 'pulla_k'] },
      { id: 'veg', name: 'Hedelmät ja vihannekset', at: [-21.5, 2.5], items: ['peruna', 'sipuli', 'tomaatti', 'omena'] },
      { id: 'dry', name: 'Kuivatuotteet', at: [-3.25, -5], items: ['jauhot', 'pasta', 'riisi', 'kahvi', 'mausteet'] },
      { id: 'candy', name: 'Herkut ja juomat', at: [7.75, -5], items: ['karkkipussi', 'energiajuoma', 'sipsit'] },
      { id: 'frozen', name: 'Pakasteet', at: [18.75, -5], items: ['pakastepizza', 'jaatelo'] },
    ],
    till: [0.75, 12],
    guard: [-14, 16],
  },
  alepa: {
    id: 'alepa',
    name: 'Alepa Savio',
    shelves: [
      { id: 'fridge', name: 'Kylmäkaappi', at: [-2, -5.4], items: ['maito', 'juusto', 'makkara', 'jauheliha', 'kananmunat'] },
      { id: 'dry', name: 'Kuivatuotteet', at: [-3.5, -1], items: ['jauhot', 'pasta', 'kahvi', 'leipa'] },
      { id: 'candy', name: 'Herkut', at: [0.5, -1], items: ['karkkipussi', 'energiajuoma', 'sipsit', 'pakastepizza'] },
      { id: 'veg', name: 'Vihannekset', at: [5.9, -4], items: ['peruna', 'sipuli', 'tomaatti', 'omena'] },
    ],
    till: [5.6, 3.2],
    guard: [-8.5, 4.5],
  },
  motonet: {
    id: 'motonet',
    name: 'Motonet Kerava',
    shelves: [
      { id: 'paint', name: 'Spraymaalit', at: [-4, -2], items: ['spraymaali', 'spray_punainen', 'spray_sininen', 'spray_keltainen', 'spray_vihrea', 'spray_valkoinen', 'spray_pinkki'] },
      { id: 'tools', name: 'Työkalut', at: [8.6, -4], items: ['ruuvimeisseli', 'jakoavain', 'sorkkarauta', 'voimapihdit', 'taskulamppu', 'koysi'] },
      { id: 'build', name: 'Rakennustarvikkeet', at: [-10, -2], items: ['lauta', 'sementti', 'kattopelti', 'ikkuna'] },
      { id: 'car', name: 'Autotarvikkeet', at: [2, -2], items: ['oljy', 'tyomiehenliivi', 'potkulautaakku'] },
    ],
    till: [6.5, 4.6],
    guard: [-11.5, 7],
  },
  krauta: {
    id: 'krauta',
    name: 'K-Rauta Kerava',
    shelves: [
      { id: 'runko', name: 'Runko ja perustus', at: [-5, -3], items: ['lauta', 'sementti', 'tiili', 'eriste'] },
      { id: 'katto', name: 'Katot ja ikkunat', at: [1, -3], items: ['kattopelti', 'ikkuna', 'nostoovi', 'aurinkopaneeli'] },
      { id: 'maalit', name: 'Maalit', at: [7, -3], items: ['talomaali'] },
      { id: 'piha', name: 'Piha ja puutarha', at: [8.8, -4.5], items: ['terassilauta', 'aitaelementti', 'multasakki', 'kukkasipulit'] },
      { id: 'sauna', name: 'Sauna ja kylpyhuone', at: [-12, 3], items: ['kiuas'] },
    ],
    till: [7.5, 5.4],
    guard: [-12.5, 8],
  },
};

export const STEAL_KARMA = -2;
/** Getting caught costs three times the karma of the thefts on that visit. */
export const CAUGHT_KARMA_MULT = 3;
export const KARMA_MIN = -100;
export const KARMA_MAX = 100;

export const priceOf = (itemId: string) => ITEMS[itemId]?.price ?? Math.max(1, ITEMS[itemId]?.value ?? 1);

export function basketTotal(basket: Record<string, number>): number {
  return Math.round(Object.entries(basket).reduce((a, [id, n]) => a + priceOf(id) * n, 0) * 100) / 100;
}

/** Stolen goods you're carrying (items still flagged hot). */
export function stolenCarried(p: Player): number {
  return Object.values(p.stolen ?? {}).reduce((a, b) => a + b, 0);
}

/** Drug units carried (category 'drug'; the street economy adds these). */
export function drugUnits(p: Player): number {
  return p.inventory.reduce((a, s) => a + (ITEMS[s.itemId]?.category === 'drug' ? s.quantity : 0), 0);
}

/**
 * Alert level 0–100: how suspicious you look. Hot goods in your pockets raise it
 * everywhere; a big stash of drugs raises it in public places too.
 */
export function alertLevel(p: Player, opts: { inShop: boolean; visitThefts?: number }): number {
  let a = stolenCarried(p) * 7 + drugUnits(p) * 3;
  if (opts.inShop) a += (opts.visitThefts ?? 0) * 6 + 8;
  return Math.max(0, Math.min(100, Math.round(a)));
}

/** Chance the guard catches this theft: grows with every theft since the last catch, plus alert. */
export function catchChance(sinceCaught: number, alert: number): number {
  return Math.min(0.95, 0.1 + sinceCaught * 0.11 + alert * 0.003);
}

export type AuraTier = 'radiant' | 'bright' | 'neutral' | 'dim' | 'dark';
export function auraTier(karma: number): AuraTier {
  if (karma >= 60) return 'radiant';
  if (karma >= 20) return 'bright';
  if (karma > -20) return 'neutral';
  if (karma > -60) return 'dim';
  return 'dark';
}
export const AURA_NAMES: Record<AuraTier, string> = { radiant: 'Säteilevä', bright: 'Kirkas', neutral: 'Tasainen', dim: 'Himmeä', dark: 'Synkkä' };
export const AURA_COLORS: Record<AuraTier, string> = { radiant: '#ffe58a', bright: '#9fe8ff', neutral: '#d8dde6', dim: '#8a6fb0', dark: '#3a1650' };
