/**
 * Where the landmark blocks with interiors stand (approximate spots in
 * Kerava; real OSM buildings there are replaced by a simple block).
 * The market square (tori) is left free for the marketplace.
 */
export const SITES = {
  gym: { lngLat: [25.0988, 60.4057] as [number, number], w: 30, d: 22, h: 8, kind: 'gym' },
  barber: { lngLat: [25.1015, 60.4062] as [number, number], w: 14, d: 12, h: 6, kind: 'barber' },
  pool: { lngLat: [25.0935, 60.399] as [number, number], w: 44, d: 34, h: 10, kind: 'pool' },
  police: { lngLat: [25.1052, 60.4038] as [number, number], w: 26, d: 18, h: 9, kind: 'police' },
  motonet: { lngLat: [25.1105, 60.4072] as [number, number], w: 40, d: 30, h: 8, kind: 'motonet' },
  /** Hardware and building-materials store next to Motonet. */
  krauta: { lngLat: [25.1116, 60.4077] as [number, number], w: 44, d: 32, h: 9, kind: 'krauta' },
  /** Combat gym in Ahjo, near the Ahjon Ässät hangout. */
  fightgym: { lngLat: [25.1109, 60.4035] as [number, number], w: 28, d: 22, h: 7, kind: 'fightgym' },
} as const;
