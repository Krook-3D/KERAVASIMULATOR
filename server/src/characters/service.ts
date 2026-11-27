import type { Db } from '../db/pool';
import { withTx } from '../db/pool';
import { addMoney } from '../economy/ledger';
import { STARTING_MONEY_CENTS } from '../../../shared/economy';
import { levelFromXp } from '../../../src/game/xp/xp';

export interface Character {
  id: string;
  accountId: string;
  name: string;
  color: string;
  money: number;
  xp: number;
  level: number;
  health: number;
  energy: number;
  x: number;
  z: number;
  playSeconds: number;
  createdAt: Date;
}

export interface InventoryRow {
  itemId: string;
  location: 'pack' | 'home';
  quantity: number;
}

export class CharacterError extends Error {
  constructor(
    public code: 'invalid_name' | 'name_taken' | 'limit' | 'invalid_color',
    message: string,
  ) {
    super(message);
  }
}

const NAME_RE = /^[A-Za-z0-9ÅÄÖåäö_ ]{3,12}$/;
const BANNED_WORDS = ['admin', 'moderaattori', 'moderator', 'yllapito', 'ylläpito', 'poliisi', 'kerava simulator'];
const SKILL_IDS = ['strength', 'endurance', 'running', 'cooking', 'fishing', 'hustling', 'evasion'];

export function nameProblem(raw: string): string | null {
  const name = raw.normalize('NFC');
  if (!NAME_RE.test(name)) return 'Nimessä saa olla 3–12 merkkiä: kirjaimia, numeroita, väli tai alaviiva.';
  if (name !== name.trim() || name.includes('  ')) return 'Nimi ei saa alkaa tai loppua välilyöntiin.';
  const lower = name.toLowerCase();
  if (BANNED_WORDS.some((w) => lower.includes(w))) return 'Nimi ei ole sallittu.';
  return null;
}

export class CharacterService {
  constructor(
    private db: Db,
    private maxCharacters: number,
  ) {}

  async create(accountId: string, input: { name: string; color: string }): Promise<Character> {
    const name = input.name.normalize('NFC');
    const problem = nameProblem(name);
    if (problem) throw new CharacterError('invalid_name', problem);
    if (!/^#[0-9a-fA-F]{6}$/.test(input.color)) throw new CharacterError('invalid_color', 'Virheellinen väri.');
    try {
      return await withTx(this.db, async (tx) => {
        // Lock the account row so two parallel requests cannot exceed the limit.
        await tx.query('SELECT id FROM accounts WHERE id = $1 FOR UPDATE', [accountId]);
        const { rows: count } = await tx.query<{ n: number }>('SELECT count(*)::int AS n FROM characters WHERE account_id = $1', [accountId]);
        if (count[0]!.n >= this.maxCharacters) throw new CharacterError('limit', 'Tilillä on jo hahmo.');
        const { rows } = await tx.query('INSERT INTO characters (account_id, name, color) VALUES ($1, $2, $3) RETURNING id', [accountId, name, input.color]);
        const id = rows[0].id as string;
        await tx.query(
          `INSERT INTO character_skills (character_id, skill_id) SELECT $1, unnest($2::text[])`,
          [id, SKILL_IDS],
        );
        await addMoney(tx, id, STARTING_MONEY_CENTS, 'starting_money');
        return (await this.get(id, tx))!;
      });
    } catch (err) {
      if ((err as { code?: string }).code === '23505') throw new CharacterError('name_taken', 'Nimi on jo varattu.');
      throw err;
    }
  }

  async get(id: string, db: Pick<Db, 'query'> = this.db): Promise<Character | null> {
    const { rows } = await db.query('SELECT * FROM characters WHERE id = $1', [id]);
    return rows[0] ? toCharacter(rows[0]) : null;
  }

  async listForAccount(accountId: string): Promise<Character[]> {
    const { rows } = await this.db.query('SELECT * FROM characters WHERE account_id = $1 ORDER BY created_at', [accountId]);
    return rows.map(toCharacter);
  }

  async inventory(id: string): Promise<InventoryRow[]> {
    const { rows } = await this.db.query(
      'SELECT item_id, location, quantity FROM inventory_items WHERE character_id = $1 ORDER BY location, item_id',
      [id],
    );
    return rows.map((r) => ({ itemId: r.item_id, location: r.location, quantity: r.quantity }));
  }

  /** Persists position and play time (on disconnect and periodically). Not economy data. */
  async savePresence(id: string, x: number, z: number, addPlaySeconds: number): Promise<void> {
    await this.db.query('UPDATE characters SET pos_x = $2, pos_z = $3, play_seconds = play_seconds + $4 WHERE id = $1', [
      id,
      x,
      z,
      Math.max(0, Math.round(addPlaySeconds)),
    ]);
  }
}

function toCharacter(r: Record<string, any>): Character {
  return {
    id: r.id,
    accountId: r.account_id,
    name: r.name,
    color: r.color,
    money: r.money,
    xp: r.xp,
    level: levelFromXp(r.xp),
    health: r.health,
    energy: r.energy,
    x: r.pos_x,
    z: r.pos_z,
    playSeconds: r.play_seconds,
    createdAt: r.created_at,
  };
}
