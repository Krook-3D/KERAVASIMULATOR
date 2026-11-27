import { describe, expect, it } from 'vitest';
import type { ServerMessage } from '../../shared/protocol';
import { SpatialGrid } from '../src/presence/grid';
import { World } from '../src/presence/world';

function player(id: string, x: number, z: number, inbox: ServerMessage[]) {
  return { id, name: id, color: '#ffffff', level: 1, x, z, send: (m: ServerMessage) => inbox.push(m) };
}

describe('SpatialGrid', () => {
  it('sees own and neighbouring cells only', () => {
    const g = new SpatialGrid(64);
    g.set('a', 0, 0);
    g.set('b', 100, 0); // neighbour cell
    g.set('c', 500, 0); // far away
    expect([...g.around(g.cellOfId('a')!)].sort()).toEqual(['a', 'b']);
  });
});

describe('World', () => {
  it('sends snapshot and join to nearby players only', () => {
    const w = new World('t');
    const a: ServerMessage[] = [];
    const b: ServerMessage[] = [];
    const c: ServerMessage[] = [];
    w.join(player('a', 0, 0, a));
    w.join(player('b', 10, 0, b));
    w.join(player('c', 1000, 0, c));
    expect(b[0]).toMatchObject({ t: 'snapshot', players: [{ id: 'a' }] });
    expect(a).toContainEqual(expect.objectContaining({ t: 'player.join', player: expect.objectContaining({ id: 'b' }) }));
    expect(a.some((m) => m.t === 'player.join' && m.player.id === 'c')).toBe(false);
    expect(c[0]).toEqual({ t: 'snapshot', players: [] });
  });

  it('batches moves per tick to viewers', () => {
    const w = new World('t');
    const a: ServerMessage[] = [];
    const b: ServerMessage[] = [];
    w.join(player('a', 0, 0, a), 0);
    w.join(player('b', 5, 0, b), 0);
    expect(w.move('a', { x: 3, z: 0, tx: 10, tz: 0, anim: 'walk' }, 1000)).toBe(true);
    w.tick();
    expect(b.at(-1)).toEqual({ t: 'player.move', moves: [{ id: 'a', x: 3, z: 0, tx: 10, tz: 0, anim: 'walk', scene: 'world' }] });
    expect(a.some((m) => m.t === 'player.move')).toBe(false);
  });

  it('rejects teleports and sends a correction', () => {
    const w = new World('t');
    const a: ServerMessage[] = [];
    w.join(player('a', 0, 0, a), 0);
    expect(w.move('a', { x: 500, z: 0 }, 1000)).toBe(false);
    expect(a.at(-1)).toEqual({ t: 'correction', x: 0, z: 0 });
    // Legit movement afterwards still works (time kept accumulating).
    expect(w.move('a', { x: 12, z: 0 }, 2000)).toBe(true);
  });

  it('flags repeated speed hacks', () => {
    const flagged: string[] = [];
    const w = new World('t', undefined, (id) => flagged.push(id));
    w.join(player('a', 0, 0, []), 0);
    for (let i = 1; i <= 25; i++) w.move('a', { x: 1000, z: 0 }, i * 10);
    expect(flagged).toEqual(['a']);
  });

  it('joins and leaves as players cross cells', () => {
    const w = new World('t');
    const a: ServerMessage[] = [];
    const b: ServerMessage[] = [];
    w.join(player('a', 0, 0, a), 0);
    w.join(player('b', 300, 0, b), 0);
    expect(a.some((m) => m.t === 'player.join')).toBe(false);
    // b walks towards a over 30 s at 7 m/s.
    let x = 300;
    for (let t = 1; t <= 30; t++) {
      x -= 7;
      w.move('b', { x, z: 0 }, t * 1000);
    }
    expect(a).toContainEqual(expect.objectContaining({ t: 'player.join' }));
    w.leave('b');
    expect(a.at(-1)).toEqual({ t: 'player.leave', id: 'b' });
  });

  it('local chat reaches nearby players and the sender', () => {
    const w = new World('t');
    const a: ServerMessage[] = [];
    const b: ServerMessage[] = [];
    const c: ServerMessage[] = [];
    w.join(player('a', 0, 0, a));
    w.join(player('b', 20, 0, b));
    w.join(player('c', 2000, 0, c));
    w.chat('a', 'moi');
    for (const box of [a, b]) expect(box.at(-1)).toEqual({ t: 'chat', from: 'a', name: 'a', text: 'moi' });
    expect(c.some((m) => m.t === 'chat')).toBe(false);
  });

  it('accepts a warp (door, bus) but not two in quick succession', () => {
    const w = new World('t');
    const a: ServerMessage[] = [];
    const b: ServerMessage[] = [];
    w.join(player('a', 0, 0, a), 0);
    w.join(player('b', 5, 0, b), 0);
    expect(w.warp('a', { x: 2, z: 3, scene: 'prisma' }, 1000)).toBe(true);
    w.tick();
    expect(b.at(-1)).toEqual({ t: 'player.move', moves: [{ id: 'a', x: 2, z: 3, anim: 'idle', scene: 'prisma' }] });
    expect(w.warp('a', { x: 900, z: 0, scene: 'world' }, 1500)).toBe(false);
    expect(a.at(-1)).toEqual({ t: 'correction', x: 2, z: 3 });
    expect(w.warp('a', { x: 900, z: 0, scene: 'world' }, 3000)).toBe(true);
  });

  it('keeps chat and trading distance inside one scene', () => {
    const w = new World('t');
    const a: ServerMessage[] = [];
    const b: ServerMessage[] = [];
    w.join(player('a', 0, 0, a), 0);
    w.join(player('b', 1, 0, b), 0);
    expect(w.distance('a', 'b')).toBeCloseTo(1);
    w.warp('a', { x: 0, z: 0, scene: 'prisma' }, 1000);
    expect(w.distance('a', 'b')).toBe(Infinity);
    w.chat('a', 'moi');
    expect(b.some((m) => m.t === 'chat')).toBe(false);
    expect(a.some((m) => m.t === 'chat')).toBe(true);
  });

  it('shares looks with players in view', () => {
    const w = new World('t');
    const a: ServerMessage[] = [];
    const b: ServerMessage[] = [];
    w.join(player('a', 0, 0, a), 0);
    const look = { a: { skin: '#efc19b', hairStyle: 'afro', glasses: true }, fat: 0.2, muscle: 0.5 };
    w.setLook('a', look);
    w.join(player('b', 3, 0, b), 0);
    expect(b[0]).toMatchObject({ t: 'snapshot', players: [{ id: 'a', look }] });
    w.setLook('a', { ...look, fat: 0.4 });
    expect(b.at(-1)).toMatchObject({ t: 'player.look', id: 'a' });
  });
});
