/**
 * Day and night: one game day passes in DAY_SECONDS of play. The sun's path,
 * the light colours and how dark the night is are pure functions of the
 * hour, so the renderer, the HUD clock and tests all agree.
 */
export const DAY_SECONDS = 36 * 60;
/** A new session starts in the afternoon. */
export const START_HOUR = 15.5;

export const hourAt = (clock: number) => (((START_HOUR + (clock / DAY_SECONDS) * 24) % 24) + 24) % 24;

export const clockText = (hour: number) => {
  const m = Math.floor(hour * 60) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Sun elevation in degrees: up from about 6 to 20, highest (38°) at 13. */
export function sunElevation(hour: number): number {
  return 38 * Math.sin((Math.PI * (hour - 6)) / 14) - (hour < 6 || hour > 20 ? 6 : 0);
}

/** Unit vector towards the sun (+x east, +z south): east in the morning, south at noon, west in the evening. */
export function sunDirection(hour: number): [number, number, number] {
  const e = (sunElevation(hour) * Math.PI) / 180;
  const az = ((hour - 13) / 12) * Math.PI;
  return [-Math.sin(az) * Math.cos(e), Math.sin(e), Math.cos(az) * Math.cos(e)];
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 0 in daylight, 1 at full night (sun well below the horizon). */
export const nightAmount = (hour: number) => smooth(3, -9, sunElevation(hour));

export interface Lighting {
  /** Key light (sun by day, moon by night). */
  key: { dir: [number, number, number]; color: string; intensity: number };
  hemi: { sky: string; ground: string; intensity: number };
  fog: string;
  fogFar: number;
  env: number;
  night: number;
}

type Stop = { e: number; key: string; keyI: number; sky: string; ground: string; hemiI: number; fog: string; env: number };
/** Looks by sun elevation, from night to high day. */
const STOPS: Stop[] = [
  { e: -12, key: '#a9bcff', keyI: 1.05, sky: '#7286c0', ground: '#2e3a44', hemiI: 1.0, fog: '#222b45', env: 0.26 },
  { e: -4, key: '#ff9a6a', keyI: 0.8, sky: '#8a86b0', ground: '#3a3a30', hemiI: 0.8, fog: '#64618a', env: 0.32 },
  { e: 4, key: '#ffad66', keyI: 2.0, sky: '#f0c8a8', ground: '#5a5a32', hemiI: 0.62, fog: '#e6c09f', env: 0.42 },
  { e: 14, key: '#ffd29a', keyI: 2.7, sky: '#e2e3ee', ground: '#5d7a3a', hemiI: 0.72, fog: '#cfd9df', env: 0.52 },
  { e: 30, key: '#fff1d6', keyI: 2.9, sky: '#d6ecff', ground: '#5d7a3a', hemiI: 0.78, fog: '#c8dbe6', env: 0.56 },
];

const hexToRgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixHex = (a: string, b: string, t: number) => {
  const x = hexToRgb(a), y = hexToRgb(b);
  return `#${x.map((v, i) => Math.round(v + (y[i]! - v) * t).toString(16).padStart(2, '0')).join('')}`;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function lightingAt(hour: number): Lighting {
  const e = sunElevation(hour);
  let i = 0;
  while (i < STOPS.length - 2 && e > STOPS[i + 1]!.e) i++;
  const a = STOPS[i]!, b = STOPS[i + 1]!;
  const t = Math.max(0, Math.min(1, (e - a.e) / (b.e - a.e)));
  const night = nightAmount(hour);
  // the moon takes over as the key light once the sun is down: high in the opposite sky
  const sun = sunDirection(hour);
  const moonEl = 0.62;
  const moon: [number, number, number] = [-sun[0] * 0.75, moonEl, -sun[2] * 0.75];
  const len = Math.hypot(...moon);
  const useMoon = e < -2;
  const dir: [number, number, number] = useMoon ? [moon[0] / len, moon[1] / len, moon[2] / len] : [sun[0], Math.max(0.06, sun[1]), sun[2]];
  return {
    key: { dir, color: mixHex(a.key, b.key, t), intensity: lerp(a.keyI, b.keyI, t) },
    hemi: { sky: mixHex(a.sky, b.sky, t), ground: mixHex(a.ground, b.ground, t), intensity: lerp(a.hemiI, b.hemiI, t) },
    fog: mixHex(a.fog, b.fog, t),
    fogFar: lerp(620, 380, night),
    env: lerp(a.env, b.env, t),
    night,
  };
}
