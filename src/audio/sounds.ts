import { audio, audioReady, noise, scaled, tone, type Bus, type Voice } from './engine';

/**
 * One-shot sound recipes. Each draws onto a Voice; `sfx(name)` plays one live
 * with a per-sound minimum gap so bursts of the same event don't stack up.
 */
const r = (a: number, b: number) => a + Math.random() * (b - a);

export const SOUNDS = {
  // ---------------------------------------------------------------- interface
  click: (v: Voice) => {
    tone(v, { type: 'triangle', f: 1500, f2: 1100, d: 0.035, g: 0.09 });
  },
  open: (v: Voice) => {
    tone(v, { f: 620, d: 0.09, g: 0.1 });
    tone(v, { f: 930, at: 0.06, d: 0.12, g: 0.09 });
  },
  toast: (v: Voice) => {
    tone(v, { type: 'triangle', f: 880, d: 0.12, g: 0.07 });
    tone(v, { type: 'triangle', f: 1320, at: 0.08, d: 0.2, g: 0.06 });
  },
  chat: (v: Voice) => {
    tone(v, { f: 1180, d: 0.05, g: 0.08 });
    tone(v, { f: 1580, at: 0.05, d: 0.08, g: 0.07 });
  },

  // ---------------------------------------------------------------- money and items
  coin: (v: Voice) => {
    tone(v, { f: 1975, d: 0.12, g: 0.1 });
    tone(v, { f: 2637, at: 0.07, d: 0.35, g: 0.11 });
  },
  register: (v: Voice) => {
    // drawer rattle, then the bell
    noise(v, { filter: 'bandpass', f: 2600, q: 2, d: 0.08, g: 0.18 });
    noise(v, { filter: 'bandpass', f: 1800, q: 3, at: 0.07, d: 0.06, g: 0.14 });
    tone(v, { f: 2093, at: 0.12, d: 0.6, g: 0.12 });
    tone(v, { f: 2637, at: 0.12, d: 0.75, g: 0.08 });
    tone(v, { f: 4186, at: 0.12, d: 0.3, g: 0.03 });
  },
  pickup: (v: Voice) => {
    tone(v, { f: 520, f2: 1040, d: 0.11, g: 0.14 });
    tone(v, { type: 'triangle', f: 1040, at: 0.08, d: 0.16, g: 0.08 });
  },
  equip: (v: Voice) => {
    noise(v, { filter: 'bandpass', f: 900, f2: 2400, q: 1.2, d: 0.14, g: 0.14 });
    tone(v, { f: 260, at: 0.1, d: 0.05, g: 0.12 });
  },
  eat: (v: Voice) => {
    for (let i = 0; i < 3; i++) noise(v, { filter: 'bandpass', f: r(1800, 3200), q: 1.5, at: i * 0.13, d: 0.05, g: 0.22 });
    tone(v, { f: 180, f2: 120, at: 0.42, d: 0.12, g: 0.1 });
  },
  rattle: (v: Voice) => {
    for (let i = 0; i < 6; i++) noise(v, { filter: 'highpass', f: 3500, at: i * 0.055 + r(0, 0.015), d: 0.025, g: 0.12 });
  },
  snip: (v: Voice) => {
    for (const at of [0, 0.16, 0.32]) {
      noise(v, { filter: 'highpass', f: 5000, at, d: 0.03, g: 0.16 });
      tone(v, { type: 'triangle', f: 3200, at: at + 0.01, d: 0.03, g: 0.04 });
    }
  },
  stamp: (v: Voice) => {
    tone(v, { f: 140, f2: 60, d: 0.14, g: 0.4 });
    noise(v, { f: 900, d: 0.06, g: 0.18 });
    tone(v, { f: 1975, at: 0.22, d: 0.2, g: 0.08 });
    tone(v, { f: 2637, at: 0.3, d: 0.4, g: 0.09 });
  },

  // ---------------------------------------------------------------- progress
  xp: (v: Voice) => {
    tone(v, { f: 1568, d: 0.14, g: 0.05 });
    tone(v, { f: 2093, at: 0.05, d: 0.2, g: 0.04 });
  },
  levelup: (v: Voice) => {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      tone(v, { type: 'triangle', f, at: i * 0.1, d: 0.32, g: 0.16 });
      tone(v, { f: f * 2, at: i * 0.1, d: 0.2, g: 0.04 });
    });
    for (const f of [523.25, 659.25, 783.99, 1046.5]) tone(v, { type: 'triangle', f, at: 0.42, a: 0.02, hold: 0.25, d: 0.9, g: 0.07 });
    for (let i = 0; i < 6; i++) tone(v, { f: r(2400, 4200), at: 0.45 + i * 0.07, d: 0.18, g: 0.025 });
  },
  quest: (v: Voice) => {
    const seq: [number, number, number][] = [[392, 0, 0.16], [523.25, 0.16, 0.16], [659.25, 0.32, 0.16], [783.99, 0.48, 0.7]];
    for (const [f, at, d] of seq) {
      tone(v, { type: 'square', f, at, d, g: 0.06, lp: 2200 });
      tone(v, { type: 'triangle', f: f / 2, at, d, g: 0.08 });
    }
  },
  ding: (v: Voice) => {
    tone(v, { f: 1568, d: 0.9, g: 0.14 });
    tone(v, { f: 3136, d: 0.5, g: 0.04 });
    tone(v, { f: 4700, d: 0.25, g: 0.015 });
  },
  fail: (v: Voice) => {
    tone(v, { type: 'triangle', f: 392, d: 0.2, g: 0.14 });
    tone(v, { type: 'triangle', f: 311, f2: 280, at: 0.2, d: 0.45, g: 0.14 });
  },
  escape: (v: Voice) => {
    noise(v, { filter: 'bandpass', f: 500, f2: 3500, q: 1.5, d: 0.35, g: 0.16 });
    tone(v, { type: 'triangle', f: 659.25, at: 0.15, d: 0.12, g: 0.12 });
    tone(v, { type: 'triangle', f: 987.77, at: 0.26, d: 0.3, g: 0.12 });
  },
  tap: (v: Voice) => {
    tone(v, { f: r(190, 230), f2: 120, d: 0.05, g: 0.18 });
    noise(v, { f: 1200, d: 0.02, g: 0.06 });
  },

  // ---------------------------------------------------------------- trouble
  steal: (v: Voice) => {
    noise(v, { filter: 'bandpass', f: 700, f2: 3800, q: 1.4, d: 0.16, g: 0.5 });
  },
  alarm: (v: Voice) => {
    const s = scaled(v, 0.9);
    for (let i = 0; i < 8; i++) tone(s, { type: 'square', f: i % 2 ? 760 : 1020, at: i * 0.16, d: 0.13, a: 0.004, g: 0.06, lp: 3000 });
  },
  siren: (v: Voice) => {
    // two wails, the classic two-tone European police pattern
    const { ctx } = v;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const f = osc.frequency;
    const t = v.t;
    for (let i = 0; i < 6; i++) f.setValueAtTime(i % 2 ? 588 : 440, t + i * 0.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.15);
    g.gain.setValueAtTime(0.07, t + 2.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.1);
    osc.connect(lp).connect(g).connect(v.out);
    osc.start(t);
    osc.stop(t + 3.2);
  },
  caught: (v: Voice) => {
    tone(v, { f: 130, f2: 50, d: 0.25, g: 0.4 });
    tone(v, { type: 'sawtooth', f: 220, f2: 110, at: 0.1, d: 0.55, g: 0.08, lp: 900 });
  },
  hurt: (v: Voice) => {
    tone(v, { f: 120, f2: 48, d: 0.22, g: 0.45 });
    noise(v, { f: 500, d: 0.1, g: 0.3 });
  },
  punch: (v: Voice) => {
    noise(v, { f: r(1200, 1800), d: 0.07, g: 0.4 });
    tone(v, { f: r(85, 100), f2: 45, d: 0.12, g: 0.45 });
  },
  swing: (v: Voice) => {
    noise(v, { filter: 'bandpass', f: 500, f2: 2200, q: 1.6, a: 0.04, d: 0.14, g: 0.5 });
  },
  threat: (v: Voice) => {
    tone(v, { f: 70, f2: 50, d: 0.3, g: 0.45 });
    tone(v, { f: 70, f2: 50, at: 0.35, d: 0.45, g: 0.5 });
    tone(v, { type: 'sawtooth', f: 110, at: 0.35, d: 0.6, g: 0.05, lp: 400 });
  },

  // ---------------------------------------------------------------- activities
  clank: (v: Voice) => {
    const s = r(0.94, 1.06);
    for (const [f, g, d] of [[523, 0.08, 0.5], [1311, 0.06, 0.35], [2113, 0.04, 0.25], [3001, 0.03, 0.18]] as const) tone(v, { f: f * s, d, g });
    noise(v, { filter: 'bandpass', f: 3000, q: 1, d: 0.04, g: 0.2 });
    tone(v, { f: 110, f2: 60, d: 0.1, g: 0.25 });
  },
  splash: (v: Voice) => {
    noise(v, { f: 4000, f2: 500, d: 0.4, g: 0.3 });
    for (let i = 0; i < 4; i++) tone(v, { f: r(500, 900), f2: r(1200, 1800), at: 0.08 + i * r(0.04, 0.08), d: 0.05, g: 0.04 });
  },
  stroke: (v: Voice) => {
    noise(v, { f: r(1800, 2600), f2: 400, a: 0.03, d: 0.22, g: 0.35 });
    tone(v, { f: r(600, 800), f2: r(1100, 1500), at: 0.12, d: 0.04, g: 0.025 });
  },
  hammer: (v: Voice) => {
    tone(v, { f: r(170, 200), f2: 90, d: 0.08, g: 0.35 });
    noise(v, { filter: 'bandpass', f: r(2200, 2800), q: 2, d: 0.04, g: 0.3 });
  },
  saw: (v: Voice) => {
    for (let i = 0; i < 4; i++) noise(v, { filter: 'bandpass', f: i % 2 ? 1700 : 1300, q: 3, a: 0.05, at: i * 0.2, d: 0.12, g: 0.45 });
  },
  door: (v: Voice) => {
    tone(v, { type: 'sawtooth', f: 150, f2: 190, a: 0.08, d: 0.3, g: 0.025, lp: 1200 });
    noise(v, { f: 600, at: 0.3, d: 0.12, g: 0.25 });
    tone(v, { f: 90, f2: 55, at: 0.3, d: 0.15, g: 0.3 });
  },
  build: (v: Voice) => {
    for (let i = 0; i < 3; i++) {
      tone(v, { f: 185, f2: 90, at: i * 0.16, d: 0.08, g: 0.35 });
      noise(v, { filter: 'bandpass', f: 2500, q: 2, at: i * 0.16, d: 0.04, g: 0.3 });
    }
    tone(v, { type: 'triangle', f: 783.99, at: 0.55, d: 0.2, g: 0.12 });
    tone(v, { type: 'triangle', f: 1046.5, at: 0.68, d: 0.5, g: 0.12 });
  },

  // ---------------------------------------------------------------- town
  dropHorn: (v: Voice) => {
    for (const [fs, at] of [[[523.25, 659.25], 0], [[659.25, 783.99], 0.32], [[783.99, 1046.5], 0.64]] as const)
      for (const f of fs) tone(v, { type: 'triangle', f, at, a: 0.01, d: 0.45, g: 0.09 });
  },
  dropLand: (v: Voice) => {
    tone(v, { f: 75, f2: 32, d: 0.45, g: 0.6 });
    noise(v, { f: 350, d: 0.35, g: 0.35 });
    noise(v, { filter: 'bandpass', f: 900, q: 1, at: 0.05, d: 0.12, g: 0.18 });
  },
  crate: (v: Voice) => {
    tone(v, { type: 'sawtooth', f: 120, f2: 160, a: 0.05, d: 0.25, g: 0.03, lp: 900 });
    noise(v, { filter: 'bandpass', f: 800, q: 1.2, at: 0.2, d: 0.1, g: 0.25 });
    [2093, 2637, 3136, 3520, 4186].forEach((f, i) => tone(v, { f, at: 0.3 + i * 0.07, d: 0.5, g: 0.06 }));
  },
  trainHorn: (v: Voice) => {
    for (const f of [311, 370, 466]) tone(v, { type: 'sawtooth', f, a: 0.06, hold: 0.7, d: 0.3, g: 0.05, lp: 1400 });
  },
  busBrake: (v: Voice) => {
    tone(v, { f: 2300, f2: 1900, a: 0.05, d: 0.4, g: 0.015 });
    noise(v, { filter: 'highpass', f: 2500, at: 0.45, a: 0.02, d: 0.6, g: 0.12 });
  },
  busDoor: (v: Voice) => {
    noise(v, { filter: 'highpass', f: 3000, a: 0.01, d: 0.35, g: 0.12 });
    tone(v, { f: 110, f2: 70, at: 0.35, d: 0.12, g: 0.25 });
  },
  spray: (v: Voice) => {
    noise(v, { filter: 'highpass', f: 4500, a: 0.02, hold: 0.25, d: 0.1, g: 0.08 });
  },

  // ---------------------------------------------------------------- footsteps
  stepSoft: (v: Voice) => {
    noise(v, { f: r(500, 800), d: r(0.05, 0.07), g: r(0.4, 0.55) });
    noise(v, { filter: 'bandpass', f: r(1800, 2600), q: 1, d: 0.03, g: 0.08 });
  },
  stepHard: (v: Voice) => {
    noise(v, { filter: 'bandpass', f: r(1500, 2200), q: 1.2, d: 0.035, g: r(0.1, 0.14) });
    tone(v, { f: r(140, 170), f2: 90, d: 0.04, g: 0.08 });
  },
  stepWet: (v: Voice) => {
    noise(v, { filter: 'bandpass', f: r(900, 1400), q: 0.9, d: 0.08, g: 0.3 });
    tone(v, { f: r(700, 900), f2: r(1300, 1600), at: 0.03, d: 0.03, g: 0.02 });
  },
} satisfies Record<string, (v: Voice) => void>;

export type SoundId = keyof typeof SOUNDS;

const BUS: Partial<Record<SoundId, Bus>> = { click: 'ui', open: 'ui', toast: 'ui', chat: 'ui' };
/** Minimum seconds between two plays of the same sound. */
const GAP: Partial<Record<SoundId, number>> = { click: 0.04, toast: 0.3, xp: 0.25, coin: 0.08, stepSoft: 0.1, stepHard: 0.1, stepWet: 0.1, siren: 3, alarm: 1.5, dropHorn: 2, trainHorn: 2 };

const lastPlayed: Partial<Record<SoundId, number>> = {};
let lastAny = 0;
/** Names of recent sounds, newest last (for the debug hook and tests). */
export const sfxLog: string[] = [];

export interface SfxOpts {
  /** Extra volume, 0–1+. */
  gain?: number;
  /** Delay in seconds. */
  delay?: number;
}

/** Plays a sound now. Does nothing before the first user gesture or while the tab is hidden. */
export function sfx(id: SoundId, o: SfxOpts = {}) {
  const a = audio();
  if (!a || !audioReady() || (o.gain ?? 1) <= 0.001) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  const now = a.ctx.currentTime;
  const gap = GAP[id] ?? 0.03;
  if (now - (lastPlayed[id] ?? -9) < gap) return;
  lastPlayed[id] = now;
  lastAny = performance.now();
  sfxLog.push(id);
  if (sfxLog.length > 60) sfxLog.shift();
  const v: Voice = { ctx: a.ctx, out: a.buses[BUS[id] ?? 'sfx'], t: now + 0.01 + (o.delay ?? 0) };
  SOUNDS[id](o.gain !== undefined && o.gain !== 1 ? scaled(v, o.gain) : v);
}

/** Milliseconds since any sound last played. */
export const msSinceSfx = () => performance.now() - lastAny;
