import { audio, audioReady, noiseBuffer, tone, noise, type NoiseColor, type Voice } from './engine';

/**
 * Background sound: wind and distant traffic outdoors, birds by day and
 * crickets at night, a ventilation hum indoors, water at the pool, the
 * train's rumble by distance, and activity loops (frying pan, spray can).
 * `updateAmbience` is called about ten times a second; every level glides
 * to its target, so nothing ever clicks on or off.
 */

export interface AmbienceInput {
  /** 'world' or an interior id. */
  scene: string;
  /** 0 day … 1 night. */
  night: number;
  /** Metres from the player to the train, or Infinity. */
  trainDist: number;
  /** 0 standing … 1 full speed. */
  trainSpeed: number;
  /** In a cutscene or menu: everything quieter. */
  dim?: boolean;
}

interface Layer {
  gain: GainNode;
  filter?: BiquadFilterNode;
}

interface Graph {
  wind: Layer;
  city: Layer;
  hum: Layer;
  water: Layer;
  train: Layer;
  sizzle: Layer;
  spray: Layer;
}

let graph: Graph | null = null;
const loops = { sizzle: false, spray: false };

function noiseLayer(ctx: AudioContext, out: AudioNode, color: NoiseColor, type: BiquadFilterType, f: number, q = 0.7): Layer {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, color);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = f;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(out);
  src.start(0, Math.random() * 1.5);
  return { gain, filter };
}

function build(): Graph | null {
  const a = audio();
  if (!a) return null;
  const { ctx } = a;
  const out = a.buses.amb;
  const sfxOut = a.buses.sfx;
  const hum = noiseLayer(ctx, out, 'brown', 'lowpass', 380);
  // a faint mains hum under the ventilation
  const o = ctx.createOscillator();
  o.frequency.value = 100;
  const og = ctx.createGain();
  og.gain.value = 0.05;
  o.connect(og).connect(hum.gain);
  o.start();
  const train = noiseLayer(ctx, out, 'brown', 'lowpass', 170);
  const t2 = ctx.createOscillator();
  t2.type = 'triangle';
  t2.frequency.value = 52;
  const t2g = ctx.createGain();
  t2g.gain.value = 0.25;
  t2.connect(t2g).connect(train.gain);
  t2.start();
  return {
    wind: noiseLayer(ctx, out, 'pink', 'lowpass', 600),
    city: noiseLayer(ctx, out, 'brown', 'lowpass', 260),
    hum,
    water: noiseLayer(ctx, out, 'pink', 'bandpass', 900, 0.5),
    train,
    sizzle: noiseLayer(ctx, sfxOut, 'white', 'highpass', 3200),
    spray: noiseLayer(ctx, sfxOut, 'white', 'highpass', 4800),
  };
}

const glide = (p: AudioParam, v: number, t: number, tc = 0.4) => p.setTargetAtTime(v, t, tc);

let windPhase = Math.random() * 10;
let nextBird = 0;
let nextCricket = 0;
let nextCrackle = 0;

/** Activity loops: the frying pan and the spray can. */
export function setLoop(name: keyof typeof loops, on: boolean) {
  loops[name] = on;
}

export function updateAmbience(i: AmbienceInput, dt: number) {
  if (!audioReady()) return;
  if (!graph) graph = build();
  const g = graph;
  const a = audio();
  if (!g || !a) return;
  const t = a.ctx.currentTime;
  const outdoor = i.scene === 'world';
  const dim = i.dim ? 0.4 : 1;
  const day = 1 - i.night;

  // wind: slow gusts
  windPhase += dt * 0.13;
  const gust = 0.5 + 0.3 * Math.sin(windPhase) + 0.2 * Math.sin(windPhase * 2.7 + 1);
  glide(g.wind.gain.gain, outdoor ? (0.05 + 0.08 * gust) * dim : 0, t, 0.8);
  if (g.wind.filter) glide(g.wind.filter.frequency, 380 + 520 * gust, t, 0.8);
  // distant traffic: a low murmur by day, almost gone at night
  glide(g.city.gain.gain, outdoor ? (0.05 + 0.11 * day) * dim : 0.015, t, 1);
  // indoors: ventilation; the tunnel and cells stay quieter
  const indoorLevel = outdoor ? 0 : i.scene === 'tunnel' ? 0.06 : i.scene === 'prison' || i.scene === 'police' ? 0.05 : 0.1;
  glide(g.hum.gain.gain, indoorLevel * dim, t, 0.6);
  glide(g.water.gain.gain, i.scene === 'pool' ? 0.12 * dim : 0, t, 0.6);
  // the train: rumble by distance and speed
  const near = Number.isFinite(i.trainDist) ? Math.max(0, 1 - i.trainDist / 320) ** 2 : 0;
  const rumble = (outdoor || i.scene === 'station' ? 1 : 0.25) * near * (0.25 + 0.75 * i.trainSpeed);
  glide(g.train.gain.gain, 0.55 * rumble * dim, t, 0.3);
  if (g.train.filter) glide(g.train.filter.frequency, 120 + 160 * i.trainSpeed, t, 0.3);
  // activity loops
  glide(g.sizzle.gain.gain, loops.sizzle ? 0.035 : 0, t, 0.15);
  glide(g.spray.gain.gain, loops.spray ? 0.07 : 0, t, 0.05);

  const v: Voice = { ctx: a.ctx, out: a.buses.amb, t: t + 0.02 };
  const now = performance.now() / 1000;
  // pan crackle
  if (loops.sizzle && now > nextCrackle) {
    nextCrackle = now + 0.05 + Math.random() * 0.25;
    noise({ ...v, out: a.buses.sfx }, { filter: 'bandpass', f: 2500 + Math.random() * 3000, q: 2, d: 0.015, g: 0.07 + Math.random() * 0.06 });
  }
  // birds by day, outdoors
  if (outdoor && day > 0.3 && now > nextBird) {
    nextBird = now + 1.5 + Math.random() * 6 / day;
    birdCall(v, 0.5 * day * dim);
  }
  // crickets at night
  if (outdoor && i.night > 0.5 && now > nextCricket) {
    nextCricket = now + 0.8 + Math.random() * 2.2;
    crickets(v, 0.5 * i.night * dim);
  }
}

function birdCall(v: Voice, level: number) {
  const kind = Math.floor(Math.random() * 3);
  const base = 2600 + Math.random() * 1600;
  const n = kind === 0 ? 2 + Math.floor(Math.random() * 3) : kind === 1 ? 1 : 4 + Math.floor(Math.random() * 4);
  for (let k = 0; k < n; k++) {
    const at = k * (kind === 2 ? 0.07 : 0.16);
    const f = base * (kind === 1 ? 1 : 1 + (Math.random() - 0.5) * 0.15);
    tone(v, { f, f2: kind === 1 ? f * 0.6 : f * 1.35, at, a: 0.01, d: kind === 2 ? 0.04 : 0.09, g: 0.03 * level });
  }
}

function crickets(v: Voice, level: number) {
  const f = 4200 + Math.random() * 600;
  const pulses = 3 + Math.floor(Math.random() * 4);
  for (let k = 0; k < pulses; k++) tone(v, { type: 'triangle', f, at: k * 0.045, a: 0.004, d: 0.025, g: 0.018 * level });
}

// ---------------------------------------------------------------- car engine

let engine: { osc: OscillatorNode; osc2: OscillatorNode; lp: BiquadFilterNode; gain: GainNode } | null = null;

/** The player's car engine: idles when on, revs with `rev` (0–1 of top speed). */
export function setEngine(on: boolean, rev: number) {
  if (!audioReady()) return;
  const a = audio();
  if (!a) return;
  const { ctx } = a;
  if (!engine) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const g2 = ctx.createGain();
    g2.gain.value = 0.4;
    osc.connect(lp);
    osc2.connect(g2).connect(lp);
    lp.connect(gain).connect(a.buses.sfx);
    osc.start();
    osc2.start();
    engine = { osc, osc2, lp, gain };
  }
  const t = ctx.currentTime;
  // gears: the pitch climbs, drops at each shift, and climbs again
  const r = Math.max(0, Math.min(1, rev));
  const gear = Math.min(3, Math.floor(r * 4));
  const inGear = r * 4 - gear;
  const f = on ? 34 + gear * 6 + inGear * 46 : 30;
  engine.osc.frequency.setTargetAtTime(f, t, 0.08);
  engine.osc2.frequency.setTargetAtTime(f * 0.5, t, 0.08);
  engine.lp.frequency.setTargetAtTime(300 + r * 900, t, 0.1);
  engine.gain.gain.setTargetAtTime(on ? 0.05 + r * 0.05 : 0, t, on ? 0.1 : 0.25);
}
