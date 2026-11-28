import { roadmanLevel } from '../street/fight';
import type { WorldXZ } from '../world/projection';
import type { Road, WorldData } from '../world/worldData';
import { ROAD_WIDTH } from '../world/worldData';
import { createRng } from '../world/random';

/**
 * Ambient town life: street-youth crews hanging out at corners, ordinary
 * people walking the pavements, families, joggers and pensioners. All of it
 * is deterministic (seeded), and walkers move along a fixed back-and-forth
 * route as a pure function of time, so nothing needs saving.
 */
export type NpcKind = 'crew' | 'citizen' | 'family' | 'jogger' | 'elder' | 'kid';

export interface NpcLook {
  top: string;
  legs: string;
  shoes: string;
  skin: string;
  hair: string;
  hairStyle: 'short' | 'buzz' | 'sidepart' | 'long' | 'ponytail' | 'mohawk' | 'afro' | 'bald';
  facialHair: 'none' | 'stubble' | 'moustache' | 'goatee' | 'beard';
  hat: 'beanie' | 'cap' | 'none';
  hatColor: string;
  accent: string;
  style: 'hoodie' | 'jacket';
  build: number;
  height: number;
  backpack: boolean;
  glasses: boolean;
  /** Body fat / muscle 0–1 (see buildHumanoid). */
  fat?: number;
  muscle?: number;
}

export interface Npc {
  id: string;
  kind: NpcKind;
  name: string;
  look: NpcLook;
  /** Crew members belong to a named crew. */
  crew?: string;
  /** Crew members' fighting level (3–15). */
  level?: number;
  /** Standing NPCs: fixed spot + yaw. Walkers: a route walked back and forth. */
  at?: WorldXZ;
  yaw?: number;
  route?: WorldXZ[];
  /** Metres per second along the route. */
  speed?: number;
  /** Phase offset on the route (metres). */
  phase?: number;
  /** For family members: the leader they walk beside, and their sideways offset. */
  follow?: string;
  offset?: number;
}

export interface CrewDef {
  id: string;
  name: string;
  area: string;
  colour: string;
  near: WorldXZ;
}

const SKINS = ['#f1c9a5', '#e0ac7e', '#c68a5e', '#9a6440', '#6e4428', '#f5d6bd', '#d29b70', '#4a2e1c'];
const HAIRS = ['#1a1410', '#3a2a1e', '#6b4a2b', '#a8794a', '#d8b67a', '#e8d6a8', '#8a2f1f', '#2a2a2a', '#bfbfbf'];
const TOPS = ['#2b3a55', '#5a2e2e', '#2e5a3e', '#6b6b6b', '#c8c0aa', '#1f1f24', '#8a5a9e', '#3a7bd5', '#e05555', '#f2f2f2', '#a0522d', '#ffd23f'];
const LEGS = ['#1d2433', '#2a2a2a', '#3c4a63', '#5a4a3a', '#14171f', '#6b6b6b'];
const SHOES = ['#f2f2f2', '#14171f', '#5a3a22', '#c8312b', '#3a3f47'];

const FIRST = [
  'Aleksi', 'Mohamed', 'Jenna', 'Ville', 'Amir', 'Sara', 'Nooa', 'Elias', 'Ilona', 'Yasmin', 'Kevin', 'Hamza', 'Emilia', 'Daniel',
  'Ahmed', 'Lotta', 'Joonas', 'Leo', 'Mustafa', 'Aino', 'Samir', 'Iida', 'Patrik', 'Abdi', 'Niko', 'Veera', 'Onni', 'Hanna',
  'Viktor', 'Leila', 'Tuomas', 'Fatima', 'Eero', 'Noora', 'Rasmus', 'Zainab', 'Juho', 'Milla', 'Oskari', 'Dina', 'Mikael', 'Anni',
];
const ELDER = ['Raimo', 'Pirjo', 'Seppo', 'Leena', 'Kalevi', 'Marjatta', 'Erkki', 'Tuula', 'Pentti', 'Sirkka'];
const NICK = ['Pikku', 'Iso', 'Hullu', 'Kylmä', 'Hiljainen', 'Nopee', 'Lil', 'Big', 'Kova'];

export const CREWS: CrewDef[] = [
  { id: 'laituri', name: 'Laiturin pojat', area: 'Asema', colour: '#c8312b', near: [40, 60] },
  { id: 'tunneli', name: 'Tunneli Gang', area: 'Asematunneli', colour: '#3a7bd5', near: [-60, 30] },
  { id: 'kaleva', name: 'Kaleva Crew', area: 'Kaleva', colour: '#2e9e5b', near: [-300, 420] },
  { id: 'ahjo', name: 'Ahjon Ässät', area: 'Ahjo', colour: '#ffd23f', near: [420, 60] },
  { id: 'kaskela', name: 'Kaskelan Kuninkaat', area: 'Kaskela', colour: '#8a5a9e', near: [520, -260] },
  { id: 'savio', name: 'Savio Squad', area: 'Savio', colour: '#f28c28', near: [80, 2380] },
];

const pick = <T,>(rng: () => number, a: readonly T[]): T => a[Math.floor(rng() * a.length)]!;

function look(rng: () => number, kind: NpcKind, crewColour?: string): NpcLook {
  const young = kind === 'crew' || kind === 'kid' || kind === 'jogger';
  const style = kind === 'crew' ? 'hoodie' : rng() < 0.5 ? 'jacket' : 'hoodie';
  const hairStyles: NpcLook['hairStyle'][] = kind === 'elder' ? ['short', 'sidepart', 'bald', 'long'] : ['short', 'buzz', 'sidepart', 'long', 'ponytail', 'afro', 'mohawk'];
  return {
    top: kind === 'crew' && rng() < 0.6 ? pick(rng, ['#1f1f24', '#2a2a2a', '#3c4a63', '#f2f2f2']) : kind === 'jogger' ? pick(rng, ['#e05555', '#3a7bd5', '#ffd23f', '#2e9e5b']) : pick(rng, TOPS),
    legs: kind === 'crew' ? pick(rng, ['#1f1f24', '#2a2a2a', '#6b6b6b']) : pick(rng, LEGS),
    shoes: pick(rng, SHOES),
    skin: pick(rng, SKINS),
    hair: kind === 'elder' ? pick(rng, ['#bfbfbf', '#e8e8e8', '#8a8a8a']) : pick(rng, HAIRS),
    hairStyle: pick(rng, hairStyles),
    facialHair: kind === 'kid' ? 'none' : rng() < (young ? 0.18 : 0.35) ? pick(rng, ['stubble', 'moustache', 'goatee', 'beard'] as const) : 'none',
    hat: kind === 'crew' ? (rng() < 0.55 ? pick(rng, ['beanie', 'cap'] as const) : 'none') : rng() < 0.2 ? 'beanie' : 'none',
    hatColor: crewColour && rng() < 0.6 ? crewColour : pick(rng, ['#14171f', '#c8312b', '#2b3a55', '#f2f2f2']),
    accent: crewColour ?? pick(rng, ['#ffd23f', '#e05555', '#f2f2f2', '#3a7bd5']),
    style,
    build: kind === 'kid' ? 0.85 : 0.9 + rng() * 0.25,
    height: kind === 'kid' ? 0.6 + rng() * 0.12 : kind === 'elder' ? 0.94 + rng() * 0.06 : 0.94 + rng() * 0.12,
    backpack: kind === 'crew' ? rng() < 0.3 : kind === 'kid' ? rng() < 0.7 : rng() < 0.15,
    glasses: kind === 'elder' ? rng() < 0.6 : rng() < 0.12,
  };
}

/** A walking route along a road, offset to the pavement on one side. */
function pavementRoute(r: Road, rng: () => number, maxLen: number): WorldXZ[] | null {
  if (r.points.length < 2) return null;
  const side = rng() < 0.5 ? -1 : 1;
  const off = (ROAD_WIDTH[r.kind] / 2 + (r.kind === 'path' ? 0.2 : 1.4)) * side;
  const start = Math.floor(rng() * (r.points.length - 1));
  const out: WorldXZ[] = [];
  let len = 0;
  for (let i = start; i < r.points.length && len < maxLen; i++) {
    const p = r.points[i]!, q = r.points[Math.min(i + 1, r.points.length - 1)]!, o = r.points[Math.max(0, i - 1)]!;
    const dx = q[0] - o[0], dz = q[1] - o[1], l = Math.hypot(dx, dz) || 1;
    const pt: WorldXZ = [p[0] - (dz / l) * off, p[1] + (dx / l) * off];
    if (out.length) len += Math.hypot(pt[0] - out[out.length - 1]![0], pt[1] - out[out.length - 1]![1]);
    out.push(pt);
  }
  return out.length >= 2 && len > 25 ? out : null;
}

export function routeLength(route: WorldXZ[]): number {
  let l = 0;
  for (let i = 1; i < route.length; i++) l += Math.hypot(route[i]![0] - route[i - 1]![0], route[i]![1] - route[i - 1]![1]);
  return l;
}

/** Position and heading on a ping-pong route at distance `s`. */
export function onRoute(route: WorldXZ[], total: number, s: number): { p: WorldXZ; yaw: number } {
  const period = total * 2;
  let d = ((s % period) + period) % period;
  const back = d > total;
  if (back) d = period - d;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!, b = route[i]!;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d <= l || i === route.length - 1) {
      const t = l > 0 ? Math.min(1, d / l) : 0;
      const dx = (b[0] - a[0]) * (back ? -1 : 1), dz = (b[1] - a[1]) * (back ? -1 : 1);
      return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], yaw: Math.atan2(dx, dz) };
    }
    d -= l;
  }
  const last = route[route.length - 1]!;
  return { p: last, yaw: 0 };
}

/**
 * Build the town's population. `ok` filters standing spots (not inside
 * buildings, not on rails); crews snap their hangouts near the given spots.
 */
export function populate(world: WorldData, ok: (p: WorldXZ) => boolean, extraHangouts: WorldXZ[] = []): Npc[] {
  const rng = createRng(77001);
  const npcs: Npc[] = [];
  let n = 0;
  const id = (k: string) => `${k}${n++}`;

  // crews: 3–5 members in a loose ring at their hangout
  for (const crew of CREWS) {
    const spots = [crew.near, ...extraHangouts.filter((_, i) => i % CREWS.length === CREWS.indexOf(crew))];
    for (const near of spots) {
      let centre: WorldXZ | null = null;
      for (let t = 0; t < 30 && !centre; t++) {
        const c: WorldXZ = [near[0] + (rng() - 0.5) * 30, near[1] + (rng() - 0.5) * 30];
        if (ok(c)) centre = c;
      }
      if (!centre) continue;
      const count = 3 + Math.floor(rng() * 3);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + rng() * 0.4;
        const r = 1.3 + rng() * 0.6;
        const at: WorldXZ = [centre[0] + Math.sin(a) * r, centre[1] + Math.cos(a) * r];
        const nm = rng() < 0.35 ? `${pick(rng, NICK)} ${pick(rng, FIRST)}` : pick(rng, FIRST);
        const cid = id('c');
        npcs.push({ id: cid, kind: 'crew', name: nm, crew: crew.id, level: roadmanLevel(cid), look: look(rng, 'crew', crew.colour), at, yaw: Math.atan2(centre[0] - at[0], centre[1] - at[1]) });
      }
    }
  }

  // walkers on streets and paths
  const roads = world.roads.filter((r) => r.kind === 'street' || r.kind === 'path' || r.kind === 'major');
  const walkers = 90;
  for (let i = 0, tries = 0; i < walkers && roads.length && tries < walkers * 6; tries++) {
    const r = pick(rng, roads);
    const route = pavementRoute(r, rng, 160);
    if (!route || !ok(route[0]!)) continue;
    const v = rng();
    const kind: NpcKind = v < 0.55 ? 'citizen' : v < 0.72 ? 'family' : v < 0.85 ? 'jogger' : 'elder';
    const speed = kind === 'jogger' ? 3.2 + rng() : kind === 'elder' ? 0.8 + rng() * 0.3 : 1.2 + rng() * 0.4;
    const phase = rng() * 400;
    const lead: Npc = { id: id('w'), kind, name: kind === 'elder' ? pick(rng, ELDER) : pick(rng, FIRST), look: look(rng, kind), route, speed, phase };
    npcs.push(lead);
    if (kind === 'family') {
      const kids = 1 + Math.floor(rng() * 2);
      if (rng() < 0.6) npcs.push({ id: id('w'), kind: 'citizen', name: pick(rng, FIRST), look: look(rng, 'citizen'), route, speed, phase, follow: lead.id, offset: 0.8 });
      for (let k = 0; k < kids; k++)
        npcs.push({ id: id('k'), kind: 'kid', name: pick(rng, FIRST), look: look(rng, 'kid'), route, speed, phase: phase - 0.8 - k * 0.9, follow: lead.id, offset: -0.7 - k * 0.2 });
    }
    i++;
  }
  for (const n of npcs) Object.assign(n.look, bodyFor(n));
  return npcs;
}

/** Varied bodies, stable per NPC: some townsfolk are heavy, some crew members hit the gym (or the roina). */
function bodyFor(n: Npc): { fat: number; muscle: number } {
  const h = [...n.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 99991);
  const r1 = (h % 1000) / 1000, r2 = ((h >>> 10) % 1000) / 1000;
  switch (n.kind) {
    case 'crew':
      return { fat: r1 < 0.2 ? 0.4 + r2 * 0.4 : r2 * 0.15, muscle: r1 > 0.75 ? 0.5 + r2 * 0.5 : r1 * 0.3 };
    case 'citizen':
    case 'family':
      return { fat: r1 < 0.35 ? 0.35 + r2 * 0.6 : r2 * 0.25, muscle: r1 > 0.9 ? 0.4 + r2 * 0.3 : 0 };
    case 'elder':
      return { fat: r1 < 0.5 ? 0.3 + r2 * 0.5 : 0.1, muscle: 0 };
    case 'jogger':
      return { fat: 0, muscle: r2 * 0.3 };
    case 'kid':
      return { fat: r1 < 0.2 ? 0.4 : 0, muscle: 0 };
  }
}
