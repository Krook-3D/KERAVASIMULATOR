/**
 * Spatial grid for interest management: a player sees their own cell and the
 * 8 neighbouring cells. Pure data structure, no networking.
 */
export const CELL_SIZE_M = 64;

export type CellKey = string;

export function cellOf(x: number, z: number, size = CELL_SIZE_M): [number, number] {
  return [Math.floor(x / size), Math.floor(z / size)];
}

export const keyOf = (cx: number, cz: number): CellKey => `${cx},${cz}`;

export function neighbourKeys(cx: number, cz: number): CellKey[] {
  const keys: CellKey[] = [];
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) keys.push(keyOf(cx + dx, cz + dz));
  return keys;
}

export class SpatialGrid {
  private cells = new Map<CellKey, Set<string>>();
  private where = new Map<string, [number, number]>();

  constructor(private size = CELL_SIZE_M) {}

  /** Inserts or moves an id. Returns the old and new cell when the cell changed. */
  set(id: string, x: number, z: number): { from?: [number, number]; to: [number, number] } | null {
    const to = cellOf(x, z, this.size);
    const from = this.where.get(id);
    if (from && from[0] === to[0] && from[1] === to[1]) return null;
    if (from) this.cells.get(keyOf(...from))?.delete(id);
    const key = keyOf(...to);
    let set = this.cells.get(key);
    if (!set) this.cells.set(key, (set = new Set()));
    set.add(id);
    this.where.set(id, to);
    return { from, to };
  }

  remove(id: string): void {
    const at = this.where.get(id);
    if (!at) return;
    const key = keyOf(...at);
    const set = this.cells.get(key);
    set?.delete(id);
    if (set && set.size === 0) this.cells.delete(key);
    this.where.delete(id);
  }

  /** Ids visible from a cell (own + neighbours). */
  around(cell: [number, number]): Set<string> {
    const out = new Set<string>();
    for (const key of neighbourKeys(cell[0], cell[1])) for (const id of this.cells.get(key) ?? []) out.add(id);
    return out;
  }

  cellOfId(id: string): [number, number] | undefined {
    return this.where.get(id);
  }

  /** Ids that came into or went out of view when moving from one cell to another. */
  diff(from: [number, number] | undefined, to: [number, number]): { entered: Set<string>; left: Set<string> } {
    const before = from ? this.around(from) : new Set<string>();
    const after = this.around(to);
    const entered = new Set([...after].filter((id) => !before.has(id)));
    const left = new Set([...before].filter((id) => !after.has(id)));
    return { entered, left };
  }
}
