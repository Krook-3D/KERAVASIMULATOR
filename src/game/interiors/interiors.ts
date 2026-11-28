import type { WorldXZ } from '../world/projection';

/**
 * Interiors are separate small scenes (RuneScape-style, roofless so the
 * camera can look in from above). Each has its own local coordinates with
 * the floor at y = 0. Exits link to a door in the world or to another
 * interior's exit.
 */
export type InteriorId = 'tunnel' | 'station' | 'prisma' | 'prison' | 'gym' | 'pool' | 'alepa' | 'barber' | 'police' | 'motonet' | 'krauta' | 'fightgym';
export type SceneId = 'world' | InteriorId;

/** Doors placed in the 3D town (positions are worked out at runtime). */
export type WorldDoorId = 'tunnel-town' | 'tunnel-east' | 'station-platform' | 'station-town' | 'prisma' | 'prison-yard' | 'gym' | 'pool' | 'alepa' | 'barber' | 'police' | 'motonet' | 'krauta' | 'fightgym';

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type Link = { scene: 'world'; door: WorldDoorId } | { scene: InteriorId; exit: string };

export interface Exit {
  id: string;
  /** Hotspot: walking here uses the exit. */
  at: WorldXZ;
  /** Where you appear when arriving through this exit, and facing. */
  spawn: WorldXZ;
  yaw: number;
  label: string;
  to: Link;
}

export interface InteriorDef {
  id: InteriorId;
  name: string;
  /** Walkable floor area (click target). */
  floor: Rect;
  /** Walls and furniture you cannot walk through. */
  solids: Rect[];
  exits: Exit[];
}

const R = (minX: number, maxX: number, minZ: number, maxZ: number): Rect => ({ minX, maxX, minZ, maxZ });

/** Walls of a room as four thin rects, with door gaps given as [side, centre, width]. */
export function roomWalls(r: Rect, t: number, gaps: ['n' | 's' | 'w' | 'e', number, number][] = []): Rect[] {
  const out: Rect[] = [];
  const side = (s: 'n' | 's' | 'w' | 'e', from: number, to: number, make: (a: number, b: number) => Rect) => {
    const gs = gaps.filter((g) => g[0] === s).map((g) => [g[1] - g[2] / 2, g[1] + g[2] / 2] as const).sort((a, b) => a[0] - b[0]);
    let cur = from;
    for (const [a, b] of gs) {
      if (a > cur) out.push(make(cur, a));
      cur = Math.max(cur, b);
    }
    if (cur < to) out.push(make(cur, to));
  };
  side('n', r.minX, r.maxX, (a, b) => R(a, b, r.minZ - t, r.minZ));
  side('s', r.minX, r.maxX, (a, b) => R(a, b, r.maxZ, r.maxZ + t));
  side('w', r.minZ, r.maxZ, (a, b) => R(r.minX - t, r.minX, a, b));
  side('e', r.minZ, r.maxZ, (a, b) => R(r.maxX, r.maxX + t, a, b));
  return out;
}

// ------------------------------------------------------------ station tunnel
// Pedestrian underpass under the tracks: town side (west end) to the east
// side, with a branch up to the station hall.
export const TUNNEL_MAIN = R(-24, 24, -2.6, 2.6);
export const TUNNEL_BRANCH = R(-14, -9, -9, -2.6); // stairs up into the station building
const tunnel: InteriorDef = {
  id: 'tunnel',
  name: 'Asematunneli',
  floor: R(-27, 27, -9, 2.6),
  solids: [
    ...roomWalls(TUNNEL_MAIN, 0.4, [['n', -11.5, 5], ['w', 0, 5.2], ['e', 0, 5.2]]),
    ...roomWalls(TUNNEL_BRANCH, 0.4, [['s', -11.5, 5]]),
    R(-28, -27.4, -3, 3), // stair ends
    R(27.4, 28, -3, 3),
  ],
  exits: [
    { id: 'town', at: [-26, 0], spawn: [-22, 0], yaw: Math.PI / 2, label: 'Portaat ylös: keskusta ⬆', to: { scene: 'world', door: 'tunnel-town' } },
    { id: 'east', at: [26, 0], spawn: [22, 0], yaw: -Math.PI / 2, label: 'Portaat ylös: radan itäpuoli ⬆', to: { scene: 'world', door: 'tunnel-east' } },
    { id: 'station', at: [-11.5, -8.2], spawn: [-11.5, -5.5], yaw: 0, label: 'Asemahalliin ⬆', to: { scene: 'station', exit: 'tunnel' } },
  ],
};

// ------------------------------------------------------------ station hall
export const STATION_HALL = R(-13, 13, -4.5, 4.5);
const station: InteriorDef = {
  id: 'station',
  name: 'Keravan asema',
  floor: STATION_HALL,
  solids: [
    ...roomWalls(STATION_HALL, 0.5, [['n', 0, 2.4], ['s', 0, 2.4]]),
    R(-13, -8.5, 2.9, 4.5), // ticket counter
    R(8.6, 13, -4.5, -2.6), // kiosk counter
    R(11.4, 13, -2.6, 2), // kiosk shelves
    R(-4.2, -1.2, -0.45, 0.45), // benches
    R(1.2, 4.2, -0.45, 0.45),
    R(-4.2, -1.2, 2.3, 3.2),
    R(6.1, 6.9, 3.6, 4.5), // ticket machine
    R(-13, -7.6, -4.5, -1.6), // tunnel stair well (rail)
  ],
  exits: [
    { id: 'platform', at: [0, -4.1], spawn: [0, -2.6], yaw: 0, label: 'Laiturille', to: { scene: 'world', door: 'station-platform' } },
    { id: 'town', at: [0, 4.1], spawn: [0, 2.2], yaw: Math.PI, label: 'Asema-aukiolle', to: { scene: 'world', door: 'station-town' } },
    { id: 'tunnel', at: [-7.1, -3.1], spawn: [-6.2, -2.4], yaw: Math.PI / 2, label: 'Tunneliin ⬇', to: { scene: 'tunnel', exit: 'station' } },
  ],
};

// ------------------------------------------------------------ Prisma
export const PRISMA_HALL = R(-32, 32, -22, 22);
export const PRISMA_SHELF_XS = [-6, -0.5, 5, 10.5, 16, 21.5, 27];
export const PRISMA_SHELF_Z = { minZ: -15, maxZ: 5 };
export const PRISMA_CHECKOUT_XS = [-2, 3.5, 9, 14.5, 20, 25.5];
const prismaSolids: Rect[] = [
  ...roomWalls(PRISMA_HALL, 0.6, [['s', -20, 6]]),
  // aisles
  ...PRISMA_SHELF_XS.map((x) => R(x - 0.7, x + 0.7, PRISMA_SHELF_Z.minZ, PRISMA_SHELF_Z.maxZ)),
  // fridges along the back wall and the bakery along the west wall
  R(-32, 32, -22, -20.6),
  R(-32, -30.4, -20, -6),
  // fruit tables
  R(-27, -23, -2, 1), R(-20, -16, -2, 1), R(-27, -23, 4, 7), R(-20, -16, 4, 7),
  // checkout counters
  ...PRISMA_CHECKOUT_XS.map((x) => R(x - 0.5, x + 0.5, 10, 14)),
  // entrance divider between in and out lanes
  R(-12, -11.4, 9, 22),
];
const prisma: InteriorDef = {
  id: 'prisma',
  name: 'Prisma Kerava',
  floor: PRISMA_HALL,
  solids: prismaSolids,
  exits: [{ id: 'main', at: [-20, 21.4], spawn: [-20, 18.5], yaw: Math.PI, label: 'Ulos', to: { scene: 'world', door: 'prisma' } }],
};

// ------------------------------------------------------------ prison
// A short cell block: corridor along x, cells on the north side, the guard
// desk and the exit at the east end, visiting room on the south side.
export const PRISON_CORRIDOR = R(-17, 17, -1.6, 1.6);
export const PRISON_CELL_XS = [-13, -7, -1, 5];
export const PLAYER_CELL_X = -7;
export const PRISON_CELL = { width: 5, minZ: -6.5, maxZ: -1.6 };
export const PRISON_EXIT: WorldXZ = [16.6, 0];
export const GUARD_DESK: WorldXZ = [13.2, -2.6];
/** The bars of the player's cell (removed once filed through). */
export const PLAYER_BARS = R(PLAYER_CELL_X - 2.5, PLAYER_CELL_X + 2.5, -1.75, -1.45);
const prisonSolids: Rect[] = [
  R(-18, 18, -7, -6.5), // back wall of cells
  R(-18, -17, -7, 2.1), // west wall
  R(-18, 18, 1.6, 2.1), // south wall
  R(17, 18, -7, -0.9), R(17, 18, 0.9, 2.1), // east wall with the exit
  ...[-16, -10, -4, 2, 8].map((x) => R(x - 0.25, x + 0.25, -6.5, -1.6)), // cell dividers
  ...PRISON_CELL_XS.filter((x) => x !== PLAYER_CELL_X).map((x) => R(x - 2.5, x + 2.5, -1.75, -1.45)), // other cells' bars
  R(8.25, 17, -6.5, -1.6), // guard room wall block
  R(12, 14.4, -1.6, -1.0), // desk front
  R(-7, -4.5, -6.4, -5.2), // bunk in the player's cell
];
const prison: InteriorDef = {
  id: 'prison',
  name: 'Keravan vankila, osasto B',
  floor: R(-17, 17, -6.5, 1.6),
  solids: prisonSolids,
  exits: [{ id: 'yard', at: PRISON_EXIT, spawn: [15, 0], yaw: -Math.PI / 2, label: 'Ovi ulos', to: { scene: 'world', door: 'prison-yard' } }],
};

// ------------------------------------------------------------ gym
// One hall: bench press, squat rack and deadlift platform along the back
// wall, plate tree in the middle, dumbbells and cardio on the sides.
export const GYM_HALL = R(-11, 11, -8, 8);
export interface GymStation {
  lift: 'bench' | 'squat' | 'deadlift';
  /** Where the player stands to load the bar and start a set. */
  use: WorldXZ;
  /** Centre of the bar (x, z) when it rests. */
  bar: WorldXZ;
}
export const GYM_STATIONS: GymStation[] = [
  { lift: 'bench', use: [-6, -1.6], bar: [-6, -4.55] },
  { lift: 'squat', use: [0, -2.6], bar: [0, -5.6] },
  { lift: 'deadlift', use: [6, -2.4], bar: [6, -4.6] },
];
export const GYM_PLATE_TREE: WorldXZ = [0, 0.6];
export const GYM_PLATE_SPOT: WorldXZ = [0, 1.9];
const gym: InteriorDef = {
  id: 'gym',
  name: 'Kuntosali Rauta',
  floor: GYM_HALL,
  solids: [
    ...roomWalls(GYM_HALL, 0.4, [['s', 0, 2.4]]),
    R(-6.35, -5.65, -5.3, -2.7), // bench
    R(-7.2, -4.8, -5.2, -4.85), // bench uprights
    R(-1.6, 1.6, -7.2, -6.0), // squat rack frame
    R(-1.6, -1.3, -6.0, -4.8), R(1.3, 1.6, -6.0, -4.8),
    R(3.5, 8.5, -5.6, -3.4), // deadlift platform edge (bar on it)
    R(-0.6, 0.6, 0.0, 1.2), // plate tree
    R(-11, -9.8, -6, 5), // dumbbell rack
    R(9.6, 11, -6, 5), // treadmills
    R(-11, -5.5, 6.2, 8), // reception
  ],
  exits: [{ id: 'main', at: [0, 7.4], spawn: [0, 5.4], yaw: Math.PI, label: 'Ulos', to: { scene: 'world', door: 'gym' } }],
};

// ------------------------------------------------------------ swimming hall
export const POOL_HALL = R(-17, 17, -12, 12);
export const POOL_BASIN = R(-12.5, 12.5, -9, 1);
export const POOL_SWIM_SPOT: WorldXZ = [-13.3, -4];
const pool: InteriorDef = {
  id: 'pool',
  name: 'Keravan uimahalli',
  floor: POOL_HALL,
  solids: [
    ...roomWalls(POOL_HALL, 0.5, [['s', -11, 2.4]]),
    POOL_BASIN,
    R(-5, 5, 5.5, 12), // changing rooms block
    R(10, 17, 4.5, 12), // sauna
    R(13.6, 14.6, -6.6, -5.4), // lifeguard chair
  ],
  exits: [{ id: 'main', at: [-11, 11.4], spawn: [-11, 9.4], yaw: Math.PI, label: 'Ulos', to: { scene: 'world', door: 'pool' } }],
};

// ------------------------------------------------------------ Alepa (Savio)
export const ALEPA_HALL = R(-10, 10, -7, 7);
export const ALEPA_SHELF_XS = [-5.5, -1.5, 2.5];
const alepa: InteriorDef = {
  id: 'alepa',
  name: 'Alepa Savio',
  floor: ALEPA_HALL,
  solids: [
    ...roomWalls(ALEPA_HALL, 0.4, [['s', -6.5, 2.4]]),
    ...ALEPA_SHELF_XS.map((x) => R(x - 0.55, x + 0.55, -4.5, 2.5)),
    R(-10, 10, -7, -6.1), // fridges
    R(6.5, 10, -6, 1), // bread and veg corner
    R(3.6, 7.6, 4.0, 5.1), // checkout counter
  ],
  exits: [{ id: 'main', at: [-6.5, 6.4], spawn: [-6.5, 4.6], yaw: Math.PI, label: 'Ulos', to: { scene: 'world', door: 'alepa' } }],
};

// ------------------------------------------------------------ barber
export const BARBER_ROOM = R(-6, 6, -5, 5);
export const BARBER_CHAIR_SPOT: WorldXZ = [-1.5, -1.4];
const barber: InteriorDef = {
  id: 'barber',
  name: 'Parturi-kampaamo Sakset',
  floor: BARBER_ROOM,
  solids: [
    ...roomWalls(BARBER_ROOM, 0.3, [['s', 3.5, 2]]),
    R(-6, 6, -5, -4.4), // mirror counter
    R(-2.0, -1.0, -3.4, -2.2), // chair 1
    R(1.0, 2.0, -3.4, -2.2), // chair 2
    R(-6, -4.6, 1, 5), // waiting bench
    R(4.2, 6, 0.5, 2.5), // till desk
  ],
  exits: [{ id: 'main', at: [3.5, 4.5], spawn: [3.5, 3], yaw: Math.PI, label: 'Ulos', to: { scene: 'world', door: 'barber' } }],
};

// ------------------------------------------------------------ police station
// Lobby with the front desk in the south half, the holding cells ("putka")
// along the north wall behind a locked corridor door.
export const POLICE_HALL = R(-12, 12, -8, 8);
export const POLICE_CELL_XS = [-9, -4.5, 0, 4.5];
export const POLICE_PLAYER_CELL_X = -4.5;
export const POLICE_CELL = { width: 4.2, minZ: -8, maxZ: -3.6 };
export const POLICE_CELL_SPAWN: WorldXZ = [POLICE_PLAYER_CELL_X, -6];
export const POLICE_DESK: WorldXZ = [4, 2.6];
export const POLICE_DESK_SPOT: WorldXZ = [4, 4.6];
/** Bars of the player's holding cell (open once released). */
export const POLICE_BARS = R(POLICE_PLAYER_CELL_X - 2.1, POLICE_PLAYER_CELL_X + 2.1, -3.75, -3.45);
/** Corridor door between the lobby and the cells (locked from the lobby side). */
export const POLICE_CORRIDOR_DOOR = R(-12, 12, -1.15, -0.85);
const police: InteriorDef = {
  id: 'police',
  name: 'Keravan poliisiasema',
  floor: POLICE_HALL,
  solids: [
    ...roomWalls(POLICE_HALL, 0.4, [['s', 8, 2.4]]),
    // cell side walls
    ...[-11.1, -6.75, -2.25, 2.25, 6.75].map((x) => R(x - 0.12, x + 0.12, -8, -3.6)),
    R(6.75, 12, -8, -3.6), // archive room
    // cell bars except the player's (that one comes from POLICE_BARS while locked)
    ...POLICE_CELL_XS.filter((x) => x !== POLICE_PLAYER_CELL_X).map((x) => R(x - 2.1, x + 2.1, -3.75, -3.45)),
    // corridor wall with a door gap at x 9 (kept open once you're released)
    R(-12, 7.8, -1.15, -0.85),
    R(10.2, 12, -1.15, -0.85),
    R(1.2, 6.8, 1.9, 3.1), // front desk
    R(-11.6, -8.4, 3.5, 7.6), // waiting benches
  ],
  exits: [{ id: 'main', at: [8, 7.4], spawn: [8, 5.6], yaw: Math.PI, label: 'Ulos', to: { scene: 'world', door: 'police' } }],
};

// ------------------------------------------------------------ Motonet (paints, tools, car stuff)
export const MOTONET_HALL = R(-14, 14, -10, 10);
export const MOTONET_SHELF_XS = [-7, -1, 5];
const motonet: InteriorDef = {
  id: 'motonet',
  name: 'Motonet Kerava',
  floor: MOTONET_HALL,
  solids: [
    ...roomWalls(MOTONET_HALL, 0.5, [['s', -9, 2.6]]),
    ...MOTONET_SHELF_XS.map((x) => R(x - 0.7, x + 0.7, -7, 3)),
    R(-14, 14, -10, -8.8), // back wall racks (tyres, oil)
    R(9.5, 14, -8, 0), // tool wall
    R(4, 9, 5.6, 7), // checkout
    R(-14, -12, -7, 3), // building materials rack
  ],
  exits: [{ id: 'main', at: [-9, 9.4], spawn: [-9, 7.4], yaw: Math.PI, label: 'Ulos', to: { scene: 'world', door: 'motonet' } }],
};

// ------------------------------------------------------------ K-Rauta (building materials)
export const KRAUTA_HALL = R(-15, 15, -11, 11);
export const KRAUTA_RACK_XS = [-8, -2, 4];
const krauta: InteriorDef = {
  id: 'krauta',
  name: 'K-Rauta Kerava',
  floor: KRAUTA_HALL,
  solids: [
    ...roomWalls(KRAUTA_HALL, 0.5, [['s', -10, 2.8]]),
    ...KRAUTA_RACK_XS.map((x) => R(x - 0.9, x + 0.9, -8, 2.5)),
    R(-15, 15, -11, -9.6), // back wall: timber racks
    R(10, 15, -8, -1), // garden corner
    R(5, 10, 6.4, 7.8), // checkout
  ],
  exits: [{ id: 'main', at: [-10, 10.4], spawn: [-10, 8.4], yaw: Math.PI, label: 'Ulos', to: { scene: 'world', door: 'krauta' } }],
};

// ------------------------------------------------------------ Ahjo Training Center (combat gym)
// Boxing ring in the north-west, heavy bags along the north wall, wrestling
// mats in the east half, reception by the door.
export const FIGHT_HALL = R(-12, 12, -9, 9);
export const FIGHT_RING = R(-9, -1, -7.5, 0.5);
export const FIGHT_BAG_XS = [3.5, 6.5, 9.5];
export const FIGHT_BAG_Z = -6.6;
export const FIGHT_MAT = R(1.5, 11, -2.5, 5);
/** Hotspots: heavy bag, wrestling mat (with the coach) and the ring (sparring). */
export const FIGHT_SPOTS = {
  bag: [6.5, -4.9] as WorldXZ,
  wrestle: [4.5, 1.2] as WorldXZ,
  spar: [-5, 1.8] as WorldXZ,
};
const fightgym: InteriorDef = {
  id: 'fightgym',
  name: 'Ahjo Training Center',
  floor: FIGHT_HALL,
  solids: [
    ...roomWalls(FIGHT_HALL, 0.4, [['s', 8, 2.4]]),
    FIGHT_RING,
    ...FIGHT_BAG_XS.map((x) => R(x - 0.45, x + 0.45, FIGHT_BAG_Z - 0.45, FIGHT_BAG_Z + 0.45)),
    R(-12, -6.5, 6.6, 9), // reception
    R(-12, -10.8, -7, 4), // bench and lockers
  ],
  exits: [{ id: 'main', at: [8, 8.4], spawn: [8, 6.6], yaw: Math.PI, label: 'Ulos', to: { scene: 'world', door: 'fightgym' } }],
};

export const INTERIORS: Record<InteriorId, InteriorDef> = { tunnel, station, prisma, prison, gym, pool, alepa, barber, police, motonet, krauta, fightgym };

export const inRect = (r: Rect, [x, z]: WorldXZ, pad = 0) => x >= r.minX - pad && x <= r.maxX + pad && z >= r.minZ - pad && z <= r.maxZ + pad;

/** Axis-aligned collider for interiors. */
export class RectCollider {
  constructor(private rects: Rect[]) {}
  isBlocked(p: WorldXZ, radius = 0.3): boolean {
    return this.rects.some((r) => inRect(r, p, radius));
  }
}
