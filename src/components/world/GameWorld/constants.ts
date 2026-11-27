import type { WorldXZ } from '../../../game/world/projection';
import { PLAYER_CELL_X } from '../../../game/interiors/interiors';

/** Keravan vankila sits at the edge of the forest north-east of the centre. */
export const PRISON_AT: WorldXZ = [560, -610];
export const PRISON_FOOTPRINT: WorldXZ[] = [
  [PRISON_AT[0] - 18, PRISON_AT[1] - 13],
  [PRISON_AT[0] + 18, PRISON_AT[1] - 13],
  [PRISON_AT[0] + 18, PRISON_AT[1] + 5],
  [PRISON_AT[0] - 18, PRISON_AT[1] + 5],
];
export const JONNE_LOCAL: WorldXZ = [-27.5, 22.5];
export const CELL_SPAWN: WorldXZ = [PLAYER_CELL_X + 0.6, -4.2];
/** A click this close to a hotspot snaps onto it. */
export const HOTSPOT_SNAP = 2.6;
/** Arriving this close to a hotspot uses it. */
export const HOTSPOT_USE = 1.8;
/** How close you must stand to use something (no click-to-walk: move with the keys). */
export const USE_REACH = 4.5;
/** Where you stand to talk to the gym's roina dealer. */
export const ROINA_TALK_SPOT: WorldXZ = [7.0, 5.0];
export const SWIM_ENERGY = 8;

/** Shop-front signs for the town buildings placed from sites.ts. */
export const TOWN_SIGNS: { key: 'barber' | 'alepa' | 'gym' | 'motonet' | 'police' | 'pool' | 'fightgym'; sign: string; color: string; sub?: string }[] = [
  { key: 'barber', sign: 'PARTURI', color: '#7a1f2a', sub: 'SAKSET · AJANVARAUS EI TARPEEN' },
  { key: 'alepa', sign: 'Alepa', color: '#f28c28' },
  { key: 'gym', sign: 'KUNTOSALI RAUTA', color: '#c8312b', sub: 'AVOINNA 24/7' },
  { key: 'motonet', sign: 'MOTONET', color: '#d4202a', sub: 'AUTO · KOTI · VAPAA-AIKA' },
  { key: 'police', sign: 'POLIISI', color: '#1f3f8f', sub: 'POLISEN · KERAVAN POLIISIASEMA' },
  { key: 'fightgym', sign: 'AHJO TRAINING CENTER', color: '#14171f', sub: 'NYRKKEILY · PAINI · KAMPPAILU' },
  { key: 'pool', sign: 'UIMAHALLI', color: '#1f8fc0', sub: 'KERAVAN UIMAHALLI' },
];

export const dist = (a: WorldXZ, b: WorldXZ) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Kerava market square (kept free for the Pörssi). */
export const TORI_LNGLAT: [number, number] = [25.1046, 60.4041];
