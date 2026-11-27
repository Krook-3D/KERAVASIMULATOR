/**
 * One game world (like "Kerava 1"): who is online, where they are, and who
 * sees whom. Positions here are not economy data; the authoritative rules
 * are speed and bounds checks. See docs/MULTIPLAYER.md sections 4 and 6.
 */
import { DEFAULT_SCENE, type AnimState, type PlayerLook, type PublicPlayer, type ServerMessage } from '../../../shared/protocol';
import { SpatialGrid } from './grid';

export interface WorldOptions {
  /** Max accepted speed in m/s (walk is 7, running will be faster). */
  maxSpeed: number;
  /** Multiplier on allowed distance to absorb network jitter. */
  tolerance: number;
  /** Half-size of the playable square around the station, metres. */
  boundsM: number;
  /** Corrections allowed per minute before the player is flagged. */
  maxCorrectionsPerMinute: number;
  /** Minimum time between warps (doors, bus, train), ms. */
  warpCooldownMs: number;
}

export const DEFAULT_WORLD_OPTIONS: WorldOptions = { maxSpeed: 10, tolerance: 1.25, boundsM: 3000, maxCorrectionsPerMinute: 20, warpCooldownMs: 1500 };

export type Send = (msg: ServerMessage) => void;

export interface WorldPlayer extends PublicPlayer {
  send: Send;
  lastMoveAt: number;
  joinedAt: number;
  corrections: number[];
  lastWarpAt?: number;
  /** Set when a player repeatedly fails movement checks. */
  flagged?: boolean;
}

interface PendingMove {
  id: string;
  x: number;
  z: number;
  tx?: number;
  tz?: number;
  anim?: AnimState;
  scene?: string;
}

export class World {
  readonly players = new Map<string, WorldPlayer>();
  private grid = new SpatialGrid();
  private pending = new Map<string, PendingMove>();

  constructor(
    readonly name: string,
    private opts: WorldOptions = DEFAULT_WORLD_OPTIONS,
    private onFlag: (id: string, reason: string) => void = () => {},
  ) {}

  get size(): number {
    return this.players.size;
  }

  join(p: Omit<WorldPlayer, 'lastMoveAt' | 'joinedAt' | 'corrections'>, now = Date.now()): WorldPlayer {
    if (this.players.has(p.id)) this.leave(p.id);
    const [x, z] = this.clamp(p.x, p.z);
    const player: WorldPlayer = { scene: DEFAULT_SCENE, ...p, x, z, lastMoveAt: now, joinedAt: now, corrections: [] };
    this.players.set(player.id, player);
    const change = this.grid.set(player.id, x, z)!;
    const visible = [...this.grid.around(change.to)].filter((id) => id !== player.id);
    player.send({ t: 'snapshot', players: visible.map((id) => this.publicOf(this.players.get(id)!)) });
    for (const id of visible) this.players.get(id)!.send({ t: 'player.join', player: this.publicOf(player) });
    return player;
  }

  leave(id: string): WorldPlayer | undefined {
    const player = this.players.get(id);
    if (!player) return;
    const cell = this.grid.cellOfId(id);
    this.grid.remove(id);
    this.players.delete(id);
    this.pending.delete(id);
    if (cell) for (const other of this.grid.around(cell)) this.players.get(other)?.send({ t: 'player.leave', id });
    return player;
  }

  /**
   * Applies a client-reported position. Rejects impossible movement and sends
   * a correction back. Returns false if rejected.
   */
  move(id: string, m: { x: number; z: number; tx?: number; tz?: number; anim?: AnimState }, now = Date.now()): boolean {
    const p = this.players.get(id);
    if (!p) return false;
    const dt = Math.max(0, now - p.lastMoveAt) / 1000;
    // Allow a small fixed slack so the first packet after a pause is not rejected.
    const allowed = this.opts.maxSpeed * dt * this.opts.tolerance + 0.5;
    const dist = Math.hypot(m.x - p.x, m.z - p.z);
    const inBounds = Math.abs(m.x) <= this.opts.boundsM && Math.abs(m.z) <= this.opts.boundsM;
    if (dist > allowed || !inBounds) {
      p.corrections = p.corrections.filter((t) => now - t < 60_000);
      p.corrections.push(now);
      if (p.corrections.length > this.opts.maxCorrectionsPerMinute && !p.flagged) {
        p.flagged = true;
        this.onFlag(id, 'movement');
      }
      // Do not advance lastMoveAt: legit clients catch up on the next packet.
      p.send({ t: 'correction', x: p.x, z: p.z });
      return false;
    }
    this.apply(p, m, now);
    return true;
  }


  /**
   * A jump the client says is legitimate (a door, the bus, the train, jail).
   * Skips the speed check but is rate limited; positions carry no economy
   * value, and trades and activities check distance and scene anyway.
   */
  warp(id: string, m: { x: number; z: number; scene: string }, now = Date.now()): boolean {
    const p = this.players.get(id);
    if (!p) return false;
    const inBounds = Math.abs(m.x) <= this.opts.boundsM && Math.abs(m.z) <= this.opts.boundsM;
    if (!inBounds || (p.lastWarpAt !== undefined && now - p.lastWarpAt < this.opts.warpCooldownMs)) {
      p.send({ t: 'correction', x: p.x, z: p.z });
      return false;
    }
    p.lastWarpAt = now;
    this.apply(p, { x: m.x, z: m.z, anim: 'idle' }, now, m.scene);
    return true;
  }

  /** Stores the look and shows it to everyone in view. */
  setLook(id: string, look: PlayerLook): void {
    const p = this.players.get(id);
    const cell = this.grid.cellOfId(id);
    if (!p || !cell) return;
    p.look = look;
    for (const other of this.grid.around(cell)) if (other !== id) this.players.get(other)?.send({ t: 'player.look', id, look });
  }

  private apply(p: WorldPlayer, m: { x: number; z: number; tx?: number; tz?: number; anim?: AnimState }, now: number, scene = p.scene): void {
    const id = p.id;
    p.x = m.x;
    p.z = m.z;
    p.tx = m.tx;
    p.tz = m.tz;
    p.anim = m.anim;
    p.lastMoveAt = now;
    p.scene = scene;
    this.pending.set(id, { id, x: m.x, z: m.z, tx: m.tx, tz: m.tz, anim: m.anim, scene });

    const change = this.grid.set(id, m.x, m.z);
    if (change) {
      const { entered, left } = this.grid.diff(change.from, change.to);
      entered.delete(id);
      left.delete(id);
      for (const other of entered) {
        const o = this.players.get(other)!;
        o.send({ t: 'player.join', player: this.publicOf(p) });
        p.send({ t: 'player.join', player: this.publicOf(o) });
      }
      for (const other of left) {
        this.players.get(other)?.send({ t: 'player.leave', id });
        p.send({ t: 'player.leave', id: other });
      }
    }
  }

  /** Flushes batched moves to everyone who can see them. Called every tick. */
  tick(): void {
    if (this.pending.size === 0) return;
    const outbox = new Map<string, PendingMove[]>();
    for (const move of this.pending.values()) {
      const cell = this.grid.cellOfId(move.id);
      if (!cell) continue;
      for (const viewer of this.grid.around(cell)) {
        if (viewer === move.id) continue;
        let list = outbox.get(viewer);
        if (!list) outbox.set(viewer, (list = []));
        list.push(move);
      }
    }
    this.pending.clear();
    for (const [viewer, moves] of outbox) this.players.get(viewer)?.send({ t: 'player.move', moves });
  }

  /** Local chat: everyone in view, including the sender. */
  chat(id: string, text: string): void {
    const p = this.players.get(id);
    const cell = this.grid.cellOfId(id);
    if (!p || !cell) return;
    for (const other of this.grid.around(cell)) {
      const o = this.players.get(other);
      if (o && o.scene === p.scene) o.send({ t: 'chat', from: id, name: p.name, text });
    }
  }

  distance(a: string, b: string): number {
    const pa = this.players.get(a);
    const pb = this.players.get(b);
    if (!pa || !pb || pa.scene !== pb.scene) return Infinity;
    return Math.hypot(pa.x - pb.x, pa.z - pb.z);
  }

  broadcast(msg: ServerMessage): void {
    for (const p of this.players.values()) p.send(msg);
  }

  publicOf(p: WorldPlayer): PublicPlayer {
    return { id: p.id, name: p.name, color: p.color, level: p.level, x: p.x, z: p.z, tx: p.tx, tz: p.tz, anim: p.anim, look: p.look, scene: p.scene };
  }

  private clamp(x: number, z: number): [number, number] {
    const b = this.opts.boundsM;
    return [Math.max(-b, Math.min(b, x)), Math.max(-b, Math.min(b, z))];
  }
}
