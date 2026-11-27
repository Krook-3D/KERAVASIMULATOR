/**
 * How the player looks. Chosen in the character editor; hair and facial
 * hair can later be changed at the barber (Parturi) in town.
 */
export const HAIR_STYLES = ['short', 'buzz', 'sidepart', 'long', 'ponytail', 'mohawk', 'afro', 'bald'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
export const FACIAL_HAIR = ['none', 'stubble', 'moustache', 'goatee', 'beard'] as const;
export type FacialHair = (typeof FACIAL_HAIR)[number];
export type HatKind = 'beanie' | 'cap' | 'none';
export type TopStyle = 'hoodie' | 'jacket';

export interface Appearance {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  facialHair: FacialHair;
  eyes: string;
  glasses: boolean;
  top: string;
  topStyle: TopStyle;
  legs: string;
  shoes: string;
  hat: HatKind;
  hatColor: string;
  accent: string;
  backpack: boolean;
  /** Body width 0.9–1.15. */
  build: number;
  /** Height 0.92–1.08. */
  height: number;
}

export const HAIR_STYLE_NAMES: Record<HairStyle, string> = {
  short: 'Lyhyt',
  buzz: 'Siili',
  sidepart: 'Sivujakaus',
  long: 'Pitkä',
  ponytail: 'Poninhäntä',
  mohawk: 'Irokeesi',
  afro: 'Afro',
  bald: 'Kalju',
};
export const FACIAL_HAIR_NAMES: Record<FacialHair, string> = {
  none: 'Ei mitään',
  stubble: 'Sänki',
  moustache: 'Viikset',
  goatee: 'Pukinparta',
  beard: 'Täysparta',
};

export const SKIN_TONES = ['#f6d3b8', '#efc19b', '#e0a982', '#c98d63', '#a8704a', '#7a4a2c', '#5a3420'];
export const HAIR_COLORS = ['#141010', '#3b2a1e', '#6b4a2e', '#a0703a', '#d8b070', '#b0502a', '#9a9a9a', '#f2f2ee', '#e0306a', '#3a7bd5'];
export const EYE_COLORS = ['#2d2118', '#5a3a1e', '#3a7bd5', '#4a8a5a', '#7a8a9a'];
export const CLOTH_COLORS = ['#ffd23f', '#3a7bd5', '#ff6b6b', '#5ee07a', '#c084fc', '#ff9f43', '#14171f', '#f2f2ee', '#2e3b55', '#6b4a2e', '#8a8f96', '#2e6b4f'];

export const BARBER_PRICE = 15;

export function defaultAppearance(color = '#ffd23f'): Appearance {
  return {
    skin: '#efc19b',
    hair: '#4a3222',
    hairStyle: 'short',
    facialHair: 'none',
    eyes: '#2d2118',
    glasses: false,
    top: color,
    topStyle: 'hoodie',
    legs: '#2e3b55',
    shoes: '#f4f4f0',
    hat: 'beanie',
    hatColor: '#3a7bd5',
    accent: '#ffd23f',
    backpack: true,
    build: 1,
    height: 1,
  };
}

export function randomAppearance(rand: () => number = Math.random): Appearance {
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(rand() * a.length)]!;
  return {
    skin: pick(SKIN_TONES),
    hair: pick(HAIR_COLORS),
    hairStyle: pick(HAIR_STYLES),
    facialHair: rand() < 0.5 ? 'none' : pick(FACIAL_HAIR),
    eyes: pick(EYE_COLORS),
    glasses: rand() < 0.2,
    top: pick(CLOTH_COLORS),
    topStyle: rand() < 0.75 ? 'hoodie' : 'jacket',
    legs: pick(['#2e3b55', '#14171f', '#3b4a6b', '#6b4a2e', '#8a8f96']),
    shoes: pick(['#f4f4f0', '#14171f', '#8a5a32', '#c8312b']),
    hat: pick(['beanie', 'cap', 'none'] as const),
    hatColor: pick(CLOTH_COLORS),
    accent: pick(CLOTH_COLORS),
    backpack: rand() < 0.6,
    build: Math.round((0.92 + rand() * 0.2) * 100) / 100,
    height: Math.round((0.94 + rand() * 0.12) * 100) / 100,
  };
}
