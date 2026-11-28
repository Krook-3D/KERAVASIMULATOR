/**
 * Sound engine. Every sound in the game is synthesised with the Web Audio API
 * (oscillators, filtered noise and envelopes), so there are no audio files to
 * load. Recipes in `sounds.ts` draw on a `Voice` (context + output + start
 * time), which lets the same recipe play live or render offline.
 *
 * The context is created lazily and only plays once the browser has had a user
 * gesture (click or key). Volumes live in localStorage, per device.
 */

export type Bus = 'sfx' | 'amb' | 'ui';

export interface AudioSettings {
  master: number;
  sfx: number;
  amb: number;
  muted: boolean;
}

const KEY = 'kerava-sim:audio';
const DEFAULTS: AudioSettings = { master: 0.8, sfx: 0.9, amb: 0.7, muted: false };

function load(): AudioSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const v = JSON.parse(raw) as Partial<AudioSettings>;
    const num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : d);
    return { master: num(v.master, DEFAULTS.master), sfx: num(v.sfx, DEFAULTS.sfx), amb: num(v.amb, DEFAULTS.amb), muted: !!v.muted };
  } catch {
    return { ...DEFAULTS };
  }
}

let settings: AudioSettings = load();
const listeners = new Set<() => void>();

export const getAudioSettings = () => settings;
export function setAudioSettings(patch: Partial<AudioSettings>) {
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // private mode: settings last for this visit only
  }
  applyGains();
  listeners.forEach((f) => f());
}
export function onAudioSettings(f: () => void) {
  listeners.add(f);
  return () => void listeners.delete(f);
}
export const toggleMute = () => setAudioSettings({ muted: !settings.muted });

// ---------------------------------------------------------------- context and buses

interface Live {
  ctx: AudioContext;
  master: GainNode;
  buses: Record<Bus, GainNode>;
}
let live: Live | null = null;

/** The live context and buses, created on first use. Null where Web Audio is missing. */
export function audio(): Live | null {
  if (live) return live;
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    const ctx = new AC();
    const master = ctx.createGain();
    // a gentle limiter so stacked sounds never clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 8;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    master.connect(comp).connect(ctx.destination);
    const mk = () => {
      const g = ctx.createGain();
      g.connect(master);
      return g;
    };
    live = { ctx, master, buses: { sfx: mk(), amb: mk(), ui: mk() } };
    applyGains();
    return live;
  } catch {
    return null;
  }
}

function applyGains() {
  if (!live) return;
  const t = live.ctx.currentTime;
  const s = settings;
  live.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.05);
  live.buses.sfx.gain.setTargetAtTime(s.sfx, t, 0.05);
  live.buses.ui.gain.setTargetAtTime(s.sfx * 0.8, t, 0.05);
  live.buses.amb.gain.setTargetAtTime(s.amb, t, 0.05);
}

/** True once the context is running (after a user gesture). */
export const audioReady = () => !!live && live.ctx.state === 'running';

export function unlockAudio() {
  const a = audio();
  if (a && a.ctx.state === 'suspended') a.ctx.resume().catch(() => undefined);
}

// ---------------------------------------------------------------- voices and primitives

export interface Voice {
  ctx: BaseAudioContext;
  out: AudioNode;
  /** Start time in the context's clock. */
  t: number;
}

const noiseCache = new WeakMap<BaseAudioContext, Partial<Record<NoiseColor, AudioBuffer>>>();
export type NoiseColor = 'white' | 'pink' | 'brown';

/** Two seconds of looping noise for this context. */
export function noiseBuffer(ctx: BaseAudioContext, color: NoiseColor): AudioBuffer {
  let c = noiseCache.get(ctx);
  if (!c) noiseCache.set(ctx, (c = {}));
  const hit = c[color];
  if (hit) return hit;
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (color === 'white') d[i] = w * 0.6;
    else if (color === 'pink') {
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16;
    } else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    }
  }
  c[color] = buf;
  return buf;
}

/** Attack/decay envelope on a gain (exponential, so it never clicks). */
export function envelope(g: AudioParam, t: number, peak: number, a: number, d: number, hold = 0) {
  const p = Math.max(0.0002, peak);
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(p, t + Math.max(0.002, a));
  if (hold > 0) g.setValueAtTime(p, t + a + hold);
  g.exponentialRampToValueAtTime(0.0001, t + a + hold + Math.max(0.01, d));
}

export interface ToneOpts {
  type?: OscillatorType;
  f: number;
  /** Frequency at the end of the sound (exponential glide). */
  f2?: number;
  at?: number;
  a?: number;
  d?: number;
  hold?: number;
  g?: number;
  /** Optional lowpass on the tone. */
  lp?: number;
  detune?: number;
  dest?: AudioNode;
}

export function tone(v: Voice, o: ToneOpts) {
  const { ctx } = v;
  const t = v.t + (o.at ?? 0);
  const a = o.a ?? 0.005, d = o.d ?? 0.2, hold = o.hold ?? 0;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + a + hold + d);
  if (o.detune) osc.detune.value = o.detune;
  const g = ctx.createGain();
  envelope(g.gain, t, o.g ?? 0.2, a, d, hold);
  let node: AudioNode = osc;
  if (o.lp) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.lp;
    node.connect(f);
    node = f;
  }
  node.connect(g).connect(o.dest ?? v.out);
  osc.start(t);
  osc.stop(t + a + hold + d + 0.05);
}

export interface NoiseOpts {
  color?: NoiseColor;
  filter?: BiquadFilterType;
  f?: number;
  f2?: number;
  q?: number;
  at?: number;
  a?: number;
  d?: number;
  hold?: number;
  g?: number;
  dest?: AudioNode;
}

export function noise(v: Voice, o: NoiseOpts) {
  const { ctx } = v;
  const t = v.t + (o.at ?? 0);
  const a = o.a ?? 0.003, d = o.d ?? 0.1, hold = o.hold ?? 0;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, o.color ?? 'white');
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.filter ?? 'lowpass';
  f.frequency.setValueAtTime(o.f ?? 2000, t);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + a + hold + d);
  f.Q.value = o.q ?? 0.8;
  const g = ctx.createGain();
  envelope(g.gain, t, o.g ?? 0.2, a, d, hold);
  src.connect(f).connect(g).connect(o.dest ?? v.out);
  src.start(t, Math.random() * 1.5);
  src.stop(t + a + hold + d + 0.05);
}

/** A gain node in front of `v.out`, for a whole sound's volume. */
export function scaled(v: Voice, gain: number): Voice {
  const g = v.ctx.createGain();
  g.gain.value = gain;
  g.connect(v.out);
  return { ...v, out: g };
}

/** Volume for a sound `d` metres away: full up to `near`, silent past `far`. */
export function distanceGain(d: number, near = 8, far = 260): number {
  if (d <= near) return 1;
  if (d >= far) return 0;
  const k = (d - near) / (far - near);
  return (1 - k) ** 2;
}
